#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# auto-update.sh — dalla 1.8.9 l'aggiornamento automatico è aggiorna-tutto.sh.
# Questo resta perché la pianificazione fatta con install-cron.sh fino alla 1.8.8
# lancia ancora lui: passa tutto ad aggiorna-tutto.sh, stesse opzioni (--dry-run, --force).
# Per passare alla pianificazione nuova (ogni notte alle 05:00):  bash installa-aggiornamento.sh
# ═════════════════════════════════════════════════════════════════════════════
cd "$(dirname "$0")" || exit 1
exec bash aggiorna-tutto.sh "$@"
