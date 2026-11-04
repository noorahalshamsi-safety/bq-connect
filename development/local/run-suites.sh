#!/usr/bin/env bash
# Runs synthetic regression suites sequentially and prints one summary line each.
# Usage: development/local/run-suites.sh ["suite.cjs [args]" ...]   (default: baseline set)
# Logs: ~/bqlogs/<name>.log (WSL clears /tmp when idle). Requires: source ~/.local/bq-tools/env.sh
set -u
cd "$(dirname "$0")/../.."
logs="${BQ_LOG_DIR:-$HOME/bqlogs}"
mkdir -p "$logs"
suites=("$@")
if [ ${#suites[@]} -eq 0 ]; then
  suites=(
    scripts/migration/rel001/tests.cjs
    scripts/migration/rel001/boundary-tests.cjs
    scripts/postgres/e2e.cjs
    scripts/postgres/hardening.cjs
    scripts/postgres/phase2c-parity.cjs
    scripts/postgres/phase2c-background.cjs
  )
fi
for entry in "${suites[@]}"; do
  read -r -a cmd <<<"$entry"
  suite=${cmd[0]}
  name=$(basename "$suite" .cjs)
  [ "$name" = tests ] && name=$(basename "$(dirname "$suite")")-tests
  [ ${#cmd[@]} -gt 1 ] && name="$name-$(IFS=-; echo "${cmd[*]:1}")"
  log="$logs/$name.log"
  start=$(date +%s)
  timeout "${BQ_SUITE_TIMEOUT:-1800}" node "${cmd[@]}" > "$log" 2>&1
  code=$?
  pass=$(grep -cE '(^|[[:space:]])PASS([[:space:]]|$)' "$log")
  fail=$(grep -cE '(^|[[:space:]])FAIL([[:space:]]|$)' "$log")
  echo "$entry exit=$code seconds=$(( $(date +%s) - start )) pass_lines=$pass fail_lines=$fail"
  grep -E '(^|[[:space:]])(FAIL|BLOCKED)([[:space:]]|$)' "$log" | head -10
  tail -1 "$log" | cut -c1-400
done
