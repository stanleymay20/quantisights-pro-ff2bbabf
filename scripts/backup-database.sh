#!/bin/bash
set -e

# Database backup script
# Usage: ./backup-database.sh [environment]

ENVIRONMENT=${1:-production}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/quantivis_${ENVIRONMENT}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "💾 Creating database backup for $ENVIRONMENT..."

# Load environment
export $(cat ".env.${ENVIRONMENT}" | grep SUPABASE | xargs)

# Extract host, user, password from connection string
SUPABASE_HOST=$(echo $VITE_SUPABASE_URL | sed 's/.*https:\/\///;s/.supabase.co.*//')

# Create backup using pg_dump
pg_dump \
  --host="${SUPABASE_HOST}.supabase.co" \
  --username="postgres" \
  --password="$SUPABASE_DB_PASSWORD" \
  --dbname="postgres" \
  --verbose \
  --format=plain \
  | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ Backup created: $BACKUP_FILE ($SIZE)"
  
  # Upload to cloud storage
  echo "📤 Uploading backup to cloud storage..."
  az storage blob upload \
    --account-name "quantivisbackups" \
    --container-name "${ENVIRONMENT}" \
    --name "db_backup_${TIMESTAMP}.sql.gz" \
    --file "$BACKUP_FILE"
  
  echo "✅ Backup uploaded to Azure Storage"
  
  # Keep only last 7 backups locally
  echo "🧹 Cleaning old backups..."
  ls -t ${BACKUP_DIR}/quantivis_${ENVIRONMENT}_*.sql.gz | tail -n +8 | xargs -r rm
else
  echo "❌ Backup failed"
  exit 1
fi
