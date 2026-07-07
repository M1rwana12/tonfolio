#!/bin/bash
# One-shot deploy to the GCP e2-micro from a developer machine (Git Bash).
# Usage: bash deploy/deploy.sh [path-to-env-file]   (default: deploy/local/.env)
set -euo pipefail

KEY="$HOME/.ssh/google_compute_engine"
HOST="senja@34.57.254.219"
DOMAIN="34.57.254.219.sslip.io"
DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${1:-$DIR/local/.env}"

[ -f "$ENV_FILE" ] || { echo "env file not found: $ENV_FILE"; exit 1; }

run() { ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$HOST" "$@"; }

echo "— preparing /opt/tonfolio"
run 'sudo mkdir -p /opt/tonfolio && sudo chown $USER /opt/tonfolio'

echo "— copying compose, Caddyfile, backup script and .env"
scp -i "$KEY" "$DIR/compose.prod.yml" "$HOST:/opt/tonfolio/compose.yml"
scp -i "$KEY" "$DIR/Caddyfile" "$DIR/backup.sh" "$HOST:/opt/tonfolio/"
scp -i "$KEY" "$ENV_FILE" "$HOST:/opt/tonfolio/.env"
run 'chmod 600 /opt/tonfolio/.env && chmod +x /opt/tonfolio/backup.sh'

echo "— ghcr login (token from gh cli)"
GHCR_TOKEN="$(gh auth token)"
run "echo '$GHCR_TOKEN' | sudo docker login ghcr.io -u M1rwana12 --password-stdin"

echo "— pulling images"
run 'cd /opt/tonfolio && sudo docker compose pull --quiet'

echo "— pushing schema and seeding"
run 'cd /opt/tonfolio && sudo docker compose run --rm --workdir /app/packages/db bot ./node_modules/.bin/prisma db push'
run 'cd /opt/tonfolio && sudo docker compose run --rm --workdir /app/packages/db bot ./node_modules/.bin/tsx prisma/seed.ts'

echo "— starting services"
run 'cd /opt/tonfolio && sudo docker compose up -d'

echo "— waiting for TLS + services (45s)"
sleep 45

echo "— docker stats"
run 'sudo docker stats --no-stream'

echo "— health checks"
curl -sS "https://$DOMAIN/api/health" && echo
run 'curl -s http://localhost:8080/health' && echo

echo "✅ deploy finished — check the bot in Telegram"
