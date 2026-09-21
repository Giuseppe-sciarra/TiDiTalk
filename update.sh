#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
echo "Back up runtime volumes and .env before upgrading."
docker compose config --quiet
docker compose up -d --build
docker compose ps
