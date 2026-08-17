#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
host_root="${DSH_PTY_HOST_ROOT:-$repo_root/.test-results/public-dsh-smoke/host}"
dsh_home="${DSH_PTY_HOME:-$repo_root/.test-results/public-dsh-smoke/home}"
profile="${DSH_PTY_PROFILE:-tui-public-smoke}"
output_root="${DSH_PTY_OUTPUT_DIR:-$repo_root/.test-results/public-dsh-smoke}"
timeout_seconds="${DSH_PTY_TIMEOUT:-120}"
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
  --env TERM=xterm-256color \
  --env DSH_HOME="$dsh_home" \
  --env DEEPSEEK_API_KEY=dummy \
  -- "$node_bin" "$dsh_bin" --profile "$profile"
"$node_bin" "$repo_root/scripts/render-pty-capture.mjs" "$capture" "$readable"
grep -aqF 'Settings' "$capture"
grep -aqF 'Reasoning effort:' "$capture"
grep -aqF 'Exported to' "$capture"
grep -aqF 'New session session-' "$capture"
grep -aqF 'assistant' "$capture"
grep -aqF $'\x1b[?1049h' "$capture"
grep -aqF $'\x1b[?1049l' "$capture"
grep -aqF $'\x1b[?1002h\x1b[?1006h' "$capture"
grep -aqF $'\x1b[?1006l\x1b[?1002l' "$capture"
grep -aqF 'Switch active session' "$capture"
test -f "$export_path"
grep -qF 'Workspace' "$readable"
grep -qF 'Active' "$readable"
grep -qF 'Status' "$readable"
grep -qF 'Queue' "$readable"
grep -qF 'Perm' "$readable"
grep -qF 'Plan' "$readable"
python3 - "$readable" <<'PY'
from pathlib import Path
import sys

lines = Path(sys.argv[1]).read_text(encoding='utf-8').splitlines()
title = next((line for line in lines if 'dsh DEEPSEEK HARNESS' in line), None)
workspace = next((line for line in lines if 'Workspace' in line and '│' in line), None)
editor = next((line for line in lines if ('dsh >' in line or 'dsh   ' in line) and '│' in line), None)
if not lines or not lines[0].startswith('┌') or not lines[-1].startswith('└'):
    raise SystemExit('outer frame is not preserved across the terminal viewport')
if title is None:
    raise SystemExit('compact workbench title is missing')
workspace_separators = [] if workspace is None else [index for index, value in enumerate(workspace) if value == '│']
if workspace is None or len(workspace_separators) < 3 or workspace.index('Workspace') < workspace_separators[1]:
    raise SystemExit('Workspace is not rendered in the right sidebar')
editor_separators = [] if editor is None else [index for index, value in enumerate(editor) if value == '│']
if editor is None or len(editor_separators) < 3 or min(index for marker in ('dsh >', 'dsh   ') if (index := editor.find(marker)) >= 0) > editor_separators[-2]:
    raise SystemExit('editor is not rendered in the left main area')
PY
! grep -aqF 'fatal load failure' "$capture"
! grep -aqF 'setPrompt is not a function' "$capture"
! grep -aqF 'TUI prompt value' "$capture"
! grep -aqF 'ERR_MODULE_NOT_FOUND' "$capture"
! grep -aqF 'Unknown command:' "$capture"
! grep -aqF 'Command failed:' "$capture"
! grep -aqF 'documentPath is not a function' "$capture"

echo 'Verified the terminal workbench, right sidebar, command paths, button-motion mouse reporting, session switching, export, and shutdown through a real PTY.'
