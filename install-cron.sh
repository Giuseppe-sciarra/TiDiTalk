#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# install-cron.sh — mette (o toglie) il cron dell'aggiornamento automatico
#
#   bash install-cron.sh            → ogni giorno alle 08:00
#   bash install-cron.sh 6          → ogni giorno alle 06:00
#   bash install-cron.sh --remove   → toglie il cron
#
# Il log finisce in ./logs/auto-update.log (ruotato a 2 MB).
# ═════════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"
DIR="$(pwd)"
MARK="# tiditalk-auto-update"

if [[ "${1:-}" == "--remove" ]]; then
  crontab -l 2>/dev/null | grep -v "$MARK" | crontab - || true
  echo "Cron rimosso."
  crontab -l 2>/dev/null | grep -c "$MARK" >/dev/null || true
  exit 0
fi

HOUR="${1:-8}"
[[ "$HOUR" =~ ^[0-9]{1,2}$ ]] || { echo "Ora non valida: $HOUR"; exit 2; }

mkdir -p "$DIR/logs"
LINE="0 $HOUR * * * cd $DIR && /usr/bin/flock -n /tmp/tiditalk-auto-update.cron bash auto-update.sh >> $DIR/logs/auto-update.log 2>&1 $MARK"

( crontab -l 2>/dev/null | grep -v "$MARK" ; echo "$LINE" ) | crontab -
echo "Cron installato: ogni giorno alle $HOUR:00"
echo "  $LINE"
echo
echo "Log:      tail -f $DIR/logs/auto-update.log"
echo "Prova:    bash auto-update.sh --dry-run"
echo "Rimuovi:  bash install-cron.sh --remove"
