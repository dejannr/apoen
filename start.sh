#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'HELP'
Usage: ./start.sh

Checks local setup, applies pending Prisma migrations, then runs the web app
and local worker together. Press Ctrl+C to stop both processes.

First run: create .env from .env.example, install npm dependencies, and run
the seed once with `npm run db:seed` if the database has no demo content.
HELP
  exit 0
fi

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example to .env and configure PostgreSQL and secrets first." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Missing node_modules. Run npm ci first." >&2
  exit 1
fi

echo "Applying pending database migrations..."
npm run db:deploy

app_pid=""
worker_pid=""

cleanup() {
  trap - INT TERM EXIT
  if [[ -n "$app_pid" ]]; then kill "$app_pid" 2>/dev/null || true; fi
  if [[ -n "$worker_pid" ]]; then kill "$worker_pid" 2>/dev/null || true; fi
  if [[ -n "$app_pid" ]]; then wait "$app_pid" 2>/dev/null || true; fi
  if [[ -n "$worker_pid" ]]; then wait "$worker_pid" 2>/dev/null || true; fi
}

is_running() {
  local state
  state="$(ps -o stat= -p "$1" 2>/dev/null | tr -d ' ')" || return 1
  [[ -n "$state" && "$state" != *Z* ]]
}

trap cleanup INT TERM EXIT

echo "Starting Next.js at http://localhost:3000 and the local worker. Press Ctrl+C to stop."
npm run dev &
app_pid=$!
npm run worker &
worker_pid=$!

while is_running "$app_pid" && is_running "$worker_pid"; do
  sleep 1
done

exit_code=0
if ! is_running "$app_pid"; then
  wait "$app_pid" || exit_code=$?
  echo "Next.js stopped; shutting down the worker." >&2
elif ! is_running "$worker_pid"; then
  wait "$worker_pid" || exit_code=$?
  echo "The local worker stopped; shutting down Next.js." >&2
fi

exit "$exit_code"
