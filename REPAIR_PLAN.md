# Release Repair Plan

This document is the source of truth for making `@lk251066/dsh-tui` independently installable and verifiably usable as a dsh plugin.

## Current decision

Ship one package: `@lk251066/dsh-tui`. Its package manifest already defines `dsh.bundle.patch`, so the repository will not create or publish a separate `@lk251066/dsh-tui-bundle` compatibility package.

All five phases are complete for `1.0.2`. The existing `v1.0.0` tag and repository-root tarball remain invalid release inputs. The published npm package, annotated `v1.0.2` tag, checksummed GitHub Release, and reviewed commit are aligned, and the registry package passes a real-PTY flow against public `@deepseek-ai/dsh@0.1.0-rc.6`.

## Version 1.0.2 sidebar release

Version `1.0.2` adds a persistent workspace sidebar. The implementation bottom-aligns the sidebar with the transcript so long conversations do not scroll it out of the terminal viewport, and detached session title, activity, and running-state changes refresh without a switch. Headless-terminal coverage checks queue retention after unrelated durable messages, long transcript growth, terminal height reduction, and queue drain.

The release passes type checking, all 440 tests, lint with warnings only, build, artifact packing, clean-profile public-host loading, and a real-PTY run from the packed plugin. The replayed terminal screen contains the persistent Workspace, Sessions, Status, Queue, Perm, and Plan rows.

## Resolved defects

1. Session mounting now creates the shared layout before any slot can use it.
2. Prompt metric refresh receives a valid active channel before reading token state.
3. `tsconfig.host.json` no longer references the nonexistent `packages/dsh-tui-bundle` project.
4. A forced clean build removes deleted modules and emits every published entry point.
5. The package tarball contains `cordis.patch.yml`, `dsh.bundle.patch` metadata, JavaScript, declarations, README, and LICENSE without source or test files.
6. Tests use one `@deepseek-ai/dsh-scope` instance, matching the runtime Service Definition packages.
7. Every public bundle row is backed by a package dependency; the default patch no longer loads the unpublished `@deepseek-ai/dsh-memory` package.
8. Development, peer, and bundle dependency versions use the same public dsh rc.6 package line; the source tree no longer compiles against private rc.5 tarballs.
9. The public dependency graph is recorded in `pnpm-lock.yaml`, and CI installs it without dependency drift.
10. The npm artifact bundles the patched `pi-tui` editor and its transitive runtime dependencies, so consumers receive the prompt and frameless-editor APIs exercised by the source tests.
11. Construction failure and Cordis fiber unloading stop late model-context callbacks before they can render through disposed prompt handles.

## Release result

1. [Pull request #1](https://github.com/lk251066/dsh-tui-pro/pull/1) was merged as commit [`e521522`](https://github.com/lk251066/dsh-tui-pro/commit/e521522cf969a916193cd646fa204d156b9facc8).
2. [`@lk251066/dsh-tui@1.0.1`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.0.1) is public and installable from the anonymous npm registry.
3. The annotated [`v1.0.1` tag and GitHub Release](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.0.1) identify the merged commit and provide the npm tarball plus its SHA-256 file.
4. [`@lk251066/dsh-tui@1.0.2`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.0.2) adds the persistent workspace sidebar and fixed status display.
5. The annotated [`v1.0.2` tag and GitHub Release](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.0.2) identify the reviewed release commit and provide the npm tarball plus its SHA-256 file.

## Phase 1: Restore a valid source tree

Status: complete in the reviewed `1.0.1` commit.

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

Status: complete in the reviewed `1.0.1` commit. The regression suite includes the construction-rollback race that previously escaped as an unhandled rejection.

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

Status: complete. The artifact audit rejects undeclared bundle plugins, the unpublished memory plugin, parent-directory archive members, and an artifact missing the patched editor API. The rebuilt tarball passes the automated public-host runtime verification.

- Audit every bare package name in `cordis.patch.yml` against `dependencies`, `peerDependencies`, and the dsh CLI dependency closure.
- Declare each runtime package in the owning manifest unless the supported dsh installation explicitly provides it.
- Align peer dependency ranges with an actual supported and installable dsh release; development `file:` tarballs cannot define the public compatibility range.
- Verify every exported JavaScript file and declaration path after a clean build.
- Generate a new tarball from `packages/dsh-tui`; do not reuse the existing root tarball.
- Bundle the patched terminal editor and its direct runtime dependencies inside the plugin artifact; package consumers must not need this repository's pnpm patch settings.

Acceptance:

```bash
pnpm run lint
pnpm run build
cd packages/dsh-tui
npm pack --dry-run
```

The dry run contains the built entry points, matching declarations, `cordis.patch.yml`, `README.md`, `LICENSE`, and a manifest with `dsh.bundle.patch` set to `./cordis.patch.yml`.

## Phase 4: Prove the real dsh entry path

Status: complete in the reviewed `1.0.1` commit. Installation, `why`, profile composition, module loading, keyless snapshots, and the real-PTY workflow pass against public `@deepseek-ai/dsh@0.1.0-rc.6`.

- Install the generated tarball with `dsh plugin --profile tui-smoke add <absolute-tarball-path>` while `DSH_HOME` points to an empty temporary directory.
- Confirm the profile records `@lk251066/dsh-tui` as both a dependency and a bundle layer.
- Run `dsh --profile tui-smoke --dump-config` and verify every bundled plugin resolves.
- Start the real TUI through that profile and exercise initial render, user input, approval, session creation, session switching, resume, and shutdown.
- Add or update the required keyless snapshot for changed user-visible behavior. Record the real terminal or browser demonstration required by the target pull request workflow.

Acceptance:

The packed artifact, rather than a workspace link, completes the full flow without module resolution errors, initialization errors, unhandled rejections, or teardown leaks. The Linux CI and release workflows run the same PTY script.

## Phase 5: Publish one reproducible commit

Status: complete. The reviewed commit was merged, published, installed from the public registry, and released with aligned metadata.

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

- [x] No tracked changes at the reviewed commit
- [x] Successful type check, tests, lint, build, and `git diff --check` at the reviewed `1.0.1` commit
- [x] `npm pack` file list reviewed
- [x] Clean-profile tarball installation and repaired runtime transcript
- [x] Clean-profile registry installation transcript
- [x] Config dump showing the rebuilt bundle layer is active
- [x] GitHub CI passed on Ubuntu and Windows for the final dependency repair
- [x] Interactive TUI smoke evidence for startup, commands, session switching, and shutdown
- [x] Reviewed release commit, GitHub tag, GitHub Release, and npm version aligned

No phase may be waived because a workspace-linked build succeeds.
