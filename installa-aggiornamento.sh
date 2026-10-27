#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# installa-aggiornamento.sh — pianifica aggiorna-tutto.sh ogni notte
#
#   bash installa-aggiornamento.sh            → ogni notte alle 05:00
#   bash installa-aggiornamento.sh 4          → ogni notte alle 04:00
#   bash installa-aggiornamento.sh 4:30       → ogni notte alle 04:30
#   bash installa-aggiornamento.sh --status   → se è attivo, quando gira e l'ultimo esito
#   bash installa-aggiornamento.sh --remove   → toglie la pianificazione
#
# Usa un TIMER SYSTEMD (c'è anche nei container LXC di Proxmox): è "Persistent", quindi se
# all'ora stabilita il server era spento l'aggiornamento parte appena si riaccende.
# Se systemd non c'è ripiega su cron. Il log finisce in ./logs/aggiorna-tutto.log
#
# Perché le 05:00: a quell'ora non c'è nessuno in riunione (e se qualcuno c'è, aggiorna-tutto.sh
# rimanda da solo).
#
# Prende il posto di install-cron.sh (fino alla 1.8.8, ogni mattina alle 08:00): la
# pianificazione vecchia si toglie da sola, così non girano in due.
# ═════════════════════════════════════════════════════════════════════════════
PROGETTO="tiditalk"
NOME="Tiditalk"
ORA_DEF="5:00"
set -euo pipefail
cd "$(dirname "$0")" || exit 1
DIR="$(pwd)"
UNIT="$PROGETTO-aggiorna-tutto"
CRON="/etc/cron.d/$PROGETTO-aggiorna-tutto"
LOG="$DIR/logs/aggiorna-tutto.log"
VECCHIA_UNIT="tiditalk-auto-update"          # install-cron.sh, fino alla 1.8.8
VECCHIO_SEGNO="# tiditalk-auto-update"       # la sua riga nel crontab di root

has_systemd() { [[ -d /run/systemd/system ]] && command -v systemctl > /dev/null 2>&1; }

remove_all() {
  if has_systemd; then
    for u in "$UNIT" "$VECCHIA_UNIT"; do
      systemctl disable --now "$u.timer" > /dev/null 2>&1 || true
      rm -f "/etc/systemd/system/$u.service" "/etc/systemd/system/$u.timer"
    done
    systemctl daemon-reload || true
  fi
  rm -f "$CRON"
  if command -v crontab > /dev/null 2>&1 && crontab -l 2>/dev/null | grep -qF "$VECCHIO_SEGNO"; then
    (crontab -l 2>/dev/null | grep -vF "$VECCHIO_SEGNO" || true) | crontab - || true
  fi
}

status() {
  echo "── Aggiornamento automatico di $NOME ──"
  if has_systemd && [[ -f "/etc/systemd/system/$UNIT.timer" ]]; then
    echo "Metodo: timer systemd ($(systemctl is-enabled "$UNIT.timer" 2>/dev/null || echo '?'))"
    systemctl list-timers "$UNIT.timer" --no-pager 2>/dev/null | sed -n '1,2p'
  elif [[ -f "$CRON" ]]; then
    echo "Metodo: cron"; cat "$CRON"
    if ! pgrep -x cron > /dev/null 2>&1 && ! pgrep -x crond > /dev/null 2>&1; then echo "⚠ Il servizio cron NON è in esecuzione (il job non partirà)"; fi
  else
    echo "⚠ NON pianificato. Lancia: bash installa-aggiornamento.sh"
  fi
  if { has_systemd && [[ -f "/etc/systemd/system/$VECCHIA_UNIT.timer" ]]; } \
     || { command -v crontab > /dev/null 2>&1 && crontab -l 2>/dev/null | grep -qF "$VECCHIO_SEGNO"; }; then
    echo "⚠ C'è ancora la pianificazione vecchia di install-cron.sh: lancia bash installa-aggiornamento.sh per passare a questa."
  fi
  echo
  if [[ -s "$LOG" ]]; then
    echo "Ultime righe del log ($LOG):"
    tail -n 12 "$LOG"
  else
    echo "Log vuoto: l'aggiornamento automatico non è ancora partito."
  fi
}

case "${1:-}" in
  --remove) remove_all; echo "Pianificazione rimossa."; exit 0 ;;
  --status) status; exit 0 ;;
esac

if [[ $EUID -ne 0 ]]; then echo "Serve root."; exit 1; fi
ORA="${1:-$ORA_DEF}"
if ! [[ "$ORA" =~ ^([0-9]{1,2})(:([0-9]{2}))?$ ]] || (( 10#${BASH_REMATCH[1]} > 23 || 10#${BASH_REMATCH[3]:-0} > 59 )); then
  echo "Ora non valida: $ORA (es. 5 oppure 5:00)"; exit 2
fi
H=$((10#${BASH_REMATCH[1]})); M=$((10#${BASH_REMATCH[3]:-0}))
HHMM=$(printf '%02d:%02d' "$H" "$M")
mkdir -p "$DIR/logs"
chmod +x "$DIR/aggiorna-tutto.sh"

remove_all

if has_systemd; then
  cat > "/etc/systemd/system/$UNIT.service" <<EOF
[Unit]
Description=$NOME: aggiornamento automatico di tutto
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=oneshot
WorkingDirectory=$DIR
# docker compose vuole HOME per la sua configurazione; PATH esplicito per curl/flock/docker
Environment=HOME=/root
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/bin/bash -c 'bash "$DIR/aggiorna-tutto.sh" >> "$LOG" 2>&1'
TimeoutStartSec=3h
EOF
  cat > "/etc/systemd/system/$UNIT.timer" <<EOF
[Unit]
Description=$NOME: aggiornamento automatico ogni notte alle $HHMM

[Timer]
# ora italiana anche se il CT è in UTC (cambio ora legale/solare compreso)
OnCalendar=*-*-* $HHMM:00 Europe/Rome
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
  systemctl enable --now "$UNIT.timer" > /dev/null
  echo "✅ Timer systemd installato: ogni notte alle $HHMM"
  systemctl list-timers "$UNIT.timer" --no-pager | sed -n '1,2p'
else
  { echo "CRON_TZ=Europe/Rome"; echo "$M $H * * * root cd $DIR && /usr/bin/flock -n /tmp/$UNIT.cron bash aggiorna-tutto.sh >> $LOG 2>&1"; } > "$CRON"
  echo "✅ Cron installato: ogni notte alle $HHMM"
  if ! pgrep -x cron > /dev/null 2>&1 && ! pgrep -x crond > /dev/null 2>&1; then
    echo "⚠ Il servizio cron NON è in esecuzione: avvialo con  systemctl enable --now cron"
  fi
fi

echo
echo "Stato:    bash installa-aggiornamento.sh --status"
echo "Log:      tail -f $LOG"
echo "Prova:    bash aggiorna-tutto.sh --dry-run"
echo "Adesso:   bash aggiorna-tutto.sh"
echo "Rimuovi:  bash installa-aggiornamento.sh --remove"
