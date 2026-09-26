#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# auto-update.sh — aggiornamento AUTOMATICO, da lanciare col cron ogni mattina
# ─────────────────────────────────────────────────────────────────────────────
# Cosa fa, nell'ordine:
#   1. se c'è una riunione in corso rimanda (configurabile) invece di buttare
#      fuori la gente;
#   2. fotografa le versioni installate;
#   3. porta TUTTE le dipendenze all'ultima versione, major comprese
#      (npm-check-updates --target latest su server/package.json);
#   4. ricostruisce l'immagine e riavvia il servizio;
#   5. aspetta che risponda: se non risponde ripristina package.json e
#      l'immagine precedente (rollback);
#   6. manda una email di riepilogo con cosa è cambiato e se era major o minor.
#
#   bash auto-update.sh              → aggiornamento vero
#   bash auto-update.sh --dry-run    → dice solo cosa farebbe, non tocca niente
#   bash auto-update.sh --force      → aggiorna anche con riunioni in corso
#
# Variabili (in .env oppure davanti al comando):
#   COMPOSE_SERVICE=app          nome del servizio nel compose
#   UPDATE_SKIP_IF_BUSY=1        rimanda se ci sono partecipanti collegati
#   UPDATE_BUSY_RETRIES=3        quante volte riprovare…
#   UPDATE_BUSY_WAIT=900         …e ogni quanti secondi (900 = 15 min)
#   UPDATE_HEALTH_TRIES=36       tentativi di healthcheck (x5s = 3 min)
#   UPDATE_MAIL_ALWAYS=0         1 = email anche quando non c'è niente da fare
#   UPDATE_KEEP_ROLLBACK=5       quante immagini di rollback tenere (pulizia Docker)
# ═════════════════════════════════════════════════════════════════════════════
set -uo pipefail
cd "$(dirname "$0")"

SERVICE="${COMPOSE_SERVICE:-app}"
DRY_RUN=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --force)   FORCE=1 ;;
    *) echo "Argomento sconosciuto: $arg"; exit 2 ;;
  esac
done

# ── Un solo aggiornamento alla volta ────────────────────────────────────────
LOCK="/tmp/tiditalk-auto-update.lock"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date '+%F %T') · un altro aggiornamento è già in corso, esco."
  exit 0
fi

log() { echo "$(date '+%F %T') · $*"; }

# ── Valori dal .env (senza esportare tutto il file) ─────────────────────────
envval() { grep -E "^[[:space:]]*$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r'; }
APP_PORT="${APP_PORT:-$(envval PORT)}"; APP_PORT="${APP_PORT:-3010}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${APP_PORT}/api/health}"
SKIP_IF_BUSY="${UPDATE_SKIP_IF_BUSY:-$(envval UPDATE_SKIP_IF_BUSY)}"; SKIP_IF_BUSY="${SKIP_IF_BUSY:-1}"
BUSY_RETRIES="${UPDATE_BUSY_RETRIES:-$(envval UPDATE_BUSY_RETRIES)}"; BUSY_RETRIES="${BUSY_RETRIES:-3}"
BUSY_WAIT="${UPDATE_BUSY_WAIT:-$(envval UPDATE_BUSY_WAIT)}"; BUSY_WAIT="${BUSY_WAIT:-900}"
HEALTH_TRIES="${UPDATE_HEALTH_TRIES:-36}"
# 1 = manda l'email anche quando non c'era niente da aggiornare
MAIL_ALWAYS="${UPDATE_MAIL_ALWAYS:-$(envval UPDATE_MAIL_ALWAYS)}"; MAIL_ALWAYS="${MAIL_ALWAYS:-0}"
ALWAYS_JSON=$([[ "$MAIL_ALWAYS" == "1" ]] && echo ',"always":true' || echo '')
IMAGE_NAME="$(docker compose config --images "$SERVICE" 2>/dev/null | head -1 || echo tdt-meet:latest)"

START_TS=$(date +%s)
PROJECT_DIR="$(pwd)"
log "── Aggiornamento automatico $( [[ $DRY_RUN == 1 ]] && echo '(dry-run)' ) ──"

# ── Pulizia sicura di Docker ────────────────────────────────────────────────
# NON si usa `docker system prune -a`: cancellerebbe anche le immagini di
# rollback (non sono usate da nessun container) e i comandi di ripristino
# nelle email smetterebbero di funzionare. Qui invece:
#   • si tengono le ultime KEEP_ROLLBACK immagini tdt-meet:rollback-*, le più
#     vecchie si stacca solo il tag;
#   • `docker system prune -f` (SENZA -a e SENZA --volumes) toglie container
#     fermi, reti inutilizzate e immagini "orfane" senza tag;
#   • la cache di build più vecchia di 7 giorni se ne va.
KEEP_ROLLBACK="${UPDATE_KEEP_ROLLBACK:-$(envval UPDATE_KEEP_ROLLBACK)}"; KEEP_ROLLBACK="${KEEP_ROLLBACK:-5}"
cleanup_docker() {
  local old
  old=$(docker image ls --format '{{.Repository}}:{{.Tag}} {{.CreatedAt}}' 2>/dev/null \
        | grep '^tdt-meet:rollback-' | sort -k2 -r | awk '{print $1}' | tail -n +$((KEEP_ROLLBACK + 1)))
  if [[ -n "$old" ]]; then
    log "tolgo i tag di rollback più vecchi (tengo gli ultimi $KEEP_ROLLBACK): $(echo $old | tr '\n' ' ')"
    echo "$old" | xargs -r docker rmi > /dev/null 2>&1 || true
  fi
  docker system prune -f > /dev/null 2>&1 || true
  docker builder prune -f --filter until=168h > /dev/null 2>&1 || true
  log "pulizia Docker fatta: $(docker system df --format '{{.Type}} {{.Size}}' 2>/dev/null | tr '\n' ' ')"
}

# ── Email di riepilogo (gira DENTRO il container, usa SMTP e brand dell'app) ─
send_report() { # $1 = json
  [[ $DRY_RUN == 1 ]] && { log "dry-run: email non inviata"; return 0; }
  printf '%s' "$1" | docker compose exec -T "$SERVICE" node /app/server/update-report.js \
    || log "⚠ invio email di riepilogo fallito (l'aggiornamento però è andato come scritto sopra)"
}

json_field() { # $1=json  $2=chiave  → valore grezzo (niente jq sull'host)
  printf '%s' "$1" | tr ',' '\n' | grep -o "\"$2\":[^,}]*" | head -1 | cut -d: -f2- | tr -d '" '
}

# ── 1. Riunioni in corso? ───────────────────────────────────────────────────
peers_online() {
  local body
  body=$(curl -sf --max-time 4 "$HEALTH_URL" 2>/dev/null) || { echo "-1"; return; }
  local n; n=$(json_field "$body" peers)
  [[ "$n" =~ ^[0-9]+$ ]] && echo "$n" || echo "-1"
}

if [[ "$SKIP_IF_BUSY" == "1" && $FORCE == 0 ]]; then
  try=0
  while :; do
    n=$(peers_online)
    if [[ "$n" == "0" || "$n" == "-1" ]]; then
      [[ "$n" == "-1" ]] && log "stato partecipanti non disponibile: procedo comunque"
      break
    fi
    try=$((try + 1))
    if (( try > BUSY_RETRIES )); then
      log "ancora $n partecipanti dopo $BUSY_RETRIES rinvii: procedo lo stesso"
      break
    fi
    log "$n partecipanti collegati: rimando di $((BUSY_WAIT / 60)) minuti (rinvio $try/$BUSY_RETRIES)"
    [[ $DRY_RUN == 1 ]] && { log "dry-run: non aspetto"; break; }
    sleep "$BUSY_WAIT"
  done
fi

# ── 2. Foto delle versioni installate ───────────────────────────────────────
# Il container in esecuzione può essere ancora quello VECCHIO, senza
# update-report.js: in quel caso si legge la stessa lista con un node -e.
snapshot_versions() {
  local out
  out=$(docker compose exec -T "$SERVICE" node /app/server/update-report.js --versions 2>/dev/null | tail -1)
  if [[ "$out" != \{* ]]; then
    out=$(docker compose exec -T "$SERVICE" node -e \
      'const fs=require("fs"),path=require("path");const p=["mediasoup","mediasoup-client","socket.io","express","better-sqlite3","nodemailer","dotenv","cors","bcryptjs"];const o={};for(const x of p){let v=null;try{v=require(x+"/package.json").version}catch(e){}if(!v){for(const r of ["/app/server/node_modules","/app/node_modules"]){try{const f=path.join(r,x,"package.json");if(fs.existsSync(f)){v=JSON.parse(fs.readFileSync(f,"utf8")).version;break}}catch(e){}}}if(v)o[x]=v}console.log(JSON.stringify(o))' \
      2>/dev/null | tail -1)
  fi
  [[ "$out" == \{* ]] && printf '%s' "$out" || printf '{}'
}

BEFORE=$(snapshot_versions)
log "versioni attuali: $BEFORE"

# ── 3. Porta package.json all'ultima versione (major comprese) ──────────────
# I backup stanno nella cartella del progetto (in /tmp il reboot li cancella) e
# il tag dell'immagine è datato: così l'email può dire ESATTAMENTE cosa
# ripristinare, anche a distanza di giorni.
STAMP="$(date '+%Y%m%d-%H%M')"
BK_DIR="backups"
mkdir -p "$BK_DIR"
PKG_BAK="$BK_DIR/package.json.$STAMP.bak"
LOCK_BAK="$BK_DIR/package-lock.json.$STAMP.bak"
ROLLBACK_TAG="tdt-meet:rollback-$STAMP"
cp server/package.json "$PKG_BAK"
[[ -f server/package-lock.json ]] && cp server/package-lock.json "$LOCK_BAK"
# tiene gli ultimi 10 backup, il resto si butta
ls -1t "$BK_DIR"/package.json.*.bak 2>/dev/null | tail -n +11 | xargs -r rm -f
ls -1t "$BK_DIR"/package-lock.json.*.bak 2>/dev/null | tail -n +11 | xargs -r rm -f

log "controllo nuove versioni su npm (ncu --target latest)…"
NCU_OUT=$(docker run --rm -v "$PWD/server:/w" -w /w --user "$(id -u):$(id -g)" \
  node:22-alpine npx --yes npm-check-updates@latest -u --target latest 2>&1)
echo "$NCU_OUT"

# Anche se package.json è già al massimo, dentro l'immagine possono esserci
# versioni più vecchie: `npm install` rispetta il lock e Docker riusa il layer
# in cache. Qui si confronta ciò che è DAVVERO installato con l'ultima versione
# su npm; se c'è scarto si ricostruisce saltando la cache.
DRIFT=""
latest_of() {
  curl -s --max-time 8 "https://registry.npmjs.org/$1/latest" 2>/dev/null \
    | tr ',' '\n' | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4
}
check_drift() {
  local list out
  list=$(printf '%s' "$BEFORE" | tr -d '{}"' | tr ',' '\n')
  while IFS=: read -r pkg cur; do
    [[ -z "$pkg" || -z "$cur" ]] && continue
    local lat; lat=$(latest_of "$pkg")
    [[ -z "$lat" ]] && continue
    if [[ "$lat" != "$cur" ]]; then out+="${pkg} ${cur}→${lat}, "; fi
  done <<< "$list"
  printf '%s' "${out%, }"
}

if cmp -s "$PKG_BAK" server/package.json; then
  DRIFT=$(check_drift)
  if [[ -n "$DRIFT" ]]; then
    log "package.json già al massimo, ma nell'immagine ci sono versioni vecchie: $DRIFT"
    log "rebuild SENZA cache per riallineare…"
    if [[ $DRY_RUN == 1 ]]; then
      log "dry-run: mi fermo qui."
      exit 0
    fi
    CUR_IMAGE_ID=$(docker compose images -q "$SERVICE" 2>/dev/null | head -1 || true)
    if [[ -n "$CUR_IMAGE_ID" ]]; then
      docker tag "$CUR_IMAGE_ID" tdt-meet:rollback
      docker tag "$CUR_IMAGE_ID" "$ROLLBACK_TAG"
    fi
    if docker compose build --no-cache "$SERVICE" && docker compose up -d "$SERVICE"; then
      log "attendo che risponda su $HEALTH_URL …"
      OK=0
      for i in $(seq 1 "$HEALTH_TRIES"); do
        sleep 5
        if curl -sf --max-time 4 "$HEALTH_URL" > /dev/null; then OK=1; break; fi
      done
      if [[ $OK == 1 ]]; then
        AFTER=$(snapshot_versions)
        log "✅ riallineato. versioni ora: $AFTER"
        send_report "{\"status\":\"ok\",\"before\":$BEFORE,\"after\":$AFTER,\"rollbackInfo\":{\"dir\":\"$PROJECT_DIR\",\"service\":\"$SERVICE\",\"image\":\"$ROLLBACK_TAG\",\"imageName\":\"$IMAGE_NAME\",\"pkg\":\"$PKG_BAK\",\"lock\":\"$LOCK_BAK\"},\"duration\":$(( $(date +%s) - START_TS ))}"
        cleanup_docker
        exit 0
      fi
    fi
    log "❌ riallineamento fallito: ROLLBACK."
    if docker image inspect tdt-meet:rollback > /dev/null 2>&1; then
      docker tag tdt-meet:rollback "$IMAGE_NAME"
      docker compose up -d --no-build "$SERVICE"
    fi
    send_report "{\"status\":\"rollback\",\"before\":$BEFORE,\"after\":$BEFORE,\"error\":\"Rebuild senza cache fallito durante il riallineamento delle versioni.\",\"rollbackInfo\":{\"dir\":\"$PROJECT_DIR\",\"service\":\"$SERVICE\",\"image\":\"$ROLLBACK_TAG\",\"imageName\":\"$IMAGE_NAME\",\"pkg\":\"$PKG_BAK\",\"lock\":\"$LOCK_BAK\"},\"duration\":$(( $(date +%s) - START_TS ))}"
    exit 1
  fi
  log "nessun aggiornamento disponibile: niente rebuild."
  send_report "{\"status\":\"ok\",\"before\":$BEFORE,\"after\":$BEFORE,\"rollbackInfo\":{\"dir\":\"$PROJECT_DIR\",\"service\":\"$SERVICE\",\"image\":\"$ROLLBACK_TAG\",\"imageName\":\"$IMAGE_NAME\",\"pkg\":\"$PKG_BAK\",\"lock\":\"$LOCK_BAK\"},\"duration\":$(( $(date +%s) - START_TS ))$ALWAYS_JSON}"
  exit 0
fi

if [[ $DRY_RUN == 1 ]]; then
  log "dry-run: ripristino package.json e mi fermo qui."
  cp "$PKG_BAK" server/package.json
  [[ -f "$LOCK_BAK" ]] && cp "$LOCK_BAK" server/package-lock.json
  exit 0
fi

# ── 4. Rebuild ──────────────────────────────────────────────────────────────
CUR_IMAGE_ID=$(docker compose images -q "$SERVICE" 2>/dev/null | head -1 || true)
if [[ -n "$CUR_IMAGE_ID" ]]; then
  docker tag "$CUR_IMAGE_ID" tdt-meet:rollback
  docker tag "$CUR_IMAGE_ID" "$ROLLBACK_TAG"
  log "immagine attuale salvata come tdt-meet:rollback e $ROLLBACK_TAG"
fi

# Il lock file pinna le versioni: se resta quello vecchio, `npm install` nel
# Dockerfile reinstalla le versioni di prima nonostante il package.json nuovo.
if [[ -f server/package-lock.json ]]; then
  log "aggiorno anche package-lock.json…"
  docker run --rm -v "$PWD/server:/w" -w /w --user "$(id -u):$(id -g)" \
    node:22-alpine npm install --package-lock-only --no-audit --no-fund --loglevel=error \
    || log "⚠ aggiornamento del lock fallito: procedo comunque"
fi

log "rebuild dell'immagine…"
if ! docker compose build "$SERVICE"; then
  log "❌ build fallita: ripristino package.json, il servizio in aria resta quello di prima."
  cp "$PKG_BAK" server/package.json
  [[ -f "$LOCK_BAK" ]] && cp "$LOCK_BAK" server/package-lock.json
  send_report "{\"status\":\"error\",\"before\":$BEFORE,\"after\":$BEFORE,\"error\":\"Build Docker fallita. Vedi il log su host.\",\"rollbackInfo\":{\"dir\":\"$PROJECT_DIR\",\"service\":\"$SERVICE\",\"image\":\"$ROLLBACK_TAG\",\"imageName\":\"$IMAGE_NAME\",\"pkg\":\"$PKG_BAK\",\"lock\":\"$LOCK_BAK\"},\"duration\":$(( $(date +%s) - START_TS ))}"
  exit 1
fi

log "riavvio del servizio…"
docker compose up -d "$SERVICE"

# ── 5. Healthcheck, altrimenti rollback ─────────────────────────────────────
log "attendo che risponda su $HEALTH_URL …"
OK=0
for i in $(seq 1 "$HEALTH_TRIES"); do
  sleep 5
  if curl -sf --max-time 4 "$HEALTH_URL" > /dev/null; then OK=1; break; fi
done

if [[ $OK == 0 ]]; then
  log "❌ il servizio non risponde: ROLLBACK."
  cp "$PKG_BAK" server/package.json
  [[ -f "$LOCK_BAK" ]] && cp "$LOCK_BAK" server/package-lock.json
  if docker image inspect tdt-meet:rollback > /dev/null 2>&1; then
    docker tag tdt-meet:rollback "$IMAGE_NAME"
    docker compose up -d --no-build "$SERVICE"
    sleep 8
  fi
  ERRLOG=$(docker compose logs --tail 25 "$SERVICE" 2>&1 | tail -25 | sed 's/"/\\"/g' | tr '\n' '~' | sed 's/~/\\n/g')
  send_report "{\"status\":\"rollback\",\"before\":$BEFORE,\"after\":$BEFORE,\"error\":\"$ERRLOG\",\"rollbackInfo\":{\"dir\":\"$PROJECT_DIR\",\"service\":\"$SERVICE\",\"image\":\"$ROLLBACK_TAG\",\"imageName\":\"$IMAGE_NAME\",\"pkg\":\"$PKG_BAK\",\"lock\":\"$LOCK_BAK\"},\"duration\":$(( $(date +%s) - START_TS ))}"
  exit 1
fi

# ── 6. Report ───────────────────────────────────────────────────────────────
AFTER=$(snapshot_versions)
log "✅ servizio OK. versioni ora: $AFTER"
send_report "{\"status\":\"ok\",\"before\":$BEFORE,\"after\":$AFTER,\"rollbackInfo\":{\"dir\":\"$PROJECT_DIR\",\"service\":\"$SERVICE\",\"image\":\"$ROLLBACK_TAG\",\"imageName\":\"$IMAGE_NAME\",\"pkg\":\"$PKG_BAK\",\"lock\":\"$LOCK_BAK\"},\"duration\":$(( $(date +%s) - START_TS ))}"

cleanup_docker
log "── fine ($(( $(date +%s) - START_TS ))s) ──"
