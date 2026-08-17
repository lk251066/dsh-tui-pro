# Verification Guide

`@lk251066/dsh-tui` is a Cordis plugin and dsh profile bundle. Verification must cover the source tree, packed npm artifact, dsh profile composition, and interactive terminal behavior.

## Current verification

The 2026-08-15 repair checks and 2026-08-16 release verification produced these results:

| Check | Result |
| --- | --- |
| `pnpm run typecheck` | Passed |
| `pnpm run test` | Passed: 34 files, 433 tests |
| `pnpm run lint` | Passed with 42 warnings and no errors |
| `pnpm run build` | Passed |
| `git diff --check` | Passed |
| Forced clean package build | Passed; `lib/index.js` exists and deleted `assistant-layout` output is absent |
| `pnpm run pack:artifact` | Passed; package content and bundled editor reviewed |
| Empty-`DSH_HOME` tarball installation | Passed through the automated public-host smoke |
| `dsh plugin ... why` | Passed; one installed `@lk251066/dsh-tui@1.0.1` |
| `dsh --profile tui-public-smoke --dump-config` | Passed; every declared bundle row is active and no removed optional integration is loaded |
| GitHub CI workflow | Passed on Ubuntu and Windows, including the public rc.6 host smoke |
| Public `@deepseek-ai/dsh@0.1.0-rc.6` launch | Passed module loading and reached only the intentional non-TTY error |
| Interactive TTY smoke | Passed in WSL2 with GNU `script`; the Linux CI and release jobs run the same flow |
| Anonymous npm metadata | Passed for `@lk251066/dsh-tui@1.0.1`; integrity and shasum are public |
| Clean npm registry installation | Passed in a new WSL2 host and empty `DSH_HOME` |
| Registry-package interactive TTY smoke | Passed startup, commands, session switching, and shutdown |
| GitHub Release artifact | Passed; downloaded npm tarball SHA-1 matches `dist.shasum`, with SHA-256 attached |

The source checks passed on the reviewed commit, and the final integration checks used the anonymous public registry rather than a workspace link or local tarball.

## 1.6.2 release verification

The `1.6.2` checks add failed workspace-attachment and UI-adoption rollback with a successful retry, delayed stopped-session title lookup with disposal cancellation, and strict PNG/JPEG attachment-store reads that require the complete durable reference. The existing text clipboard, session switching, public-host, and real-PTY paths remain part of release verification. Clipboard image capture is not implemented.

Current source evidence:

| Check | Result |
| --- | --- |
| `pnpm run typecheck` | Passed |
| `pnpm run test` | Passed: 39 files, 461 tests |
| `pnpm run lint` | Passed with 39 warnings and no errors |
| `pnpm run build` | Passed |
| `git diff --check` | Passed |
| `pnpm run pack:artifact` | Passed: 316 files in the `1.6.2` artifact |
| Packed-artifact audit | Passed for exports, bundle metadata, patched editor, and runtime dependencies |
| Windows empty-profile installation | Passed against public dsh rc.6 using the packed tarball |
| Linux empty-profile installation | Passed against public dsh rc.6 using the packed tarball |
| Linux real PTY | Passed command paths, mouse reporting, session switching, export, frame/sidebar rendering, and shutdown |

## 1.6.1 release verification

The `1.6.1` checks cover active-session switching through guarded keys, `/switch`, and sidebar clicks; same-process resume from another workspace with host-handoff fallback; direct forward and reverse transcript dragging; ANSI removal, blank rows, wide graphemes, resize reflow, wheel coexistence, and local/tmux/OSC-52 clipboard delivery; and the absence of the removed `/copy` command. Public artifact, empty-profile, and real-PTY results are recorded after the source checks pass.

Current source evidence:

| Check | Result |
| --- | --- |
| `pnpm run typecheck` | Passed |
| `pnpm run test` | Passed: 39 files, 456 tests |
| `pnpm run lint` | Passed with 39 warnings and no errors |
| `pnpm run build` | Passed |
| `git diff --check` | Passed |
| `pnpm run pack:artifact` | Passed: 316 files in the `1.6.1` artifact |
| Packed-artifact audit | Passed for exports, bundle metadata, patched editor, new clipboard/selection modules, and runtime dependencies |
| Windows empty-profile installation | Passed against public dsh rc.6 using the packed tarball |
| Linux empty-profile installation | Passed against public dsh rc.6 using the packed tarball |
| Linux real PTY | Passed command paths, button-motion mouse reporting, session switching, export, frame/sidebar rendering, and shutdown |

## 1.5.0 interaction verification

The `1.5.0` checks cover three distinct placements and two input paths. Built-in short choices render without popup borders in the fixed bottom area; `/context`, `/agents`, `/jobs`, `/settings`, and `/sessions` replace the left chat area; and double Escape uses the current conversation's checkpoint view. Enter steers a running turn, Tab queues the next turn, and empty Up recalls the latest submission. Component and command tests cover these paths, active-session cycling, persisted titles, handoff locking, and frame/sidebar preservation.

Current source evidence:

| Check | Result |
| --- | --- |
| `pnpm run typecheck` | Passed |
| `pnpm run test` | Passed: 37 files, 435 tests |
| `pnpm run lint` | Passed with 40 warnings and no errors |
| `pnpm run build` | Passed |
| `git diff --check` | Passed |
| `pnpm run pack:artifact` | Passed: 307 files in the `1.5.0` artifact |
| Packed-artifact audit | Passed for exports, bundle metadata, bundled editor, and runtime dependencies |
| Windows empty-profile installation | Passed against public dsh rc.6 using the packed tarball |
| Linux empty-profile installation | Passed against public dsh rc.6 using the packed tarball |
| Linux real PTY | Passed startup, command paths, wheel reporting, session switching, export, and shutdown |
| Main-area session-browser layout | Passed with outer-frame and sidebar assertions |
| Bottom interaction rendering | Passed for built-in selectors and confirmations |

## 1.3.0 workbench verification

The workbench uses `HeadlessTerminal` snapshots because pi-tui emits incremental ANSI updates rather than a complete screen on every render. Coverage includes alternate-buffer activation and restoration, zero scrollback growth while transcript rows append, the full outer frame, right-sidebar placement, fixed-bottom input, Page Up and Page Down transcript scrolling, session switching without remounting the workbench, queue retention after unrelated durable messages, and inline-dialog replacement of the editor.

Run the focused evidence with:

```bash
pnpm exec vitest run packages/dsh-tui/tests/workbench-shell.spec.ts packages/dsh-tui/tests/workspace-sidebar.spec.ts packages/dsh-tui/tests/session-switch.spec.ts packages/dsh-tui/tests/tui.spec.ts -t "badges queued steering|keeps queue state visible|refreshes detached session|WorkbenchShellComponent|WorkspaceSidebarComponent"
```

This focused result does not replace the source, artifact, clean-profile, or real-PTY checks required for a new release.

Current source evidence:

| Check | Result |
| --- | --- |
| `pnpm run typecheck` | Passed |
| `pnpm run test` | Passed: 37 files, 422 tests |
| `pnpm run lint` | Passed with 40 warnings and no errors |
| `pnpm run build` | Passed |
| `pnpm run pack:artifact` | Passed: 301 files in the `1.3.0` artifact, including the workspace launcher, workbench JavaScript, declarations, and bundled editor |
| `scripts/verify-packed-artifact.sh` | Passed |
| Empty-profile public host | Passed against public `@deepseek-ai/dsh@0.1.0-rc.6`; `why` and `--dump-config` resolve the packed plugin and every bundle row |
| Current-tree real PTY | Passed in a clean Linux WSL host from the `1.3.0` tarball; command paths, export, session switching, mouse-wheel reporting, fixed sidebar, frame, and shutdown verified |

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

Run from the repository root:

```bash
pnpm run pack:artifact
```

Verify the new tarball contains:

- `package/lib/index.js`
- declaration files at every path named by `exports`
- `package/lib/workspace-agent-loop.js` and its declaration, used by the durable workspace startup layer
- `package/cordis.patch.yml`
- `package/README.md`
- `package/LICENSE`
- `package/package.json` with `dsh.bundle.patch: ./cordis.patch.yml`
- `package/node_modules/@earendil-works/pi-tui` with the patched `setPrompt()` editor API
- bundled `get-east-asian-width` and `marked` runtime dependencies
- the declared `@deepseek-ai/dsh-workspace` dependency and its bundle row

Reject an artifact that contains stale build output, a parent-directory archive member, or omits any required file.

## Clean-profile integration

Use a temporary empty directory as `DSH_HOME`; do not reuse a developer profile or workspace link. The final local run used `D:\jyrh\jyrh\dsh-tui-pro\.test-results\tui-smoke-101`.

```bash
dsh plugin --profile tui-smoke add <absolute-path-to-new-tarball>
dsh plugin --profile tui-smoke why @lk251066/dsh-tui
dsh --profile tui-smoke --dump-config
dsh --profile tui-smoke
```

Verify that installation adds the package to the profile dependencies and `dsh.profile.bundles`. The config dump must include the TUI rows and resolve every bare package in the bundled patch. The default patch contains only publicly installable integrations.

The TUI's Service Definition packages remain peers supplied by the dsh host. Plugins named directly by `cordis.patch.yml` are package dependencies so profile installation does not rely on the host's incidental transitive dependency tree. Treat a real launcher load as the final resolution check.

`pnpm run verify:public-host` automates this flow with public `@deepseek-ai/dsh@0.1.0-rc.6`. It requires the current tarball in `packages/`, creates an isolated host and `DSH_HOME`, verifies `add`, `why`, and `--dump-config`, and requires the non-interactive launch to stop only at the TTY check without a module-resolution error.

## Interactive behavior

Exercise these behaviors through the installed profile:

1. Initial render reaches an editable prompt without an exception.
2. Workspace shows the active project, full directory, and Git branch without terminal control characters.
3. Status shows agent state, model, context percentage, input/output tokens, cache hit rate, queue depth, permission preset, and plan mode before and after a model turn.
4. A second session created with `/new` appears under Active and switches without duplicate UI children; detached title and running-state changes update without first switching to that session.
5. `/sessions` replaces only the left chat area with complete history; the outer frame and sidebar stay fixed, and search, Up, Down, Enter, Tab, Space, and Escape perform their documented actions without sending text to the model.
6. Queue depth changes through steering insert, claim, discard, and unrelated durable transcript updates while the queue row remains visible.
7. Approval, question, tool output, reasoning visibility, and compaction status render correctly.
8. Removing an active session retains it in complete history, and adding it restores its sidebar entry without changing the log.
9. `sidebarWidth: 36` changes the right-sidebar width on a wide terminal; terminals below 65 columns hide the sidebar and retain the full-width main area.
10. At 32, 24, and 10 rows, inspect which rows remain in the viewport; use at least 24 rows when verifying that Workspace, Active, Status, and the editor are visible together.
11. The launch enters the alternate screen and the exit restores the shell without adding TUI history to normal scrollback.
12. Page Up and Page Down move only the transcript; the header, editor, dialog area, outer frame, and sidebar remain fixed, and each session preserves its own scroll position.
13. `/new` uses the active workspace, `/new <path>` validates and uses another project, `/assistant` opens the fixed assistant, and file and skill completion follow the active session's workspace.
14. Repeated session switching preserves each transcript and input state.
15. Normal exit disposes listeners and processes without an unhandled rejection.
16. `/settings` renders the settings path without a `documentPath is not a function` error.
17. `/effort` opens a bottom selector for advertised levels, changes the selected level, and rejects an unavailable level.
18. Switching between two live sessions preserves each session's model and reasoning selection.
19. `/fork` adds the new session to Active and opens it; `/export <path>` creates that exact file.
20. SGR and X10 wheel events move only transcript rows; editor text and cursor state remain unchanged.
21. Questions, approvals, model, details, theme, permission, rename, goal, and queue choices render in the fixed bottom area without centered popup borders.
22. While running, Enter steers and Tab queues; empty Up recalls the latest real submission and a duplicate queued submission replaces the existing item.
23. Tab does not queue empty text, slash or file completion text, or a submission while idle; queued session references are applied when the queued turn starts.
24. Double Escape opens only the current-conversation checkpoint view while idle with an empty editor; older/newer navigation, branch creation, close, and original-session preservation all work.
25. Guarded `Alt+Left` and `Alt+Right`, `/switch`, and left-clicking an active sidebar row open the same target session; ordinary editor cursor movement, completions, and overlays retain their input.
26. Left-button transcript dragging includes both endpoint cells, preserves blank rows and wide graphemes, and copies without ANSI controls; reverse dragging, resize reflow, wheel scrolling, and non-left buttons behave as documented.
27. Local, tmux, and SSH clipboard paths use system, tmux forwarding, and OSC 52 respectively. The TUI accepts text paste only; image clipboard capture is not supported.
28. `You` and `Assistant` headings remain distinct, the editor has a fixed preceding gap, and clicking thinking, tool, grouped-tool, diff, or context disclosure headers toggles only that block.
29. `/context`, `/agents`, `/jobs`, and `/settings` cover the chat main area while the full frame and sidebar remain visible.

`scripts/verify-interactive-pty.sh` drives the packed plugin through a Python standard-library PTY. The driver answers terminal capability queries, creates and switches sessions, opens the session picker, exercises command paths, and performs double-Ctrl+C shutdown. The captured ANSI stream is replayed through `@xterm/headless`; the check requires the compact title, every sidebar section, Workspace to the right of the separator, and the editor to the left. The repository snapshot suite remains the keyless evidence for stable rendered output.

## Registry verification

Verify a release with the public package name:

```bash
npm view @lk251066/dsh-tui version
dsh plugin --profile tui-registry add @lk251066/dsh-tui
dsh --profile tui-registry --dump-config
dsh --profile tui-registry
```

Use another empty `DSH_HOME`. Completion requires the registry installation to behave like the reviewed tarball.

For `1.0.1`, these commands passed in a new WSL2 host using an empty `/tmp` directory as `DSH_HOME`. `why` reported one installed `@lk251066/dsh-tui@1.0.1`, the config dump contained the prompt and main plugin rows, the non-interactive launch reached only the expected TTY requirement, and the real-PTY script completed.

The release workflow polls anonymous registry metadata after publication, then creates the checksummed GitHub Release. It does not replace the interactive TTY smoke or the manual review of user-visible behavior.
