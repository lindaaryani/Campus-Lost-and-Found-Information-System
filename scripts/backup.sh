#!/usr/bin/env bash
# NFR-11: cadangan basis data + berkas unggahan.
#   ./scripts/backup.sh [direktori_tujuan]      (default: ./backups)
# Jadwalkan dengan cron (contoh: tiap hari 02:00):  0 2 * * * cd /path/campusfind && ./scripts/backup.sh /var/backups/campusfind
# Kata sandi DB dibaca dari env (DB_PASSWORD) dan diteruskan lewat MYSQL_PWD, bukan argumen baris perintah.
set -euo pipefail
cd "$(dirname "$0")/.."
. ./scripts/_env.sh; load_env_file ./.env.local
DEST="${1:-./backups}"; STAMP="$(date +%Y%m%d-%H%M%S)"; OUT="$DEST/campusfind-$STAMP"
KEEP="${BACKUP_KEEP:-14}"
mkdir -p "$OUT"
export MYSQL_PWD="${DB_PASSWORD:-}"
mysqldump -h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "${DB_USER:-campusfind}" \
  --single-transaction --routines --default-character-set=utf8mb4 "${DB_NAME:-campusfind}" | gzip > "$OUT/database.sql.gz"
if [ -d "${STORAGE_DIR:-./storage}" ]; then tar -czf "$OUT/storage.tar.gz" -C "${STORAGE_DIR:-./storage}" .; fi
( cd "$OUT" && sha256sum * > SHA256SUMS )
echo "Backup selesai: $OUT"
# Rotasi: simpan $KEEP cadangan terbaru
ls -1dt "$DEST"/campusfind-* 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -rf
