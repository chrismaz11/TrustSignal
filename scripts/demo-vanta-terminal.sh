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

DEMO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_TMPDIR="$(mktemp -d "${TMPDIR:-/tmp}/trustsignal-vanta-demo.XXXXXX")"
DEMO_DB_USER="${TRUSTSIGNAL_DEMO_DB_USER:-$(id -un)}"
DEMO_DB_NAME="${TRUSTSIGNAL_DEMO_DB_NAME:-trustsignal_vanta_demo}"

if [[ -n "${TRUSTSIGNAL_DEMO_PG_PORT:-}" ]]; then
  DEMO_PG_PORT="${TRUSTSIGNAL_DEMO_PG_PORT}"
else
  DEMO_PG_PORT="$(
    node -e "const net=require('node:net'); const server=net.createServer(); server.listen(0,'127.0.0.1',()=>{console.log(server.address().port); server.close();});"
  )"
fi

PGDATA="$DEMO_TMPDIR/pgdata"
PGLOG="$DEMO_TMPDIR/postgres.log"
DATABASE_URL="postgresql://${DEMO_DB_USER}@127.0.0.1:${DEMO_PG_PORT}/${DEMO_DB_NAME}?sslmode=disable"
PG_STARTED=0

cleanup() {
  if [[ "$PG_STARTED" -eq 1 ]]; then
    pg_ctl -D "$PGDATA" stop -m fast >/dev/null 2>&1 || true
  fi
  rm -rf "$DEMO_TMPDIR"
}

trap cleanup EXIT INT TERM

initdb -D "$PGDATA" -A trust -U "$DEMO_DB_USER" >/dev/null
pg_ctl -D "$PGDATA" -l "$PGLOG" -o "-h 127.0.0.1 -p ${DEMO_PG_PORT}" start >/dev/null
PG_STARTED=1

createdb -h 127.0.0.1 -p "$DEMO_PG_PORT" -U "$DEMO_DB_USER" "$DEMO_DB_NAME"
psql "$DATABASE_URL" -Atc "select current_database(), current_user;" >/dev/null

(
  cd "$DEMO_ROOT"
  DATABASE_URL="$DATABASE_URL" npx tsx scripts/demo-vanta-terminal.ts
)
