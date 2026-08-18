# Release Repair Plan

This document is the source of truth for making `@lk251066/dsh-tui` independently installable and verifiably usable as a dsh plugin.

## Current decision

Ship one package: `@lk251066/dsh-tui`. Its package manifest already defines `dsh.bundle.patch`, so the repository will not create or publish a separate `@lk251066/dsh-tui-bundle` compatibility package.

Version `1.7.1` is the current release against public `@deepseek-ai/dsh@0.1.0-rc.6`. The current source targets `1.8.0`; it is not a public release until the source, artifact, profile, PTY, npm, tag, and GitHub Release records identify one commit.

The `1.8.0` source separates whole-TUI exit from project-session closing and gives the fixed assistant read-only access to visible dialogue in other Active project sessions.

## Version 1.8.0 session closing and assistant conversation reads

`/exit` remains the bounded whole-TUI shutdown command. `/quit` and empty-input `Delete` cancel a running turn, open the fixed assistant, remove the current project from Active, remove its mounted slot, release an owned agent handle, and preserve its durable history. Failure to detach Active membership switches back to the project. The assistant cannot be closed.

The assistant-scoped `read_session_conversation` tool accepts only an Active project session id. It reads a live-preferred durable log without activating the target and returns newest-first pages in chronological display order. Projection keeps append-origin direct user text, `[Image]` placeholders, and completed assistant text. It excludes reasoning, tool calls and results, diffs, injected context, replacement events, and unfinished chunks. Membership is checked before and after the read.

## Version 1.7.1 bounded command exit

`/exit` and `/quit` request cancellation when the active agent is running, then immediately enter the same bounded shutdown path used by idle exits. Shutdown no longer depends on `Agent.whenIdle()` settling; the existing three-second exit ceiling applies even when cancellation cannot make the agent report idle.

## Version 1.7.0 session-scoped input and lifecycle

Every agent handle created by the TUI remains owned by its create, resume, fork, rewind, or assistant-open operation until workspace attachment and session-registry adoption both succeed. Failure rolls back only membership added by that operation and disposes the handle once. Checkpoint rewind replaces the source Active slot with its branch; the source log remains in complete history. The assistant cannot fork or rewind. Terminal handoff is refused while any live agent or compaction is running.

The full-screen workbench renders a workspace-grouped Active-session list and a compact Status section. Existing conversations use one compact header; new untitled conversations use the welcome view. The bottom line owns cwd, branch, model, and context. Only the transcript scrolls; the frame, sidebar, and input remain fixed.

Enter steers a running turn, Tab queues the next turn, and empty Up recalls the latest submission. With an empty editor, Esc restores the newest queued message before a later Esc can cancel the turn. `/queue` is not registered; the dock remains a read-only queue preview.

`Alt+V` stores one clipboard image in the active session's draft and inserts an `[Image #N]` placeholder. Sending requires a model whose resolved metadata includes image input. Unsupported or unknown model metadata leaves the draft intact. `/memory on|off` persists memory enablement for the current session; the assistant defaults on and project sessions default off. Enabled sessions receive the shared `memory_save` and `memory_search` tools and recalled-memory prompt section.

## Version 1.6.3 active-session removal

Clicking a sidebar row activates that session. Pressing `Delete` with an empty focused input and no completion or dialog removes the current project session from the workspace's Active list. The live conversation stays mounted and the session log remains available through `/sessions`. The assistant is permanent, a draft keeps editor `Delete` behavior, and one pending removal blocks duplicate key presses.

## Version 1.6.2 repair

In the `1.6.2` release, a resumed agent remains owned by the open operation until it is attached to its workspace and adopted by the session registry. Any failure before adoption disposes that handle. Stopped-title lookup retries for a bounded one-second startup window and cancels on TUI disposal. Stored image rendering passes the complete durable attachment reference to `readImage`, preserving PNG, JPEG, WebP, and GIF metadata. Clipboard input in that release remains text-only.

## Version 1.6.1 repair

In the `1.6.1` release, the sidebar renders `Active sessions · N` to identify the manually maintained active-workspace list. A stopped session uses its immutable session cwd when it is resumed, so a Windows host does not need process replacement merely to switch projects. If in-process creation fails for a cross-workspace session, the existing host handoff is still attempted. Transcript drag selection remains the only copy command; `/copy` is not registered. Its input path is text-only: image blocks can render from durable attachments, but system clipboard image capture is not implemented.

## Version 1.6.0 transcript and session interaction

Guarded `Alt+Left` and `Alt+Right`, `/switch`, and sidebar clicks all resolve through the same active-session path. The key binding is available only from an empty focused editor with no completion or overlay, so ordinary cursor movement and dialogs retain their input. `/switch` accepts next, previous, a displayed number, an exact id, or an exact title.

Left-button dragging selects the rendered transcript directly. The selection owns terminal cells rather than raw ANSI offsets, includes both drag endpoints, preserves blank lines and wide graphemes, and resets after resize reflow. Releasing copies through the system clipboard, tmux forwarding, or OSC 52.

User and assistant turns use separate headings with blank space between turns and above the editor. Thinking, tool, grouped-tool, diff, and context blocks expose `▶` and `▼` states and toggle when their header is clicked. Global detail shortcuts continue to apply across the transcript.

## Version 1.5.0 interaction routing

Enter while running steers the current turn. Tab while running queues the next turn, with no queue action for empty input or an open completion menu. Empty Up recalls the latest real submission, and an unchanged queued submission replaces its existing entry. Session-reference context attached to a queued message is delayed until that message becomes the next turn.

Double Escape is a checkpoint navigator for the current conversation, not a history browser. It is available only while idle with an empty editor and closed completion menu. Selecting a checkpoint creates a new branch before that turn; the original session remains unchanged. `/sessions` continues to browse complete history. `Ctrl+PageUp` and `Ctrl+PageDown` cycle active workspace sessions, with same-workspace resume, cross-workspace host handoff, and duplicate-open locking.

`/context`, `/agents`, `/jobs`, and `/settings` use the same main-area placement as `/sessions`. The outer frame, sidebar, and input ownership remain fixed.

## Version 1.4.0 interaction placement

Built-in short choices use the fixed bottom interaction area. Questions, approvals, model and reasoning-effort selection, transcript details, themes, permission confirmation, renaming, goal actions, and queue actions do not open centered popups.

`/sessions` is intentionally different because complete history needs a searchable browser. It replaces the left chat area while open, keeps the full outer frame and right active-workspace sidebar visible, and restores the current transcript and editor on close.

## Version 1.1.0 terminal workbench

The `1.1.0` release introduces one full-screen workbench. The transcript, tools, dialogs, and editor occupy the left main area while the initial Workspace, Sessions, Current, and Status layout stays on the right. The editor stays fixed at the bottom, Page Up and Page Down scroll only the transcript, and inline dialogs temporarily replace the editor.

The same source also renders user messages before their assistant responses, starts the bundle in the personal assistant session, and supports `/new` plus `/new <path>` across project directories. The `1.1.0` workbench enters the terminal alternate screen, reserves an outer frame, and keeps transcript scrolling inside its inner viewport. Type checking, all 442 tests, lint with 38 warnings and no errors, build, artifact packing, Windows and Linux empty-profile loading, and the Linux real PTY flow pass for the `1.1.0` artifact. The release workflow repeated those checks, published npm `1.1.0`, and created the checksummed GitHub Release from commit `81b72c8`.

## Version 1.2.0 workspace sessions

The current source uses the official dsh workspace registry as the durable active-session index. Current-directory startup resumes the first active project session or creates and attaches one. The sidebar shows active membership rather than recent history; `/sessions` searches complete history and changes membership without deleting logs; `/assistant` remains a fixed entry. The assistant receives only direct session tools and no additional management prompt rules.

Type checking, all 422 tests, lint, build, artifact packing, empty-profile installation against public dsh rc.6, and the clean Linux real-PTY flow are the required evidence for the `1.3.0` tarball. The artifact audit checks the workspace launcher export and dependency, and the public-host check confirms every bundle row is active.

## Version 1.3.0 command and display repair

The current source fixes the rc.6 settings getter, adds `/effort`, isolates model selection per live session, makes `/fork` activate the new session, and makes `/export [path]` honor its path. It removes commands whose integrations are not part of the public bundle. The alternate-screen workbench consumes SGR and X10 mouse-wheel events before the editor and applies them only to transcript scrolling. Thinking, tool cards, and diff summaries have explicit settled-state rendering and visibility controls.

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
6. [`@lk251066/dsh-tui@1.1.0`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.1.0), annotated [`v1.1.0`](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.1.0), and the GitHub Release assets identify commit [`81b72c8`](https://github.com/lk251066/dsh-tui-pro/commit/81b72c8810e52b3c12d0f1558be30c5b2ad8c57e).
7. [`@lk251066/dsh-tui@1.2.0`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.2.0), annotated [`v1.2.0`](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.2.0), and the checksummed GitHub Release assets identify commit [`a3ead1b`](https://github.com/lk251066/dsh-tui-pro/commit/a3ead1b2ca6cfed6a16024efd5552879d90aa4fb).
8. [`@lk251066/dsh-tui@1.6.0`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.6.0), annotated [`v1.6.0`](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.6.0), and the checksummed GitHub Release assets identify commit [`6863b40`](https://github.com/lk251066/dsh-tui-pro/commit/6863b403860571bd534718700930b69d1a37dbbb).
9. [`@lk251066/dsh-tui@1.6.1`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.6.1), [`1.6.2`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.6.2), and [`1.6.3`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.6.3) shipped the transcript-copy, session-resume, image-replay, and active-session removal repairs with matching tags and checksummed GitHub Releases.
10. [`@lk251066/dsh-tui@1.7.0`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.7.0), annotated [`v1.7.0`](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.7.0), and the checksummed GitHub Release identify commit [`4066a72`](https://github.com/lk251066/dsh-tui-pro/commit/4066a727949997bba67736646090d2966978f7d6).
11. The [dshfind listing](https://dshfind.com/zh/plugins/lk251066/dsh-tui-pro) is live. The private root manifest mirrors the published package identity and nested bundle patch so the next catalog probe can replace its pre-release `not-installable` snapshot with a verified Release installation command.

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
- Preserve one mount and unmount owner for the shared root layout so session switches cannot attach duplicate children or detach another slot's UI.
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
