#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# install-cron.sh — dalla 1.8.9 la pianificazione è installa-aggiornamento.sh:
# ogni notte alle 05:00, ora italiana. Questo resta per chi lo lancia ancora e
# passa tutto a lui (bash install-cron.sh 4, --status, --remove).
# ═════════════════════════════════════════════════════════════════════════════
cd "$(dirname "$0")" || exit 1
exec bash installa-aggiornamento.sh "$@"
