#!/usr/bin/env bash
set -euo pipefail

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

for cmd in initdb pg_ctl createdb psql node npm; do
  require_cmd "$cmd"
done

SMOKE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMOKE_TMPDIR="$(mktemp -d "${TMPDIR:-/tmp}/trustsignal-signed-receipt.XXXXXX")"
SMOKE_DB_USER="${TRUSTSIGNAL_SMOKE_DB_USER:-$(id -un)}"
SMOKE_DB_NAME="${TRUSTSIGNAL_SMOKE_DB_NAME:-trustsignal_signed_receipt_smoke}"

if [[ -n "${TRUSTSIGNAL_SMOKE_PG_PORT:-}" ]]; then
  SMOKE_PG_PORT="${TRUSTSIGNAL_SMOKE_PG_PORT}"
else
  SMOKE_PG_PORT="$(
    node -e "const net=require('node:net'); const server=net.createServer(); server.listen(0,'127.0.0.1',()=>{console.log(server.address().port); server.close();});"
  )"
fi

PGDATA="$SMOKE_TMPDIR/pgdata"
PGLOG="$SMOKE_TMPDIR/postgres.log"
DATABASE_URL="postgresql://${SMOKE_DB_USER}@127.0.0.1:${SMOKE_PG_PORT}/${SMOKE_DB_NAME}?sslmode=disable"
PG_STARTED=0

cleanup() {
  if [[ "$PG_STARTED" -eq 1 ]]; then
    pg_ctl -D "$PGDATA" stop -m fast >/dev/null 2>&1 || true
  fi
  rm -rf "$SMOKE_TMPDIR"
}

trap cleanup EXIT INT TERM

initdb -D "$PGDATA" -A trust -U "$SMOKE_DB_USER" >/dev/null
pg_ctl -D "$PGDATA" -l "$PGLOG" -o "-h 127.0.0.1 -p ${SMOKE_PG_PORT}" start >/dev/null
PG_STARTED=1

createdb -h 127.0.0.1 -p "$SMOKE_PG_PORT" -U "$SMOKE_DB_USER" "$SMOKE_DB_NAME"
psql "$DATABASE_URL" -Atc "select current_database(), current_user;" >/dev/null

echo "Running signed-receipt smoke test against $DATABASE_URL"
(
  cd "$SMOKE_ROOT/apps/api"
  DATABASE_URL="$DATABASE_URL" npx vitest run --config vitest.config.ts src/v2-integration.test.ts
)
