#!/usr/bin/env bash
# Aplica shim + migrations + seeds em um PostgreSQL local e roda os testes SQL.
# Uso: DATABASE_URL=postgres://postgres@localhost:5432/postgres ./database/scripts/test-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ADMIN_URL="${DATABASE_URL:-postgres://postgres@localhost:5432/postgres}"
DB="karolla_test_$$"
psql "$ADMIN_URL" -q -c "create database $DB"
trap 'psql "$ADMIN_URL" -q -c "drop database if exists $DB"' EXIT
URL="${ADMIN_URL%/*}/$DB"
for f in local/supabase_shim.sql migrations/*.sql seed/*.sql tests/*.test.sql; do
  echo "→ $f"
  psql "$URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "✅ Banco validado"
