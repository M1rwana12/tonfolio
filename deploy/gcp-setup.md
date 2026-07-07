# Production deploy — GCP e2-micro (always-free)

The VM (`tonfolio`, us-central1-a, Debian 12, 34.57.254.219, swap 1 GB, Docker)
is provisioned by `gcp-startup.sh`. Firewall allows 80/443.

## 1. Build the image

GitHub Actions → **Build image** workflow (`deploy.yml`, manual dispatch) →
pushes `ghcr.io/m1rwana12/tonfolio:latest`.

## 2. Prepare the VM (once)

```bash
gcloud compute ssh tonfolio --project=tonfolio-demo-0706 --zone=us-central1-a

sudo mkdir -p /opt/tonfolio && sudo chown "$USER" /opt/tonfolio && cd /opt/tonfolio
# copy deploy/compose.prod.yml → compose.yml, deploy/Caddyfile, deploy/backup.sh here

# ghcr auth (classic PAT with read:packages, or `gh auth token` output)
echo "<GHCR_TOKEN>" | sudo docker login ghcr.io -u M1rwana12 --password-stdin
```

`.env` next to compose.yml:

```env
POSTGRES_PASSWORD=<random>
DATABASE_URL=postgresql://tonfolio:<same-random>@postgres:5432/tonfolio
REDIS_URL=redis://redis:6379
BOT_TOKEN=<from BotFather>
BOT_MODE=webhook
APP_DOMAIN=34.57.254.219.sslip.io
APP_URL=https://34.57.254.219.sslip.io
WEB_APP_URL=https://34.57.254.219.sslip.io
WEBHOOK_SECRET=<random, [A-Za-z0-9_-]{32}>
TONAPI_KEY=
COINGECKO_API_KEY=
```

sslip.io maps `<ip>.sslip.io` → the IP, so Caddy can obtain a certificate
without owning a domain. Swap `APP_DOMAIN`/URLs for a real domain when there
is one (and update `apps/web/public/tonconnect-manifest.json` accordingly).

## 3. First deploy

```bash
cd /opt/tonfolio
sudo docker compose pull
# schema push (one-off)
sudo docker compose run --rm bot \
  ./node_modules/.bin/prisma db push --schema packages/db/prisma/schema.prisma
sudo docker compose up -d
sudo docker compose logs -f bot   # expect "webhook registered"
```

Checks:

```bash
curl -s https://$APP_DOMAIN/api/health          # {"status":"ok",...} (web)
sudo docker stats --no-stream                    # memory within caps
curl -s "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"
```

## 4. Updates

Re-run the **Build image** workflow, then on the VM:
`sudo docker compose pull && sudo docker compose up -d`.

## 5. Backups

```bash
gcloud storage buckets create gs://tonfolio-backups --location=us-central1
chmod +x /opt/tonfolio/backup.sh
( sudo crontab -l; echo "0 3 * * * /opt/tonfolio/backup.sh >> /var/log/tonfolio-backup.log 2>&1" ) | sudo crontab -
```

The VM's default service account needs `roles/storage.objectAdmin` on the
bucket (grant once in IAM).
