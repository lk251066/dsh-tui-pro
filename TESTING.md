# Verification Guide

`@lk251066/dsh-tui` is a Cordis plugin and dsh profile bundle. Verification must cover the source tree, packed npm artifact, dsh profile composition, and interactive terminal behavior.

## 1.8.2 source verification

The `1.8.2` checks cover the permanent Assistant directory, plugin-local memory correction and deletion, storage beyond 200 records, idempotent saves, bounded recall, compaction independence, complete final replies, two-state tool detail, visible tool failures, and current-turn steering receipts. The established borderless workbench, semantic transcript gutter, structured Plan and Delegate cards, scrolling, drag selection, fixed editor, sidebar, and current-step `token/s` remain covered.

| Check | Result |
| --- | --- |
| Complete source tests | Passed: 48 files, 610 tests |
| Focused transcript and workbench layout | Passed: 45 tests, including gutter wrapping, Plan and Delegate cards, compact todo progress, borderless viewport rows, and updated pointer coordinates |
| Focused semantic gutter and theme roles | Passed: 47 tests covering the `❯`, `✦`, and `✻` markers, hanging indentation, independent role colors, and running/settled tool tones |
| `pnpm run typecheck` | Passed |
| `pnpm run lint` | Passed with 33 existing warnings and no errors |
| `pnpm run build` | Passed |
| `pnpm run bench:transcript` | Passed: cold render 33.189 ms for 100 turns, 33.530 ms for 500 turns, and 44.032 ms for 1,000 turns; hot cached render 0.0002-0.0004 ms; 2,000 streamed chunks coalesced in 4.331 ms |
| `pnpm run docs:screenshot` | Passed: deterministic 1,448x720 PNG, SHA-256 `6f2e7a15b8d7946fc49010e9c6a7ee367f03237c9610e9885007e7808756a055`; deterministic four-frame GIF, SHA-256 `f4c9818046a3ec8da0a35061bcf75e555b063a839b00ccc946162b21c796cc83` |
| `pnpm run pack:artifact` | Passed: 333 files, 937.5 kB, SHA-1 `7acfe92ca3aebe659b971725156c984616ac6d64`, SHA-256 `99e81b5506123f708369628403a40e49cceb4bc23bfcdbc3b6a5f8fbf7f8304a` |
| Packed-artifact audit | Passed for exports, bundle metadata, patched editor, runtime dependencies, documentation assets, and excluded source/tests |
| Windows empty-profile public-host installation | Passed against public dsh rc.6 using pnpm peer installation; profile installation, `why`, `--dump-config`, and non-TTY module loading resolved the reviewed tarball |
| Linux real PTY | Not completed in this round: the first WSL attempt reused Windows-created links, and the clean public-host npm installation did not finish within five minutes; no plugin behavior failure was observed |
| Local `tui` profile | Installed from the reviewed `1.8.2` tarball; `why` resolves exactly one installed package |

## 1.8.1 source verification

The `1.8.1` checks cover the borderless fixed workbench, expanded transcript viewport, one-column outer whitespace, and dim separator between the transcript and sidebar. The fixed assistant occupies its own sidebar section, has no workspace or cwd, and is excluded from the Active project-session count; only project rows are grouped by workspace. Transcript content uses one symbol gutter for user `❯`, assistant `✦`, thinking `✻`, tool, and nested-result rows with hanging indentation at narrow widths. User, assistant, thinking, and running-tool markers have independent theme roles, while settled tool states keep their success and error colors. Plan and delegate calls use their structured presentation kinds, todo progress has a compact current-step row with `Ctrl+O` expansion, and scrolling, disclosure clicks, drag selection, terminal titles, sidebar titles, main-area diagnostics, the prefix-free editor prompt, compact message spacing, and current-step `token/s` remain covered.

| Check | Result |
| --- | --- |
| Complete source tests | Passed: 48 files, 604 tests |
| Focused transcript and workbench layout | Passed: 45 tests, including gutter wrapping, Plan and Delegate cards, compact todo progress, borderless viewport rows, and updated pointer coordinates |
| Focused semantic gutter and theme roles | Passed: 47 tests covering the `❯`, `✦`, and `✻` markers, hanging indentation, independent role colors, and running/settled tool tones |
| `pnpm run typecheck` | Passed |
| `pnpm run lint` | Passed with 34 existing warnings and no errors |
| `pnpm run build` | Passed |
| `pnpm run bench:transcript` | Passed: hot cached render 0.0001-0.0004 ms for 100-1,000 turns; 2,000 streamed chunks coalesced in 4.543 ms |
| `pnpm run docs:screenshot` | Passed: deterministic 1,448x720 PNG, SHA-256 `6f2e7a15b8d7946fc49010e9c6a7ee367f03237c9610e9885007e7808756a055`; deterministic four-frame GIF, SHA-256 `f4c9818046a3ec8da0a35061bcf75e555b063a839b00ccc946162b21c796cc83` |
| `pnpm run pack:artifact` | Passed: 333 files, 937.0 kB, SHA-1 `1c2e8964a66a0edd9cb1514b8b59ffd3a98de342`, SHA-256 `177da1eedbdaf52c0e8f2fb8ce7e7852187c15cc75fb33ef986f049560d2ea92` |
| Windows empty-profile public-host installation | Passed against public dsh rc.6; profile installation, `why`, `--dump-config`, and non-TTY module loading resolved the reviewed tarball |
| Linux real PTY | Passed at 140x32 for the borderless fixed workbench, single sidebar separator, fixed editor, commands, session switching, memory, image-paste failure, export, and shutdown |
| Local `tui` profile | Reinstalled from the reviewed `1.8.1` tarball; installed JavaScript contains the semantic marker roles and new gutter glyphs alongside the expanded viewport, simplified working row, reduced user fill, footer hierarchy, prefix-free prompt, and live-rate module; `why` and `--dump-config` resolve the package |

## 1.8.0 source verification

The `1.8.0` checks cover split command semantics, assistant-only conversation reads, weighted-average throughput, plan styling, scrollable diagnostics, skill selection and completion, live thinking time, and structured read/search/web/tool/diff cards. `/exit` retains bounded process shutdown. `/quit` and empty-input `Delete` cancel and close a project session, preserve history, return to the assistant, release owned handles, and restore the project when Active detachment fails. The assistant conversation tool enforces Active membership, paginates from the newest messages, retains image placeholders, and excludes reasoning, tools, injected context, and unfinished output.

| Check | Result |
| --- | --- |
| Complete source tests | Passed: 46 files, 590 tests |
| `pnpm run typecheck` | Passed |
| `pnpm run lint` | Passed with 38 existing warnings and no errors |
| `pnpm run build` | Passed through the artifact build |
| `git diff --check` | Passed; Git reported only the configured LF-to-CRLF checkout notices |
| `pnpm run pack:artifact` | Passed: 328 files, 748.6 kB, SHA-1 `ea60ad7f96a757310f32b5e3b79baef8b9cdb7b3` |
| Packed-artifact audit | Passed for exports, bundle metadata, patched editor, dependencies, and excluded source/tests |
| Windows empty-profile public-host installation | Passed against public dsh rc.6; `why`, `--dump-config`, and module loading resolved `1.8.0` |
| Linux clean-host real PTY | Passed welcome and compact headers, fixed layout, command paths, memory, image-paste failure, session switching, export, assistant opening, and `/exit` shutdown |
| Local `tui` profile | Installed from the reviewed tarball; `why`, the installed manifest, and `--dump-config` resolve `1.8.0` |

## Initial repair verification

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

## 1.7.1 release verification

The `1.7.1` checks prove that `/exit` and `/quit` request cancellation and begin shutdown even when a running agent's `whenIdle()` promise never settles. The public-host and real-PTY checks retain the complete `1.7.0` installation and terminal coverage.

| Check | Result |
| --- | --- |
| Focused `/quit` regression | Passed with a permanently pending `whenIdle()` promise |
| `pnpm run typecheck` | Passed |
| `pnpm run test` | Passed: 44 files, 522 tests |
| `pnpm run lint` | Passed with 39 warnings and no errors |
| `pnpm run build` | Passed |
| `git diff --check` | Passed |
| `pnpm run pack:artifact` | Passed: 325 files in the `1.7.1` artifact |
| Packed-artifact audit | Passed for exports, bundle metadata, patched editor, runtime dependencies, and absence of a duplicate attachment provider |
| Windows empty-profile installation | Passed against public dsh rc.6; `why` and `--dump-config` resolved `1.7.1` |
| Linux empty-profile installation and real PTY | Passed in a fresh WSL `/tmp` host; the complete command sequence ended through `/quit` with status 0 |

## 1.7.0 release verification

The `1.7.0` checks cover owned agent adoption and rollback, rewind replacement, guarded terminal handoff, queued-message recovery, the simplified fixed workbench, clipboard image drafts, explicit vision-model checks, and durable per-session memory. The packed-artifact checks require the memory export and bundle row while preventing a duplicate attachment provider alongside dsh-base.

Current source evidence:

| Check | Result |
| --- | --- |
| `pnpm run typecheck` | Passed |
| `pnpm run test` | Passed: 44 files, 521 tests |
| `pnpm run lint` | Passed with 39 warnings and no errors |
| `pnpm run build` | Passed |
| `git diff --check` | Passed |
| `pnpm run pack:artifact` | Passed: 325 files in the `1.7.0` artifact |
| Packed-artifact audit | Passed for exports, bundle metadata, patched editor, runtime dependencies, and absence of source, tests, credentials, or a duplicate attachment provider |
| Windows empty-profile installation | Passed against public dsh rc.6; `why`, `--dump-config`, module loading, and the expected non-TTY stop resolved `1.7.0` |
| Linux empty-profile installation | Passed in a new WSL `/tmp` host and `DSH_HOME` against public dsh rc.6; `why` and `--dump-config` resolved `1.7.0` |
| Linux real PTY | Passed welcome and compact headers, fixed layout, command paths, memory toggle, clipboard-image failure, session switching, export, and shutdown |
| npm registry | Passed for public `@lk251066/dsh-tui@1.7.0`; registry SHA-1 is `c023ea4fc8460761219d1af28c34578acfc70e36` |
| GitHub Release | Passed for `v1.7.0`; the Release contains the npm registry tarball and its SHA-256 file |
| dshfind discovery metadata | Passed locally: the private root manifest identifies `@lk251066/dsh-tui` and the nested bundle patch; the public listing updates after dshfind's next catalog probe |

## 1.6.3 release verification

The `1.6.3` checks cover selecting a project session through the right sidebar and removing it from Active with empty-input `Delete`. They also prove that duplicate key presses start one removal, the current conversation remains usable, `/sessions` retains its history, editor `Delete` still edits a draft, and the assistant cannot be removed.

Current source evidence:

| Check | Result |
| --- | --- |
| Focused session-switch tests | Passed: 1 file, 27 tests |
| `pnpm run typecheck` | Passed |
| `pnpm run test` | Passed: 39 files, 463 tests |
| `pnpm run lint` | Passed with 39 warnings and no errors |
| `pnpm run build` | Passed |
| `git diff --check` | Passed |
| `pnpm run pack:artifact` | Passed: 316 files in the `1.6.3` artifact |
| Packed-artifact audit | Passed for exports, bundle metadata, patched editor, and runtime dependencies |
| Windows empty-profile installation | Passed against public dsh rc.6 using the packed tarball; `why` and `--dump-config` resolved `1.6.3` |
| Linux empty-profile installation | Passed against public dsh rc.6 using the packed tarball; `why` and `--dump-config` resolved `1.6.3` |
| Linux real PTY | Passed command paths, mouse reporting, session switching, export, frame/sidebar rendering, and shutdown |

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
- `package/lib/chat/memory.js` and its declaration, used by the per-session memory service
- `package/cordis.patch.yml`
- `package/README.md`
- `package/LICENSE`
- `package/package.json` with `dsh.bundle.patch: ./cordis.patch.yml`
- `package/node_modules/@earendil-works/pi-tui` with the patched `setPrompt()` editor API
- bundled `get-east-asian-width` and `marked` runtime dependencies
- the declared `@deepseek-ai/dsh-workspace` dependency and its bundle row
- the `@lk251066/dsh-tui/memory` export and bundle row, plus the declared `@deepseek-ai/dsh-brand` and `zod` dependencies
- no `@deepseek-ai/dsh-attachment-local` dependency or bundle row; the supported dsh-base composition already provides the single attachment service

Reject an artifact that contains stale build output, a parent-directory archive member, or omits any required file.

## Clean-profile integration

Use a temporary empty directory as `DSH_HOME`; do not reuse a developer profile or workspace link. Keep each release run in a new test directory so prior profile state cannot satisfy the check.

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
2. Assistant appears in its own fixed section; Active sessions counts only project sessions and groups those rows by workspace without a `personal` pseudo-workspace.
3. A project bottom line shows cwd, branch, model, and context. The fixed assistant shows its permanent directory but remains outside project workspace grouping. Sidebar Status shows agent state, input/output tokens, cache hit rate, permission preset, and plan mode before and after a model turn.
4. A second session created with `/new` appears under Active and switches without duplicate UI children; detached title and running-state changes update without first switching to that session.
5. `/sessions` replaces only the left chat area with complete history; the outer whitespace, separator, and sidebar stay fixed, and search, Up, Down, Enter, Tab, Space, and Escape perform their documented actions without sending text to the model.
6. The queue dock changes through insert, claim, discard, Esc recovery, and unrelated durable transcript updates without a duplicate Queue row in the sidebar.
7. Approval, question, tool output, reasoning visibility, and compaction status render correctly.
8. Removing an active session retains it in complete history, and adding it restores its sidebar entry without changing the log.
9. `sidebarWidth: 36` changes the right-sidebar width on a wide terminal; terminals below 65 columns hide the sidebar and retain the full-width main area.
10. At 32, 24, and 10 rows, inspect which rows remain in the viewport; use at least 24 rows when verifying that Assistant, Active sessions, Status, and the editor are visible together.
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
21. Questions, approvals, model, details, theme, permission, rename, and goal choices render in the fixed bottom area without centered popup borders.
22. While running, Enter steers and Tab queues; empty Up recalls the latest real submission, a duplicate queued submission replaces the existing item, and empty-editor Esc restores the latest queue entry before cancelling.
23. Tab does not queue empty text, slash or file completion text, or a submission while idle; queued session references are applied when the queued turn starts.
24. Double Escape opens only the current-conversation checkpoint view while idle with an empty editor; older/newer navigation, close, and source-to-branch Active replacement work, while the source log remains in complete history.
25. Guarded `Alt+Left` and `Alt+Right`, `/switch`, and left-clicking an active sidebar row open the same target session; ordinary editor cursor movement, completions, and overlays retain their input.
26. Left-button transcript dragging includes both endpoint cells, preserves blank rows and wide graphemes, and copies without ANSI controls; reverse dragging, resize reflow, wheel scrolling, and non-left buttons behave as documented.
27. Local, tmux, and SSH text-copy paths use system, tmux forwarding, and OSC 52 respectively. `Alt+V` reads PNG, JPEG, WebP, and GIF clipboard images through each supported platform adapter and keeps the session draft when the selected model lacks image input.
28. User message bands and bare assistant Markdown remain visually distinct without `You` or `Assistant` heading rows; the editor has a fixed preceding rule, and clicking thinking, tool, grouped-tool, diff, or context disclosure headers toggles only that block.
29. `/context`, `/agents`, `/jobs`, and `/settings` cover the chat main area while the fixed separator and sidebar remain visible.
30. A new untitled session shows the welcome view; after its first user message or title, the welcome view disappears without leaving a persistent top header or moving the transcript or sidebar.
31. `/memory` reports the current session setting; `/memory on|off` persists it, installs or disposes memory tools and prompt sections, and keeps stored memories. The assistant defaults on and project sessions default off. More than 200 records survive restart without eviction; exact duplicate saves are idempotent; correction preserves creation time; deletion is durable; compaction does not silently add memory records.
32. `/queue` is absent from command help and autocomplete; Tab, Up, and Esc provide the complete queue interaction.
33. Fork, rewind, resume, assistant recovery, workspace-attachment failure, and UI-adoption failure leave no unowned agent handle or unintended Active membership. The assistant rejects fork and rewind.

`scripts/verify-interactive-pty.sh` drives the packed plugin through a Python standard-library PTY. The driver answers terminal capability queries, exercises welcome and compact headers, memory status and toggles, clipboard-image failure, valid command paths, session creation and switching, history, export, and shutdown. The captured ANSI stream is replayed through `@xterm/headless` at the requested terminal size; the check requires the borderless fixed workbench, the Assistant section to the right of the single separator, Active project sessions, the editor to the left, and no duplicate attachment service. The repository snapshot suite remains the keyless evidence for stable rendered output.

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
