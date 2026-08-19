#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

package_name="$(node -e "const p=require('./packages/dsh-tui/package.json'); process.stdout.write(p.name.replace(/^@/, '').replaceAll('/', '-'))")"
package_version="$(node -p "require('./packages/dsh-tui/package.json').version")"
archive="packages/${package_name}-${package_version}.tgz"
packed_files="$(mktemp)"
extract_dir="$(mktemp -d)"
trap 'rm -f "$packed_files"; rm -rf "$extract_dir"' EXIT

test -f "$archive"
tar -tf "$archive" > "$packed_files"
grep -Fx 'package/cordis.patch.yml' "$packed_files"
grep -Fx 'package/lib/index.js' "$packed_files"
grep -Fx 'package/lib/index.d.ts' "$packed_files"
grep -Fx 'package/lib/invariant.js' "$packed_files"
grep -Fx 'package/lib/prompt.js' "$packed_files"
grep -Fx 'package/lib/chat/memory.js' "$packed_files"
grep -Fx 'package/lib/chat/memory.d.ts' "$packed_files"
grep -Fx 'package/lib/workspace-agent-loop.js' "$packed_files"
grep -Fx 'package/lib/workspace-agent-loop.d.ts' "$packed_files"
grep -Fx 'package/README.md' "$packed_files"
grep -Fx 'package/LICENSE' "$packed_files"
grep -Fx 'package/assets/overview.png' "$packed_files"
grep -Fx 'package/assets/session-workbench.gif' "$packed_files"
grep -Fx 'package/node_modules/@earendil-works/pi-tui/dist/components/editor.js' "$packed_files"
grep -Fx 'package/node_modules/@earendil-works/pi-tui/package.json' "$packed_files"
grep -Fx 'package/node_modules/get-east-asian-width/package.json' "$packed_files"
grep -Fx 'package/node_modules/marked/package.json' "$packed_files"
! grep -E '^package/(src|tests)/' "$packed_files"
! grep -E '^package/lib/chat/assistant-layout\.' "$packed_files"
! grep -E '^package/(\.\./|.*\/\.\./)' "$packed_files"

tar -xf "$archive" -C "$extract_dir" \
  package/package.json \
  package/cordis.patch.yml \
  package/node_modules/@earendil-works/pi-tui/package.json \
  package/node_modules/@earendil-works/pi-tui/dist/components/editor.js
manifest="$extract_dir/package/package.json"
patch="$extract_dir/package/cordis.patch.yml"
pi_manifest="$extract_dir/package/node_modules/@earendil-works/pi-tui/package.json"
pi_editor="$extract_dir/package/node_modules/@earendil-works/pi-tui/dist/components/editor.js"

test "$(node -p "require(process.argv[1]).dsh.bundle.patch" "$manifest")" = './cordis.patch.yml'
test "$(node -p "require(process.argv[1]).publishConfig.access" "$manifest")" = 'public'
test "$(node -p "require(process.argv[1]).exports['./workspace-agent-loop'].default" "$manifest")" = './lib/workspace-agent-loop.js'
test "$(node -p "require(process.argv[1]).exports['./memory'].default" "$manifest")" = './lib/chat/memory.js'
test "$(node -p "require(process.argv[1]).version" "$pi_manifest")" = '0.80.7'
grep -F 'setPrompt(prompt)' "$pi_editor"

for dependency in '@earendil-works/pi-tui' 'get-east-asian-width' 'marked'; do
  node -e "const manifest=require(process.argv[1]); const dependency=process.argv[2]; if (!manifest.bundledDependencies?.includes(dependency)) process.exit(1)" "$manifest" "$dependency"
done

bundle_dependencies=(
  '@deepseek-ai/dsh-session-projection-cache'
  '@deepseek-ai/dsh-session-reference'
  '@deepseek-ai/dsh-session-stats'
  '@deepseek-ai/dsh-workspace'
  '@deepseek-ai/dsh-storage'
  '@deepseek-ai/dsh-storage-domain'
  '@deepseek-ai/dsh-storage-json'
  '@deepseek-ai/dsh-tool-ask-user'
)

for dependency in "${bundle_dependencies[@]}"; do
  node -e "const manifest=require(process.argv[1]); const dependency=process.argv[2]; if (manifest.dependencies?.[dependency] === undefined) process.exit(1)" "$manifest" "$dependency"
  grep -F "name: '$dependency'" "$patch"
done

grep -F "name: '@lk251066/dsh-tui/memory'" "$patch"
! grep -F "name: '@deepseek-ai/dsh-attachment-local'" "$patch"
node -e "const manifest=require(process.argv[1]); if (manifest.dependencies?.['@deepseek-ai/dsh-attachment-local'] !== undefined) process.exit(1)" "$manifest"
node -e "const manifest=require(process.argv[1]); if (manifest.dependencies?.['@deepseek-ai/dsh-brand'] === undefined) process.exit(1)" "$manifest"
node -e "const manifest=require(process.argv[1]); if (manifest.dependencies?.zod === undefined) process.exit(1)" "$manifest"

! grep -F "name: '@deepseek-ai/dsh-memory'" "$patch"
