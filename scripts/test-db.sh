#!/usr/bin/env bash
# Starts a throwaway local Postgres, applies stubs + all migrations, runs the DB test suite.
# Requires Postgres server binaries (initdb/pg_ctl). Works as root (uses the `postgres` OS user for the server) or as a normal user.
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)"; export PATH="$PGBIN:$PATH"
DIR="${TMPDIR:-/tmp}/bwy-pg-$$"; PORT="${PGPORT_TEST:-54329}"
RUN=""
if [ "$(id -u)" = "0" ]; then id postgres >/dev/null 2>&1 || useradd -m postgres; mkdir -p "$DIR"; chown postgres "$DIR"; RUN="runuser -u postgres --"; fi
$RUN initdb -D "$DIR/d" -U postgres --auth=trust >/dev/null
$RUN pg_ctl -D "$DIR/d" -o "-p $PORT -k $DIR" -l "$DIR/log" -w start >/dev/null
trap '$RUN pg_ctl -D "$DIR/d" -m immediate stop >/dev/null 2>&1; rm -rf "$DIR"' EXIT
export TEST_DATABASE_URL="postgres://postgres@127.0.0.1:$PORT/postgres"
npx vitest run tests/db "$@"
