#!/bin/bash
# Nightly Postgres dump → Google Cloud Storage (free tier: 5 GB).
# Cron (on the VM): 0 3 * * * /opt/tonfolio/backup.sh >> /var/log/tonfolio-backup.log 2>&1
set -euo pipefail

BUCKET="${BACKUP_BUCKET:-gs://tonfolio-backups}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
FILE="/tmp/tonfolio-${STAMP}.sql.gz"

sudo docker exec "$(sudo docker ps -qf name=postgres)" \
  pg_dump -U tonfolio tonfolio | gzip >"${FILE}"

gcloud storage cp "${FILE}" "${BUCKET}/${STAMP}.sql.gz"
rm -f "${FILE}"

# keep the last 14 dumps
gcloud storage ls "${BUCKET}" | sort | head -n -14 | while read -r old; do
  gcloud storage rm "${old}"
done
