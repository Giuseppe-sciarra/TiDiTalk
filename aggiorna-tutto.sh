#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# aggiorna-tutto.sh — aggiornamento AUTOMATICO di Tiditalk, ogni notte
# ─────────────────────────────────────────────────────────────────────────────
# Cosa aggiorna:
#   • app: Node 22 all'ultima patch + Alpine (con l'immagine base node:22-alpine) e TUTTE le
#     librerie di server/package.json all'ultima versione, major comprese
#     (npm-check-updates --target latest), insieme al package-lock.json;
#     le dipendenze con un limite (es. "mediasoup": ">=3.14 <4") restano come sono: è il
#     modo per bloccarne una;
#   • coturn: l'immagine nuova (coturn/coturn:latest), se è uscita.
#
# Come, nell'ordine:
#   0. se c'è una riunione in corso rimanda (3 × 15 minuti, poi procede);
#   1. scarica l'ultima immagine base: è cambiata? (correzioni di sicurezza di Node e di
#      Alpine, come quella di Brotli di ottobre 2026);
#   2. calcola l'ultima versione delle librerie (npm, in un container usa e getta in cui
#      entrano SOLO package.json e package-lock.json: niente .env, niente codice);
#   3. se è cambiato qualcosa (immagine base, librerie, Dockerfile o codice rispetto
#      all'ultima build riuscita — es. dopo uno zip —, versioni nell'immagine più vecchie di
#      quelle su npm) ricostruisce l'app (sempre con --pull) e la riavvia: Tiditalk resta
#      giù 10-30 secondi;
#   4. la prova (/api/health risponde e il container non riparte da solo per 20 s): se non
#      va → ROLLBACK a package.json, package-lock.json e immagine di prima;
#   5. stesso giro per coturn: riavvio solo se l'immagine è cambiata, controllo che resti
#      su, altrimenti torna all'immagine di prima;
#   6. pulizia di Docker che non tocca le immagini di rollback;
#   7. email di riepilogo (tabella delle versioni, cosa è successo, comandi per tornare
#      indietro), spedita da Tiditalk col suo SMTP del .env.
#
#   bash aggiorna-tutto.sh              → aggiornamento vero
#   bash aggiorna-tutto.sh --dry-run    → dice cosa farebbe, non tocca niente
#   bash aggiorna-tutto.sh --force      → aggiorna anche con riunioni in corso
#
# Variabili (nel .env oppure davanti al comando):
#   AGG_MAIL_A=tuo@indirizzo.it   chi riceve l'email (se manca: UPDATE_NOTIFY_EMAIL, poi HOST_NOTIFY_EMAIL)
#   AGG_MAIL_SEMPRE=0             1 = email anche quando era già tutto aggiornato (vale anche UPDATE_MAIL_ALWAYS)
#   AGG_TIENI_ROLLBACK=5          quante immagini di rollback tenere (vale anche UPDATE_KEEP_ROLLBACK)
#   UPDATE_SKIP_IF_BUSY=1         rimanda se ci sono partecipanti collegati
#   UPDATE_BUSY_RETRIES=3         quante volte rimandare…
#   UPDATE_BUSY_WAIT=900          …e ogni quanti secondi (900 = 15 minuti)
# ═════════════════════════════════════════════════════════════════════════════
PROGETTO="tiditalk"
NOME="Tiditalk"
TIENI_DEF=5

set -uo pipefail
cd "$(dirname "$0")" || exit 1
DIR="$(pwd)"

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
exec 9> "/tmp/$PROGETTO-aggiorna-tutto.lock"
if ! flock -n 9; then
  echo "$(date '+%F %T') · un altro aggiornamento è già in corso, esco."
  exit 0
fi

envval() { grep -E "^[[:space:]]*$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r'; }
# primo valore non vuoto fra le variabili date, cercato prima nell'ambiente e poi nel .env
pick() { local n v; for n in "$@"; do v="${!n:-}"; [[ -z "$v" ]] && v="$(envval "$n")"; [[ -n "$v" ]] && { printf '%s' "$v"; return 0; }; done; return 0; }

TZ="$(pick TZ)"; export TZ="${TZ:-Europe/Rome}"   # orari del log e dei rollback in ora italiana (il CT può essere in UTC)
log() { echo "$(date '+%F %T') · $*"; }

SERVICE="$(pick COMPOSE_SERVICE)"; SERVICE="${SERVICE:-app}"   # il servizio costruito da questa cartella
MAIL_A="$(pick AGG_MAIL_A UPDATE_NOTIFY_EMAIL HOST_NOTIFY_EMAIL)"
MAIL_SEMPRE="$(pick AGG_MAIL_SEMPRE UPDATE_MAIL_ALWAYS)"; MAIL_SEMPRE="${MAIL_SEMPRE:-0}"
TIENI="$(pick AGG_TIENI_ROLLBACK UPDATE_KEEP_ROLLBACK)"; TIENI="${TIENI:-$TIENI_DEF}"
[[ "$TIENI" =~ ^[0-9]+$ ]] || TIENI=$TIENI_DEF
SKIP_IF_BUSY="$(pick UPDATE_SKIP_IF_BUSY)"; SKIP_IF_BUSY="${SKIP_IF_BUSY:-1}"
BUSY_RETRIES="$(pick UPDATE_BUSY_RETRIES)"; BUSY_RETRIES="${BUSY_RETRIES:-3}"
BUSY_WAIT="$(pick UPDATE_BUSY_WAIT)"; BUSY_WAIT="${BUSY_WAIT:-900}"
HEALTH_TRIES="$(pick AGG_HEALTH_TRIES UPDATE_HEALTH_TRIES)"; HEALTH_TRIES="${HEALTH_TRIES:-36}"   # x5 s = 3 minuti
APP_PORT="$(pick APP_PORT PORT)"; APP_PORT="${APP_PORT:-3010}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${APP_PORT}/api/health}"

START_TS=$(date +%s)
STAMP="$(date '+%Y%m%d-%H%M')"
mkdir -p backups logs
RIEPILOGO=""        # righe dell'email
ESITO="nessuno"     # nessuno | ok | rollback | errore
RICOSTRUITA=0       # 1 = l'app è stata ricostruita (l'email dà i comandi per tornare indietro)
RIPR=""             # comando per tornare alla versione di prima
aggiungi() { RIEPILOGO+="$*"$'\n'; }
peggiora() {        # l'esito finale è il peggiore incontrato
  case "$1" in
    errore)   ESITO="errore" ;;
    rollback) [[ "$ESITO" != "errore" ]] && ESITO="rollback" ;;
    ok)       [[ "$ESITO" == "nessuno" ]] && ESITO="ok" ;;
  esac
  return 0
}
trap 'rm -rf "$DIR/.agg-tmp"' EXIT

log "── Aggiornamento automatico di $NOME $( [[ $DRY_RUN == 1 ]] && echo '(dry-run) ' )──"

# Immagine e id di un servizio, letti dal suo container (vuoto se il servizio non è avviato).
immagine_di() { local c; c=$(docker compose ps -q "$1" 2>/dev/null | head -1); [[ -n "$c" ]] && docker inspect -f '{{.Config.Image}}' "$c" 2>/dev/null; }
id_di()       { local c; c=$(docker compose ps -q "$1" 2>/dev/null | head -1); [[ -n "$c" ]] && docker inspect -f '{{.Image}}' "$c" 2>/dev/null; }
# Immagini di partenza del Dockerfile (le righe FROM, senza i nomi degli stage come «builder»).
basi() { awk 'toupper($1) == "FROM" { img[$2] = 1; if (toupper($3) == "AS") al[$4] = 1 } END { for (i in img) if (!(i in al)) print i }' Dockerfile 2>/dev/null | sort; }
# Immagine che il docker-compose.yml chiede per un servizio: può essere diversa da quella che gira.
immagine_compose() {
  docker compose config 2>/dev/null | awk -v s="  $1:" '
    $0 == s { f = 1; next }
    f && (/^[^ ]/ || /^  [^ ]/) { exit }
    f && $1 == "image:" { gsub(/"/, "", $2); print $2; exit }'
}

prova() {   # $1 servizio → 0 se risponde come deve (gli altri: basta stato e healthcheck)
  case "$1" in
    "$SERVICE") curl -sf --max-time 4 "$HEALTH_URL" 2>/dev/null | grep -q '"ok":true' ;;
    *)          return 0 ;;
  esac
}

versione() {   # $1 servizio → versione leggibile per log ed email
  local v=""
  case "$1" in
    "$SERVICE") v=$(docker compose exec -T "$1" node -p '"Node " + process.versions.node' 2>/dev/null | tr -d '\r' | tail -1) ;;
    coturn)     v=$(docker compose exec -T coturn turnserver --version 2>/dev/null | tr -d '\r' | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)*' | head -1 | sed 's/^/coturn /') ;;
  esac
  if [[ -z "$v" ]]; then
    local i; i=$(immagine_di "$1"); [[ -n "$i" ]] && v=$(docker image inspect -f '{{.Created}}' "$i" 2>/dev/null | cut -c1-10 | sed 's/^/immagine del /')
  fi
  printf '%s' "$v"
}

# Il servizio è in piedi, sano e risponde alla sua prova (al massimo HEALTH_TRIES x 5 s);
# poi deve restare su altri 20 s senza ripartire (un crash-loop qui si vede).
controlla() {
  local svc="$1" cid st h at
  for _ in $(seq 1 "$HEALTH_TRIES"); do
    sleep 5
    cid=$(docker compose ps -q "$svc" 2>/dev/null | head -1)
    [[ -n "$cid" ]] || continue
    read -r st h at <<< "$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}-{{end}} {{.State.StartedAt}}' "$cid" 2>/dev/null)"
    [[ "$st" == running && ( "$h" == healthy || "$h" == - ) ]] || continue
    prova "$svc" || continue
    sleep 20
    [[ "$(docker inspect -f '{{.State.Status}} {{.State.StartedAt}}' "$cid" 2>/dev/null)" == "running $at" ]]
    return
  done
  return 1
}

# ═════════════════════════════════════════════════════════════════════════════
# 0. Riunioni in corso? Si rimanda invece di buttare fuori la gente
# ═════════════════════════════════════════════════════════════════════════════
json_field() { printf '%s' "$1" | tr ',' '\n' | grep -o "\"$2\":[^,}]*" | head -1 | cut -d: -f2- | tr -d '" '; }
peers_online() {
  local body n
  body=$(curl -sf --max-time 4 "$HEALTH_URL" 2>/dev/null) || { echo "-1"; return; }
  n=$(json_field "$body" peers)
  [[ "$n" =~ ^[0-9]+$ ]] && echo "$n" || echo "-1"
}
if [[ "$SKIP_IF_BUSY" == "1" && $FORCE == 0 ]]; then
  try=0
  while :; do
    n=$(peers_online)
    if [[ "$n" == "0" || "$n" == "-1" ]]; then
      [[ "$n" == "-1" ]] && log "stato dei partecipanti non disponibile: procedo"
      break
    fi
    try=$((try + 1))
    if (( try > BUSY_RETRIES )); then log "ancora $n partecipanti dopo $BUSY_RETRIES rinvii: procedo lo stesso"; break; fi
    log "$n partecipanti collegati: rimando di $( (( BUSY_WAIT >= 60 )) && echo "$((BUSY_WAIT / 60)) minuti" || echo "$BUSY_WAIT secondi" ) (rinvio $try/$BUSY_RETRIES)"
    [[ $DRY_RUN == 1 ]] && { log "dry-run: non aspetto"; break; }
    sleep "$BUSY_WAIT"
  done
fi

# ═════════════════════════════════════════════════════════════════════════════
# L'APP: immagine base (Node + Alpine), librerie npm, Dockerfile e codice
# ═════════════════════════════════════════════════════════════════════════════
# Foto delle versioni installate (tabella dell'email). Il container può essere ancora uno
# vecchio senza update-report.js: allora la stessa lista si legge con un node -e.
snapshot_versions() {
  local out
  out=$(docker compose exec -T "$SERVICE" node /app/server/update-report.js --versions 2>/dev/null | tail -1)
  if [[ "$out" != \{* ]]; then
    out=$(docker compose exec -T "$SERVICE" node -e \
      'const fs=require("fs"),path=require("path");const p=["mediasoup","mediasoup-client","socket.io","express","better-sqlite3","nodemailer","dotenv","cors","bcryptjs"];const o={node:process.versions.node};for(const x of p){let v=null;try{v=require(x+"/package.json").version}catch(e){}if(!v){for(const r of ["/app/server/node_modules","/app/node_modules"]){try{const f=path.join(r,x,"package.json");if(fs.existsSync(f)){v=JSON.parse(fs.readFileSync(f,"utf8")).version;break}}catch(e){}}}if(v)o[x]=v}console.log(JSON.stringify(o))' \
      2>/dev/null | tail -1)
  fi
  [[ "$out" == \{* ]] && printf '%s' "$out" || printf '{}'
}
BEFORE=$(snapshot_versions)
AFTER="$BEFORE"
V_PRIMA="$(versione "$SERVICE")"
log "versioni attuali: $BEFORE"

# 1. Immagine base: c'è una versione nuova? (Docker tiene in cache quella scaricata la
#    prima volta: senza pull le correzioni di Node e di Alpine non arrivano mai)
mapfile -t BASI < <(basi)
[[ ${#BASI[@]} -gt 0 ]] || BASI=("node:22-alpine")
BASE="${BASI[0]}"
BASE_CAMBIATA=0
for b in "${BASI[@]}"; do
  prima=$(docker image inspect -f '{{.Id}}' "$b" 2>/dev/null || true)
  docker pull -q "$b" > /dev/null 2>&1 || log "⚠ pull di $b non riuscito: resta quella che c'è"
  dopo=$(docker image inspect -f '{{.Id}}' "$b" 2>/dev/null || true)
  if [[ -n "$dopo" && "$prima" != "$dopo" ]]; then BASE_CAMBIATA=1; log "immagine base $b: NUOVA"
  else log "immagine base $b: invariata"; fi
done
NODE_NEW=$(docker run --rm "$BASE" node -p 'process.versions.node' 2>/dev/null | tr -d '\r' | tail -1)
log "Node: ${V_PRIMA:-?} nel container, ${NODE_NEW:-?} nell'ultima $BASE"

# 2. Ultima versione di ogni libreria di server/package.json, major comprese, decisa da
#    npm-check-updates; poi il package-lock.json nuovo. Nel container usa e getta entrano
#    SOLO package.json e package-lock.json (niente .env, niente codice). Le dipendenze con
#    un limite («<») restano come sono.
rm -rf .agg-tmp; mkdir -p .agg-tmp
cp server/package.json .agg-tmp/package.json
[[ -f server/package-lock.json ]] && cp server/package-lock.json .agg-tmp/package-lock.json
cat > .agg-tmp/tenute.js <<'JS'
const p = require('./prima.json'), a = { ...p.dependencies, ...p.devDependencies };
process.stdout.write(Object.keys(a).filter(k => /</.test(String(a[k]))).join(','));
JS
cat > .agg-tmp/modifiche.js <<'JS'
const a = require('./prima.json'), b = require('./package.json');
const pulita = v => String(v || '').replace(/^[\^~=v\s]+/, '');
const tipo = (x, y) => { const p = pulita(x).split('.'), q = pulita(y).split('.'); return p[0] !== q[0] ? 'MAJOR' : p[1] !== q[1] ? 'minor' : 'patch'; };
for (const s of ['dependencies', 'devDependencies']) for (const k of Object.keys(b[s] || {})) {
  const x = (a[s] || {})[k], y = b[s][k];
  if (x !== y) console.log(`${k} ${pulita(x) || '—'} → ${pulita(y)} (${tipo(x, y)})${s === 'devDependencies' ? ' [solo sviluppo]' : ''}`);
}
JS
cat > .agg-tmp/giro.sh <<'SH'
set -e
cp package.json prima.json
T=$(node tenute.js)
echo "dipendenze bloccate da un limite: ${T:-nessuna}"
npx --yes npm-check-updates@latest -u --target latest ${T:+--reject "$T"}
node modifiche.js > modifiche.txt
if [ -s modifiche.txt ] && [ -f package-lock.json ]; then
  npm install --package-lock-only --ignore-scripts --no-audit --no-fund --loglevel=error
fi
echo "$T" > tenute.txt
echo ok > fatto
SH
{ echo "── $(date '+%F %T')"; docker run --rm -v "$DIR/.agg-tmp:/w" -w /w --user "$(id -u):$(id -g)" \
    -e HOME=/tmp -e npm_config_update_notifier=false "$BASE" sh giro.sh; } > logs/npm-risoluzione.log 2>&1
TENUTE="$(cat .agg-tmp/tenute.txt 2>/dev/null || true)"
LIB_CAMBIATE=0
MODIFICHE=""
if [[ ! -f .agg-tmp/fatto ]]; then
  log "⚠ non sono riuscito a calcolare le versioni nuove delle librerie (vedi logs/npm-risoluzione.log): tengo quelle di adesso"
  peggiora errore
  aggiungi "❌ Librerie npm: controllo delle versioni nuove non riuscito, restano quelle di adesso."
  aggiungi "   Ultime righe di logs/npm-risoluzione.log:"
  aggiungi "$(tail -n 8 logs/npm-risoluzione.log 2>/dev/null | sed 's/^/   /')"
elif [[ -s .agg-tmp/modifiche.txt ]]; then
  LIB_CAMBIATE=1
  MODIFICHE="$(sed 's/^/   /' .agg-tmp/modifiche.txt)"
  log "librerie npm da aggiornare:"; printf '%s\n' "$MODIFICHE"
else
  log "librerie npm: già tutte all'ultima versione"
fi

# 2b. package.json già al massimo, ma dentro l'immagine possono esserci versioni più vecchie
#     (npm install rispetta il lock e Docker riusa il layer in cache): si confronta ciò che è
#     DAVVERO installato con l'ultima versione su npm; se c'è scarto si ricostruisce senza cache.
DRIFT=""
if [[ $LIB_CAMBIATE == 0 && -f .agg-tmp/fatto ]]; then
  latest_of() { curl -s --max-time 8 "https://registry.npmjs.org/$1/latest" 2>/dev/null | tr ',' '\n' | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4; }
  while IFS=: read -r pkg cur; do
    [[ -z "$pkg" || -z "$cur" || "$pkg" == node ]] && continue          # Node non è un pacchetto npm: lo porta l'immagine base
    [[ ",$TENUTE," == *",$pkg,"* ]] && continue                          # bloccata da un limite: resta com'è
    lat=$(latest_of "$pkg"); [[ -z "$lat" ]] && continue
    [[ "$lat" != "$cur" ]] && DRIFT+="${pkg} ${cur} → ${lat}, "
  done <<< "$(printf '%s' "$BEFORE" | tr -d '{}"' | tr ',' '\n')"
  DRIFT="${DRIFT%, }"
  [[ -n "$DRIFT" ]] && log "nell'immagine ci sono versioni più vecchie di npm: $DRIFT"
fi

# 3. Dockerfile, librerie, codice o immagine base diversi da quelli dell'ultima build riuscita
#    (es. dopo uno zip, o una build fallita ieri). Al primo giro non c'è la firma: si ricostruisce.
#    Fuori dalla firma: quello che cambia mentre Tiditalk gira (caricamenti, sfondi personali)
#    o che il compose monta da fuori (vendor).
firma() {
  { cat Dockerfile .dockerignore 2>/dev/null
    find server public -type f ! -path '*/node_modules/*' ! -name '*.bak' ! -name '*.bak_*' ! -name '*.log' \
      ! -name '*.tmp.js' ! -name '.DS_Store' ! -path 'public/assets/uploads/*' ! -path 'public/assets/backgrounds/*' \
      ! -path 'public/assets/vendor/*' -print0 2>/dev/null | LC_ALL=C sort -z | xargs -0 -r sha256sum
    for b in "${BASI[@]}"; do docker image inspect -f '{{.Id}}' "$b" 2>/dev/null; done; } | sha256sum | cut -c1-16
}
FIRMA_BUILD=$(cat .agg-ultima-build 2>/dev/null || true)
FILE_CAMBIATI=0
[[ "$FIRMA_BUILD" != "$(firma)" ]] && FILE_CAMBIATI=1

DA_RICOSTRUIRE=0
NO_CACHE=0
MOTIVI=()
[[ $BASE_CAMBIATA == 1 ]] && { DA_RICOSTRUIRE=1; MOTIVI+=("immagine base nuova"); }
[[ $LIB_CAMBIATE == 1 ]]  && { DA_RICOSTRUIRE=1; MOTIVI+=("librerie npm"); }
[[ -n "$DRIFT" ]]         && { DA_RICOSTRUIRE=1; NO_CACHE=1; MOTIVI+=("versioni nell'immagine più vecchie di npm"); }
[[ $FILE_CAMBIATI == 1 && $BASE_CAMBIATA == 0 && $LIB_CAMBIATE == 0 ]] && { DA_RICOSTRUIRE=1; MOTIVI+=("$( [[ -z "$FIRMA_BUILD" ]] && echo 'primo giro' || echo "Dockerfile, codice o immagine base diversi dall'ultima build")"); }

motivi() { local s; s=$(printf '%s, ' "${MOTIVI[@]}"); echo "${s%, }"; }

if [[ $DA_RICOSTRUIRE == 0 ]]; then
  log "$NOME: niente da aggiornare"
elif [[ $DRY_RUN == 1 ]]; then
  log "dry-run: ricostruirei $SERVICE per: $(motivi)$( [[ $NO_CACHE == 1 ]] && echo ' (senza cache)' )"
else
  log "ricostruisco $SERVICE per: $(motivi)"
  # copia di riserva di package.json e package-lock.json (backups/, le ultime 10 per file),
  # poi i nuovi al loro posto
  BAK=()
  for f in server/package.json server/package-lock.json; do
    [[ -f "$f" ]] || continue
    nome="$(basename "$f")"; b="backups/$nome.$STAMP.bak"
    cp "$f" "$b"; BAK+=("$f=$b")
    ls -1t "backups/$nome".*.bak 2>/dev/null | tail -n +11 | xargs -r rm -f
  done
  if [[ $LIB_CAMBIATE == 1 ]]; then
    cat .agg-tmp/package.json > server/package.json                       # cat: tiene proprietario e permessi
    [[ -f server/package-lock.json && -f .agg-tmp/package-lock.json ]] && cat .agg-tmp/package-lock.json > server/package-lock.json
  fi

  # l'immagine che gira adesso resta come <immagine>:rollback-<data> (e <immagine>:rollback)
  IMG=$(immagine_di "$SERVICE"); OLD_ID=$(id_di "$SERVICE")
  [[ -z "$IMG" ]] && IMG="$(docker compose config --images "$SERVICE" 2>/dev/null | head -1)"
  IMG="${IMG:-tdt-meet:latest}"
  ROLLBACK_TAG="${IMG%%:*}:rollback-$STAMP"
  if [[ -n "$OLD_ID" ]]; then
    docker tag "$OLD_ID" "$ROLLBACK_TAG"; docker tag "$OLD_ID" "${IMG%%:*}:rollback"
    log "immagine attuale salvata come $ROLLBACK_TAG"
  fi

  rimetti_file() { local x; for x in "${BAK[@]}"; do cp "${x#*=}" "${x%%=*}"; done; }
  ripristina_app() {   # $1 = motivo
    log "❌ $1: ROLLBACK di $NOME"
    rimetti_file
    if [[ -n "$OLD_ID" ]]; then
      docker tag "$OLD_ID" "$IMG"
      docker compose up -d --no-build "$SERVICE" >> logs/build.log 2>&1
      if controlla "$SERVICE"; then log "$SERVICE tornato alla versione di prima e risponde"
      else log "⚠⚠ $SERVICE non risponde nemmeno con l'immagine di prima: controllare a mano (docker compose logs $SERVICE)"; fi
    fi
  }

  BUILD_OPTS=(--pull); [[ $NO_CACHE == 1 ]] && BUILD_OPTS+=(--no-cache)
  if ! docker compose build "${BUILD_OPTS[@]}" "$SERVICE" > logs/build.log 2>&1; then
    log "❌ build fallita (logs/build.log): non tocco $NOME che gira"
    rimetti_file
    peggiora errore
    aggiungi "❌ $NOME: la build della versione nuova non è riuscita ($(motivi)). Quello che gira non è stato toccato."
    aggiungi "   Ultime righe di logs/build.log:"
    aggiungi "$(tr -d '\r' < logs/build.log | grep -v '^[[:space:]]*$' | tail -n 12 | sed 's/^/   /')"
    [[ -n "$MODIFICHE" ]] && { aggiungi "   Versioni che erano state provate:"; aggiungi "$MODIFICHE"; }
  else
    log "build ok, riavvio $SERVICE…"
    docker compose up -d "$SERVICE" >> logs/build.log 2>&1
    if ! controlla "$SERVICE"; then
      ERR=$(docker compose logs --tail 25 "$SERVICE" 2>&1 | tail -25)
      ripristina_app "$SERVICE non parte o non risponde con la versione nuova"
      peggiora rollback
      aggiungi "⚠ $NOME: con la versione nuova non partiva o non rispondeva. È tornato alla versione di prima, funziona come ieri."
      aggiungi "   Ultime righe del log:"; aggiungi "$(printf '%s\n' "$ERR" | sed 's/^/   /')"
      [[ -n "$MODIFICHE" ]] && { aggiungi "   Versioni che erano state provate:"; aggiungi "$MODIFICHE"; }
      aggiungi "   Domani riprova da solo; se il problema resta, metti un limite alla libreria in server/package.json (es. \"nome\": \">=2 <3\")."
    else
      firma > .agg-ultima-build
      RICOSTRUITA=1
      AFTER=$(snapshot_versions)
      log "✅ $NOME aggiornato e provato"
      peggiora ok
      aggiungi "✅ $NOME aggiornato ($(motivi)), prove passate:"
      v=$(versione "$SERVICE"); [[ -n "$v" && "$v" != "$V_PRIMA" ]] && aggiungi "   ${V_PRIMA:-—} → $v"
      [[ -n "$MODIFICHE" ]] && { aggiungi "   Librerie cambiate:"; aggiungi "$MODIFICHE"; }
      [[ -n "$DRIFT" ]] && aggiungi "   Riallineate nell'immagine: $DRIFT"
      RIPR="cd $DIR"
      for x in "${BAK[@]}"; do RIPR+=" && cp ${x#*=} ${x%%=*}"; done
      [[ -n "$OLD_ID" ]] && RIPR+=" && docker tag $ROLLBACK_TAG $IMG"
      RIPR+=" && docker compose up -d --no-build $SERVICE"
      log "per tornare alla versione di prima: $RIPR"   # nell'email c'è il riquadro apposta
    fi
  fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# Gli altri servizi (coturn): immagine nuova se c'è, riavvio solo se cambiata
# ═════════════════════════════════════════════════════════════════════════════
aggiorna_immagine() {   # $1 servizio
  local svc="$1" img voluta prima dopo vprima vdopo tag
  img=$(immagine_di "$svc")                       # quella che gira
  [[ -z "$img" ]] && { log "$svc: non avviato, salto"; return 0; }
  voluta=$(immagine_compose "$svc"); voluta="${voluta:-$img}"   # quella che chiede il compose
  prima=$(id_di "$svc")
  vprima=$(versione "$svc")
  if [[ $DRY_RUN == 1 ]]; then
    log "dry-run: controllerei se c'è un'immagine nuova di $svc ($voluta)"
    [[ "$voluta" != "$img" ]] && log "dry-run: $svc gira con $img ma il docker-compose.yml chiede $voluta: lo cambierei"
    return 0
  fi
  if ! docker compose pull -q "$svc" > /dev/null 2>&1; then
    log "⚠ $svc: pull di $voluta non riuscito, resta com'è"
    peggiora errore
    aggiungi "❌ $svc: non sono riuscito a scaricare l'immagine nuova (resta quella di prima)."
    return 0
  fi
  dopo=$(docker image inspect -f '{{.Id}}' "$voluta" 2>/dev/null || true)
  if [[ -z "$dopo" || "$prima" == "$dopo" ]]; then
    log "$svc: già all'ultima versione${vprima:+ ($vprima)}"
    return 0
  fi
  tag="rollback/$PROGETTO-$svc:$STAMP"
  docker tag "$prima" "$tag"
  if [[ "$voluta" != "$img" ]]; then log "$svc: il docker-compose.yml ora chiede $voluta (gira $img), cambio…"
  else log "$svc: immagine nuova, riavvio…"; fi
  docker compose up -d "$svc" > /dev/null 2>&1
  if controlla "$svc"; then
    vdopo=$(versione "$svc")
    log "✅ $svc aggiornato${vprima:+: $vprima}${vdopo:+ → $vdopo}"
    peggiora ok
    aggiungi "✅ $svc aggiornato${vprima:+: $vprima}${vdopo:+ → $vdopo}"
    [[ "$voluta" != "$img" ]] && aggiungi "   (immagine cambiata: $img → $voluta)"
    docker rmi "$tag" > /dev/null 2>&1   # funziona: l'immagine vecchia non serve più
    [[ "$voluta" != "$img" ]] && { docker rmi "$img" > /dev/null 2>&1 || true; }
  else
    log "❌ $svc non resta su con l'immagine nuova: torno a quella di prima"
    peggiora rollback
    aggiungi "⚠ $svc: con l'immagine nuova ($voluta) non restava su. È tornato alla versione di prima."
    docker tag "$prima" "$voluta"   # il compose usa questo nome: ci rimetto sotto l'immagine di prima
    docker compose up -d --no-build "$svc" > /dev/null 2>&1
    docker rmi "$tag" > /dev/null 2>&1
  fi
  return 0
}
mapfile -t TUTTI < <(docker compose config --services 2>/dev/null)
for s in "${TUTTI[@]}"; do [[ "$s" == "$SERVICE" ]] || aggiorna_immagine "$s"; done

# ═════════════════════════════════════════════════════════════════════════════
# Pulizia di Docker (senza `prune -a`: le immagini di rollback restano)
#   • si tengono le ultime TIENI immagini <immagine>:rollback-*, alle più vecchie si
#     stacca solo il nome;
#   • `docker system prune -f` (SENZA -a e SENZA --volumes) toglie container fermi, reti
#     inutilizzate e immagini senza nome;
#   • la cache di build più vecchia di 7 giorni se ne va.
# ═════════════════════════════════════════════════════════════════════════════
if [[ $DRY_RUN == 0 ]]; then
  img=$(immagine_di "$SERVICE"); img="${img:-tdt-meet:latest}"
  vecchie=$(docker image ls --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep "^${img%%:*}:rollback-" | sort -r | tail -n +$((TIENI + 1)))
  [[ -n "$vecchie" ]] && { log "tolgo le immagini di rollback più vecchie (tengo le ultime $TIENI)"; echo "$vecchie" | xargs -r docker rmi > /dev/null 2>&1 || true; }
  docker system prune -f > /dev/null 2>&1 || true
  docker builder prune -f --filter until=168h > /dev/null 2>&1 || true
fi

# ═════════════════════════════════════════════════════════════════════════════
# Email di riepilogo (la manda Tiditalk, col suo SMTP del .env)
# ═════════════════════════════════════════════════════════════════════════════
json_str() {   # testo → stringa JSON
  local s; s=$(printf '%s' "$1" | tr -d '\000-\010\013\014\016-\037')
  s=${s//\\/\\\\}; s=${s//\"/\\\"}; s=${s//$'\t'/\\t}; s=${s//$'\r'/}; s=${s//$'\n'/\\n}
  printf '"%s"' "$s"
}
DURATA=$(( $(date +%s) - START_TS ))
log "esito: $ESITO (${DURATA}s)"
if [[ $DRY_RUN == 0 && ( "$ESITO" != "nessuno" || "$MAIL_SEMPRE" == "1" ) ]]; then
  [[ "$ESITO" == "nessuno" ]] && aggiungi "Era già tutto all'ultima versione."
  aggiungi ""
  aggiungi "Durata: $((DURATA / 60)) min $((DURATA % 60)) s · log sull'host $(hostname): $DIR/logs/"
  case "$ESITO" in ok) ST=ok ;; rollback) ST=rollback ;; errore) ST=error ;; *) ST=nessuno ;; esac
  PAYLOAD="{\"status\":\"$ST\",\"always\":true,\"rebuilt\":$( [[ $RICOSTRUITA == 1 ]] && echo true || echo false ),\"before\":$BEFORE,\"after\":$AFTER,\"duration\":$DURATA"
  [[ "$ST" != ok && "$ST" != nessuno ]] && PAYLOAD+=",\"error\":$(json_str "$RIEPILOGO")"
  PAYLOAD+=",\"rollbackInfo\":{\"dir\":$(json_str "$DIR"),\"service\":$(json_str "$SERVICE"),\"image\":$(json_str "${ROLLBACK_TAG:-}"),\"imageName\":$(json_str "${IMG:-}"),\"pkg\":$(json_str "backups/package.json.$STAMP.bak"),\"lock\":$(json_str "backups/package-lock.json.$STAMP.bak")}}"
  if RISP=$(printf '%s' "$PAYLOAD" | docker compose exec -T -e UPD_A="$MAIL_A" -e UPD_RIEPILOGO="$RIEPILOGO" -e UPD_RIPRISTINO="$RIPR" \
        "$SERVICE" node /app/server/update-report.js 2>&1); then
    log "email di riepilogo: $(printf '%s' "$RISP" | tail -1)"
  else
    log "⚠ email di riepilogo non inviata: $(printf '%s' "$RISP" | tail -1)"
  fi
fi
log "── fine ──"
[[ "$ESITO" == "errore" || "$ESITO" == "rollback" ]] && exit 1
exit 0
