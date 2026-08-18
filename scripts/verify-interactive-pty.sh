#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
host_root="${DSH_PTY_HOST_ROOT:-$repo_root/.test-results/public-dsh-smoke/host}"
dsh_home="${DSH_PTY_HOME:-$repo_root/.test-results/public-dsh-smoke/home}"
profile="${DSH_PTY_PROFILE:-tui-public-smoke}"
output_root="${DSH_PTY_OUTPUT_DIR:-$repo_root/.test-results/public-dsh-smoke}"
timeout_seconds="${DSH_PTY_TIMEOUT:-120}"
columns="${DSH_PTY_COLUMNS:-140}"
rows="${DSH_PTY_ROWS:-32}"
dsh_bin="${DSH_PTY_DSH_BIN:-$host_root/node_modules/@deepseek-ai/dsh/lib/bin.js}"
node_bin="${NODE:-$(command -v node)}"
capture="$output_root/interactive.typescript"
readable="$output_root/interactive.strings"
export_path="$output_root/pty-export.md"

rm -f "$export_path"
trap 'rm -f "$export_path"' EXIT

test -f "$dsh_bin"
command -v python3 >/dev/null
mkdir -p "$output_root"

python3 "$repo_root/scripts/drive-interactive-pty.py" \
  --capture "$capture" \
  --cwd "$host_root" \
  --timeout "$timeout_seconds" \
  --columns "$columns" \
  --rows "$rows" \
  --env TERM=xterm-256color \
  --env DSH_HOME="$dsh_home" \
  --env DEEPSEEK_API_KEY=dummy \
  -- "$node_bin" "$dsh_bin" --profile "$profile"
"$node_bin" "$repo_root/scripts/render-pty-capture.mjs" "$capture" "$readable" "$columns" "$rows"
grep -aqF 'Settings' "$capture"
grep -aqF 'Reasoning effort ·' "$capture"
grep -aqF 'Exported to' "$capture"
grep -aqF 'New session session-' "$capture"
grep -aqF 'assistant' "$capture"
grep -aqF 'PTY command audit' "$capture"
grep -aqF 'Memory is off for this session.' "$capture"
grep -aqF 'Memory enabled for this session.' "$capture"
grep -aqF 'Memory disabled for this session.' "$capture"
grep -aqF 'Image paste failed:' "$capture"
grep -aqF $'\x1b[?1049h' "$capture"
grep -aqF $'\x1b[?1049l' "$capture"
grep -aqF $'\x1b[?1002h\x1b[?1006h' "$capture"
grep -aqF $'\x1b[?1006l\x1b[?1002l' "$capture"
grep -aqF 'Switch active session' "$capture"
test -f "$export_path"
grep -qF 'Assistant' "$readable"
grep -qF 'Active' "$readable"
grep -qF 'Status' "$readable"
grep -qF 'Perm' "$readable"
grep -qF 'plan off' "$readable"
python3 - "$readable" <<'PY'
from pathlib import Path
import sys

lines = Path(sys.argv[1]).read_text(encoding='utf-8').splitlines()
assistant = next((line for line in lines if 'Assistant' in line and '│' in line), None)
editor_bottom = next((line for line in reversed(lines) if '╰' in line and '│' in line), None)
if not lines or lines[0].startswith('┌') or lines[-1].startswith('└'):
    raise SystemExit('removed outer frame is still rendered across the terminal viewport')
assistant_separators = [] if assistant is None else [index for index, value in enumerate(assistant) if value == '│']
if assistant is None or len(assistant_separators) != 1 or assistant.index('Assistant') < assistant_separators[0]:
    raise SystemExit('Assistant is not rendered in the right sidebar')
editor_separators = [] if editor_bottom is None else [index for index, value in enumerate(editor_bottom) if value == '│']
if editor_bottom is None or len(editor_separators) != 1 or editor_bottom.index('╰') > editor_separators[0]:
    raise SystemExit('editor is not rendered in the left main area')
PY
! grep -aqF 'fatal load failure' "$capture"
! grep -aqF 'setPrompt is not a function' "$capture"
! grep -aqF 'TUI prompt value' "$capture"
! grep -aqF 'ERR_MODULE_NOT_FOUND' "$capture"
! grep -aqF 'Unknown command:' "$capture"
! grep -aqF 'Unknown theme' "$capture"
! grep -aqF 'Command failed:' "$capture"
! grep -aqF 'documentPath is not a function' "$capture"
! grep -aqF 'service "attachments" has been registered' "$capture"

echo "Verified the borderless fixed workbench at ${columns}x${rows}, memory commands, clipboard-image failure, session switching, export, and shutdown through a real PTY."
