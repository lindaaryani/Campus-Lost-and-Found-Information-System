#!/usr/bin/env bash
# NFR-16: pemulihan dari hasil backup.sh.
#   CONFIRM_RESTORE=yes ./scripts/restore.sh ./backups/campusfind-YYYYMMDD-HHMMSS
# PERINGATAN: menimpa isi database dan folder storage saat ini. Hentikan aplikasi terlebih dahulu.
set -euo pipefail
cd "$(dirname "$0")/.."
[ "${CONFIRM_RESTORE:-}" = "yes" ] || { echo "Set CONFIRM_RESTORE=yes untuk melanjutkan (data saat ini akan ditimpa)."; exit 1; }
SRC="${1:?Sebutkan direktori backup}"
. ./scripts/_env.sh; load_env_file ./.env.local
( cd "$SRC" && sha256sum -c SHA256SUMS )
export MYSQL_PWD="${DB_PASSWORD:-}"
gunzip -c "$SRC/database.sql.gz" | mysql -h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "${DB_USER:-campusfind}" "${DB_NAME:-campusfind}"
if [ -f "$SRC/storage.tar.gz" ]; then
  mkdir -p "${STORAGE_DIR:-./storage}" && tar -xzf "$SRC/storage.tar.gz" -C "${STORAGE_DIR:-./storage}"
fi
echo "Pemulihan selesai dari $SRC"
