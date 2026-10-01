#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# install-cron.sh — pianifica l'aggiornamento automatico ogni giorno
#
#   bash install-cron.sh            → ogni giorno alle 08:00
#   bash install-cron.sh 6          → ogni giorno alle 06:00
#   bash install-cron.sh --status   → dice se è attivo, quando gira e l'ultimo esito
#   bash install-cron.sh --remove   → toglie la pianificazione
#
# Usa un TIMER SYSTEMD quando c'è systemd (quasi sempre, anche nei container
# LXC di Proxmox): non dipende dal pacchetto `cron`, che nei container spesso
# non è installato o non è avviato — ed era il motivo per cui gli
# aggiornamenti non partivano. In più il timer è "Persistent": se all'ora
# stabilita il server era spento, l'aggiornamento parte appena si riaccende.
# Se systemd non c'è, ripiega su cron (e controlla che cron giri davvero).
#
# Il log finisce in ./logs/auto-update.log
# ═════════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"
DIR="$(pwd)"
UNIT="tiditalk-auto-update"
MARK="# tiditalk-auto-update"
LOG="$DIR/logs/auto-update.log"

has_systemd() { [[ -d /run/systemd/system ]] && command -v systemctl > /dev/null 2>&1; }

remove_all() {
  if has_systemd; then
    systemctl disable --now "$UNIT.timer" > /dev/null 2>&1 || true
    rm -f "/etc/systemd/system/$UNIT.service" "/etc/systemd/system/$UNIT.timer"
    systemctl daemon-reload || true
  fi
  if command -v crontab > /dev/null 2>&1; then
    (crontab -l 2>/dev/null | grep -v "$MARK" || true) | crontab - || true
  fi
}

status() {
  echo "── Aggiornamento automatico ──"
  if has_systemd && [[ -f "/etc/systemd/system/$UNIT.timer" ]]; then
    echo "Metodo: timer systemd ($(systemctl is-enabled "$UNIT.timer" 2>/dev/null || echo '?'))"
    systemctl list-timers "$UNIT.timer" --no-pager 2>/dev/null | sed -n '1,2p'
  elif command -v crontab > /dev/null 2>&1 && crontab -l 2>/dev/null | grep -q "$MARK"; then
    echo "Metodo: cron"
    crontab -l | grep "$MARK"
    if pgrep -x cron > /dev/null 2>&1 || pgrep -x crond > /dev/null 2>&1; then echo "Servizio cron: in esecuzione"
    else echo "⚠ Servizio cron: NON in esecuzione (il job non partirà)"; fi
  else
    echo "⚠ NON pianificato. Lancia: bash install-cron.sh"
  fi
  echo
  if [[ -s "$LOG" ]]; then
    echo "Ultime righe del log ($LOG):"
    tail -n 8 "$LOG"
  else
    echo "Log vuoto: l'aggiornamento automatico non è mai partito da solo."
  fi
}

case "${1:-}" in
  --remove) remove_all; echo "Pianificazione rimossa."; exit 0 ;;
  --status) status; exit 0 ;;
esac

HOUR="${1:-8}"
if ! [[ "$HOUR" =~ ^[0-9]{1,2}$ ]] || (( HOUR > 23 )); then echo "Ora non valida: $HOUR (0-23)"; exit 2; fi
HH=$(printf '%02d' "$HOUR")
mkdir -p "$DIR/logs"
chmod +x "$DIR/auto-update.sh" 2>/dev/null || true

# via eventuali pianificazioni precedenti (anche cron vecchi), poi la nuova
remove_all

if has_systemd; then
  if [[ $EUID -ne 0 ]]; then echo "Serve root per installare il timer systemd (usa sudo)."; exit 1; fi
  cat > "/etc/systemd/system/$UNIT.service" <<EOF
[Unit]
Description=Tiditalk: aggiornamento automatico delle dipendenze
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=oneshot
WorkingDirectory=$DIR
# docker compose vuole HOME per la sua configurazione; PATH esplicito per curl/flock/docker
Environment=HOME=/root
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/bin/bash -c 'bash "$DIR/auto-update.sh" >> "$LOG" 2>&1'
TimeoutStartSec=3h
EOF
  cat > "/etc/systemd/system/$UNIT.timer" <<EOF
[Unit]
Description=Tiditalk: aggiornamento automatico ogni giorno alle $HH:00

[Timer]
OnCalendar=*-*-* $HH:00:00
Persistent=true
RandomizedDelaySec=120

[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
  systemctl enable --now "$UNIT.timer" > /dev/null
  echo "✅ Timer systemd installato: ogni giorno alle $HH:00"
  systemctl list-timers "$UNIT.timer" --no-pager | sed -n '1,2p'
else
  if ! command -v crontab > /dev/null 2>&1; then
    echo "❌ Né systemd né cron disponibili. Installa cron:"
    echo "     apt-get install -y cron && service cron start"
    exit 1
  fi
  LINE="0 $HOUR * * * cd $DIR && /usr/bin/flock -n /tmp/tiditalk-auto-update.cron bash auto-update.sh >> $LOG 2>&1 $MARK"
  ( crontab -l 2>/dev/null | grep -v "$MARK" || true ; echo "$LINE" ) | crontab -
  echo "✅ Cron installato: ogni giorno alle $HH:00"
  if ! pgrep -x cron > /dev/null 2>&1 && ! pgrep -x crond > /dev/null 2>&1; then
    echo "⚠ Il servizio cron NON è in esecuzione: avvialo con  service cron start"
  fi
fi

echo
echo "Stato:    bash install-cron.sh --status"
echo "Log:      tail -f $LOG"
echo "Prova:    bash auto-update.sh --dry-run"
echo "Adesso:   systemctl start $UNIT.service   (o bash auto-update.sh)"
echo "Rimuovi:  bash install-cron.sh --remove"
