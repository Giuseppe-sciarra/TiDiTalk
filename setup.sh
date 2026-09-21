#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
command -v docker >/dev/null || { echo "Install Docker Engine and Compose first."; exit 1; }
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env. Fill secrets, network settings and USERS using README.md, then rerun."
  exit 0
fi
docker compose config --quiet
docker compose up -d --build
