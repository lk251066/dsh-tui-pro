#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
host_root="${DSH_PTY_HOST_ROOT:-$repo_root/.test-results/public-dsh-smoke/host}"
dsh_home="${DSH_PTY_HOME:-$repo_root/.test-results/public-dsh-smoke/home}"
profile="${DSH_PTY_PROFILE:-tui-public-smoke}"
output_root="${DSH_PTY_OUTPUT_DIR:-$repo_root/.test-results/public-dsh-smoke}"
timeout_seconds="${DSH_PTY_TIMEOUT:-45}"
dsh_bin="${DSH_PTY_DSH_BIN:-$host_root/node_modules/@deepseek-ai/dsh/lib/bin.js}"
node_bin="${NODE:-$(command -v node)}"
capture="$output_root/interactive.typescript"
readable="$output_root/interactive.strings"

test -f "$dsh_bin"
command -v python3 >/dev/null
mkdir -p "$output_root"

python3 "$repo_root/scripts/drive-interactive-pty.py" \
  --capture "$capture" \
  --cwd "$host_root" \
  --timeout "$timeout_seconds" \
  --env TERM=xterm-256color \
  --env DSH_HOME="$dsh_home" \
  --env DEEPSEEK_API_KEY=dummy \
  -- "$node_bin" "$dsh_bin" --profile "$profile"
"$node_bin" "$repo_root/scripts/render-pty-capture.mjs" "$capture" "$readable"
grep -aqF 'Memory is not available in this' "$capture"
grep -aqF 'New session session-' "$capture"
grep -aqF 'assistant' "$capture"
grep -qF 'Workspace' "$readable"
grep -qF 'Sessions' "$readable"
grep -qF 'Status' "$readable"
grep -qF 'Queue' "$readable"
grep -qF 'Perm' "$readable"
grep -qF 'Plan' "$readable"
! grep -aqF 'fatal load failure' "$capture"
! grep -aqF 'setPrompt is not a function' "$capture"
! grep -aqF 'TUI prompt value' "$capture"
! grep -aqF 'ERR_MODULE_NOT_FOUND' "$capture"

echo 'Verified persistent sidebar rendering, commands, session switching, and shutdown through a real PTY.'
