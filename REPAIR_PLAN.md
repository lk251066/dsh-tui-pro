# Release Repair Plan

This document is the source of truth for making `@lk251066/dsh-tui` independently installable and verifiably usable as a dsh plugin.

## Current decision

Ship one package: `@lk251066/dsh-tui`. Its package manifest already defines `dsh.bundle.patch`, so the repository will not create or publish a separate `@lk251066/dsh-tui-bundle` compatibility package.

Publication remains blocked until every phase below is complete. The existing `v1.0.0` tag and repository-root tarball are not release candidates. Phases 1-3 are complete in the current working tree; Phase 4 has passed installation and module loading but still needs interactive evidence; Phase 5 has not started.

## Resolved defects

1. Session mounting now creates the shared layout before any slot can use it.
2. Prompt metric refresh receives a valid active channel before reading token state.
3. `tsconfig.host.json` no longer references the nonexistent `packages/dsh-tui-bundle` project.
4. A forced clean build removes deleted modules and emits every published entry point.
5. The package tarball contains `cordis.patch.yml`, `dsh.bundle.patch` metadata, JavaScript, declarations, README, and LICENSE without source or test files.
6. Tests use one `@deepseek-ai/dsh-scope` instance, matching the runtime Service Definition packages.

## Remaining blockers

1. The real interactive TTY workflow and required demonstration evidence are not recorded.
2. The changed user-visible behavior still needs the repository's keyless snapshot evidence.
3. The repair changes do not yet have an approved and merged GitHub pull request.
4. `@lk251066/dsh-tui` is not published to npm, so registry installation cannot yet be verified.
5. No new GitHub tag or Release identifies the repaired commit.

## Phase 1: Restore a valid source tree

Status: complete in the current working tree.

- Remove the nonexistent `packages/dsh-tui-bundle` TypeScript project reference.
- Remove obsolete `@lk251066/dsh-tui-bundle` references from maintained documentation and release metadata.
- Decide whether generated `tsconfig.tsbuildinfo` belongs in version control, then make the repository clean-build behavior deterministic.
- Run the root type check from a clean tree.

Acceptance:

```bash
pnpm run typecheck
```

The command exits successfully without relying on files outside the repository.

## Phase 2: Repair TUI lifecycle and session behavior

Status: complete in the current working tree. All 431 tests pass.

- Establish the shared layout controller before any initial slot can mount or any callback can reach it.
- Make the active session channel an explicit input to prompt metric refresh; no render path may infer a channel that has not been published.
- Preserve one mount and unmount owner for the shared split layout so session switches cannot attach duplicate children or detach another slot's UI.
- Verify focus ownership for the editor and session list across left, right, escape, up, down, and enter input.
- Update unit tests for initial mount, session switching, repeated mount/unmount, disposal, and prompt refresh before a channel is active.

Acceptance:

```bash
pnpm run test
```

All tests pass with no unhandled rejection after Vitest exits. A focused regression test must fail against the current initialization order and pass after the repair.

## Phase 3: Make the package self-contained

Status: complete for the local tarball. Clean-profile installation and the real dsh loader resolve the package and every bundle row. The profile package manager reports host API peers as absent because it cannot see dsh's installation fallback; runtime loading confirms the documented dsh resolution path supplies them.

- Audit every bare package name in `cordis.patch.yml` against `dependencies`, `peerDependencies`, and the dsh CLI dependency closure.
- Declare each runtime package in the owning manifest unless the supported dsh installation explicitly provides it.
- Align peer dependency ranges with an actual supported and installable dsh release; development `file:` tarballs cannot define the public compatibility range.
- Verify every exported JavaScript file and declaration path after a clean build.
- Generate a new tarball from `packages/dsh-tui`; do not reuse the existing root tarball.

Acceptance:

```bash
pnpm run lint
pnpm run build
cd packages/dsh-tui
npm pack --dry-run
```

The dry run contains the built entry points, matching declarations, `cordis.patch.yml`, `README.md`, `LICENSE`, and a manifest with `dsh.bundle.patch` set to `./cordis.patch.yml`.

## Phase 4: Prove the real dsh entry path

Status: installation, `why`, profile manifest, configuration dump, and runtime module loading pass. A non-interactive launch reaches the intentional `stdin`/`stdout` TTY requirement. The interactive workflow, keyless snapshot, and demonstration artifact remain pending.

- Install the generated tarball with `dsh plugin --profile tui-smoke add <absolute-tarball-path>` while `DSH_HOME` points to an empty temporary directory.
- Confirm the profile records `@lk251066/dsh-tui` as both a dependency and a bundle layer.
- Run `dsh --profile tui-smoke --dump-config` and verify every bundled plugin resolves.
- Start the real TUI through that profile and exercise initial render, user input, approval, session creation, session switching, resume, and shutdown.
- Add or update the required keyless snapshot for changed user-visible behavior. Record the real terminal or browser demonstration required by the target pull request workflow.

Acceptance:

The packed artifact, rather than a workspace link, completes the full flow without module resolution errors, initialization errors, unhandled rejections, or teardown leaks.

## Phase 5: Publish one reproducible commit

Status: pending.

- Commit source, tests, package metadata, generated outputs, and documentation that describe the same version.
- Push a feature branch and review the exact GitHub diff; merge only after the required checks pass.
- Publish `@lk251066/dsh-tui` from the reviewed commit with a new version.
- Verify `npm view @lk251066/dsh-tui version` and repeat the clean-profile install using the registry package name.
- Create a GitHub tag and Release pointing to the published commit. Do not rewrite `v1.0.0`.
- Add the npm package or exact release asset and checksum to the GitHub Release, then submit the plugin registry listing.

Acceptance:

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
dsh --profile tui --dump-config
dsh --profile tui
```

All commands operate from public artifacts and the GitHub commit, npm package, and release version identify the same source.

## Required evidence before declaring completion

- [ ] Clean `git status` at the reviewed commit
- [x] Successful type check, tests, lint, build, and `git diff --check` in the current working tree
- [x] `npm pack` file list reviewed
- [x] Clean-profile tarball installation transcript
- [ ] Clean-profile registry installation transcript
- [x] Config dump showing the bundle layer is active
- [ ] Interactive TUI smoke evidence for the real startup and shutdown path
- [ ] GitHub branch, tag, Release, and npm version aligned to one commit

No phase may be waived because a workspace-linked build succeeds.
