#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
host_root="${DSH_PTY_HOST_ROOT:-$repo_root/.test-results/public-dsh-smoke/host}"
dsh_home="${DSH_PTY_HOME:-$repo_root/.test-results/public-dsh-smoke/home}"
profile="${DSH_PTY_PROFILE:-tui-public-smoke}"
output_root="${DSH_PTY_OUTPUT_DIR:-$repo_root/.test-results/public-dsh-smoke}"
dsh_bin="$host_root/node_modules/@deepseek-ai/dsh/lib/bin.js"
node_bin="${NODE:-$(command -v node)}"
capture="$output_root/interactive.typescript"
readable="$output_root/interactive.strings"

test -f "$dsh_bin"
command -v script >/dev/null
command -v strings >/dev/null
mkdir -p "$output_root"

set +e
{
  sleep 3
  printf '/memories\r'
  sleep 1
  printf '\016'
  sleep 1
  printf '\010'
  sleep 2
  printf '/sessions\r'
  sleep 1
  printf '\033[A\r'
  sleep 1
  printf '\003'
  sleep 0.2
  printf '\003'
} | timeout 15s script -q -e -c \
  "cd '$host_root' && env TERM=xterm-256color DSH_HOME='$dsh_home' DEEPSEEK_API_KEY=dummy '$node_bin' '$dsh_bin' --profile '$profile'" \
  "$capture" >/dev/null 2>&1
launch_status="${PIPESTATUS[1]}"
set -e

test "$launch_status" -eq 0
strings -a "$capture" > "$readable"
grep -F 'Memory is not available in this' "$readable"
grep -F 'New session session-' "$readable"
grep -F 'assistant' "$readable"
grep -F 'Sessions' "$readable"
! grep -F 'fatal load failure' "$readable"
! grep -F 'setPrompt is not a function' "$readable"
! grep -F 'TUI prompt value' "$readable"

echo 'Verified interactive TUI startup, commands, session switching, and shutdown through a real PTY.'
