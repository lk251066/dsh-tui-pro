# Verification Guide

`@lk251066/dsh-tui` is a Cordis plugin and dsh profile bundle. Verification must cover the source tree, packed npm artifact, dsh profile composition, and interactive terminal behavior.

## Current verification

The 2026-08-15 repair verification produced these results:

| Check | Result |
| --- | --- |
| `pnpm run typecheck` | Passed |
| `pnpm run test` | Passed: 34 files, 432 tests |
| `pnpm run lint` | Passed with 42 warnings and no errors |
| `pnpm run build` | Passed |
| `git diff --check` | Passed |
| Forced clean package build | Passed; `lib/index.js` exists and deleted `assistant-layout` output is absent |
| `pnpm pack` | Passed; package content reviewed |
| Empty-`DSH_HOME` tarball installation | Passed through the automated public-host smoke |
| `dsh plugin ... why` | Passed; one installed `@lk251066/dsh-tui@1.0.1` |
| `dsh --profile tui-public-smoke --dump-config` | Passed; every declared bundle row is active and memory is absent |
| GitHub CI workflow | Pending for the final dependency repair; the preceding commit passed on Ubuntu and Windows |
| Public `@deepseek-ai/dsh@0.1.0-rc.6` launch | Passed module loading and reached only the intentional non-TTY error |
| Interactive TTY smoke | Pending; the current automation host could not create a working Windows ConPTY session |
| Clean npm registry installation | Pending because the package is not published |

The checks must pass again on the reviewed commit. Local success does not replace the pending interactive and public-registry checks.

## Source checks

Run from the repository root:

```bash
pnpm run typecheck
pnpm run test
pnpm run lint
pnpm run build
git diff --check
```

All commands must exit successfully. Review lint warnings and test output; do not report only the final command's status.

## Artifact checks

Run from `packages/dsh-tui` after a clean build:

```bash
pnpm pack --dry-run
pnpm pack --pack-destination ..
```

Verify the new tarball contains:

- `package/lib/index.js`
- declaration files at every path named by `exports`
- `package/cordis.patch.yml`
- `package/README.md`
- `package/LICENSE`
- `package/package.json` with `dsh.bundle.patch: ./cordis.patch.yml`

Reject an artifact that contains stale build output or omits any required file.

## Clean-profile integration

Use a temporary empty directory as `DSH_HOME`; do not reuse a developer profile or workspace link. The final local run used `D:\jyrh\jyrh\dsh-tui-pro\.test-results\tui-smoke-101`.

```bash
dsh plugin --profile tui-smoke add <absolute-path-to-new-tarball>
dsh plugin --profile tui-smoke why @lk251066/dsh-tui
dsh --profile tui-smoke --dump-config
dsh --profile tui-smoke
```

Verify that installation adds the package to the profile dependencies and `dsh.profile.bundles`. The config dump must include the TUI rows and resolve every bare package in the bundled patch. The default patch intentionally omits long-term memory because `@deepseek-ai/dsh-memory` is not publicly installable.

The TUI's Service Definition packages remain peers supplied by the dsh host. Plugins named directly by `cordis.patch.yml` are package dependencies so profile installation does not rely on the host's incidental transitive dependency tree. Treat a real launcher load as the final resolution check.

`pnpm run verify:public-host` automates this flow with public `@deepseek-ai/dsh@0.1.0-rc.6`. It requires the current tarball in `packages/`, creates an isolated host and `DSH_HOME`, verifies `add`, `why`, and `--dump-config`, and requires the non-interactive launch to stop only at the TTY check without a module-resolution error.

## Interactive behavior

Exercise these behaviors through the installed profile:

1. Initial render reaches an editable prompt without an exception.
2. Token and model status render before and after the first model turn.
3. A second session appears in the list and switches without duplicate UI children.
4. Left focuses session navigation; up and down change selection; enter switches; right and escape return to the editor.
5. Approval, question, tool output, reasoning visibility, and queue indicators render correctly.
6. Resume and session title updates appear in the active list.
7. Repeated session switching preserves each transcript and input state.
8. Normal exit disposes listeners and processes without an unhandled rejection.

The user-visible multi-session change also requires the repository's keyless snapshot evidence and the demonstration artifact required by the pull request workflow.

## Registry verification

After publication, repeat the integration test with the public package name:

```bash
npm view @lk251066/dsh-tui version
dsh plugin --profile tui-registry add @lk251066/dsh-tui
dsh --profile tui-registry --dump-config
dsh --profile tui-registry
```

Use another empty `DSH_HOME`. Completion requires the registry installation to behave like the reviewed tarball.

The release workflow performs the registry version check and creates the GitHub Release after `NPM_TOKEN` is configured. It does not replace the interactive TTY smoke or the manual review of user-visible behavior.
