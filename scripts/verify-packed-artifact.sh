#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

package_name="$(node -e "const p=require('./packages/dsh-tui/package.json'); process.stdout.write(p.name.replace(/^@/, '').replaceAll('/', '-'))")"
package_version="$(node -p "require('./packages/dsh-tui/package.json').version")"
archive="packages/${package_name}-${package_version}.tgz"
packed_files="$(mktemp)"
trap 'rm -f "$packed_files"' EXIT

test -f "$archive"
tar -tf "$archive" > "$packed_files"
grep -Fx 'package/cordis.patch.yml' "$packed_files"
grep -Fx 'package/lib/index.js' "$packed_files"
grep -Fx 'package/lib/index.d.ts' "$packed_files"
grep -Fx 'package/lib/invariant.js' "$packed_files"
grep -Fx 'package/lib/prompt.js' "$packed_files"
grep -Fx 'package/README.md' "$packed_files"
grep -Fx 'package/LICENSE' "$packed_files"
! grep -E '^package/(src|tests)/' "$packed_files"
! grep -E '^package/lib/chat/assistant-layout\.' "$packed_files"
