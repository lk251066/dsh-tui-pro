# Changelog

All notable changes to this project will be documented in this file.

The `v1.0.0` tag is not an installable public release: no npm package was published, and the repository-root tarball does not contain the required dsh bundle metadata. See [REPAIR_PLAN.md](REPAIR_PLAN.md) for the first verified release criteria.

## [Unreleased]

### Added

- Let the fixed assistant read paged user/assistant dialogue from another Active project session without exposing reasoning, tool traffic, diffs, injected context, or unfinished output.

### Changed

- Reserve `/exit` for closing the whole TUI. `/quit` and empty-input `Delete` now cancel and close the current project session, preserve its history, and return to the assistant.

## [1.7.1] - 2026-08-18

### Fixed

- Make `/exit` and `/quit` cancel a running turn and start bounded shutdown immediately instead of waiting indefinitely for the agent to report idle.

## [1.7.0] - 2026-08-18

### Added

- Add `Alt+V` clipboard image drafts backed by the attachment store, with PNG, JPEG, WebP, and GIF support and explicit vision-model capability checks.
- Add durable shared memories with per-session `/memory [on|off]`; no argument reports status, the assistant defaults on, and project sessions default off.
- Add a large welcome view for untitled sessions with no user messages.

### Changed

- Return the latest queued message to the editor on Esc before allowing a running turn to be cancelled.
- Replace the active session during checkpoint rewind while retaining the rewound-away log in complete history.
- Group Active sessions by workspace, remove the duplicate Current and Queue rows, simplify the header and outer frame, and keep cwd, branch, model, and context in the bottom status line.

### Fixed

- Dispose factory-created agents on every failed adoption path and keep workspace membership consistent across create, resume, fork, rewind, and assistant recovery.
- Preserve queued reference context during edit recovery, live streaming during theme or session changes, todo state across turns, and compaction progress inside a turn.
- Reject terminal handoff while any live agent is running, route nested subagent approvals through the TUI, and handle clipboard, permission, approval-height, title-loading, and tool-stall failures without corrupting the workbench.

### Removed

- Remove `/queue`; Tab queues, empty Up recalls or edits queued input, and Esc recovers the latest queued message.

## [1.6.3] - 2026-08-17

### Added

- Remove the current project session from the active workspace list with `Delete` after selecting it in the sidebar.

### Fixed

- Keep `Delete` available for normal text editing whenever the input contains a draft.
- Prevent repeated key presses from starting duplicate removal operations, and keep the assistant permanently active.

## [1.6.2] - 2026-08-17

### Fixed

- Retry stopped-session title loading while the optional query service finishes mounting.
- Dispose a resumed agent when workspace attachment or UI adoption fails, allowing the session to be opened again.
- Preserve complete stored-image attachment references, including media type, byte count, dimensions, and name, when rendering session history.

## [1.6.1] - 2026-08-17

### Changed

- Clarify the sidebar count as `Active sessions · N` and resume stopped sessions from another workspace in the current process when possible.
- Remove the redundant `/copy` command; transcript drag selection remains the copy path.
- Document that TUI input accepts text only and does not capture images from the system clipboard.

## [1.6.0] - 2026-08-17

### Added

- Add `/switch` with selector, relative, numbered, id, and exact-title targets, plus direct sidebar click switching.
- Add direct transcript drag selection, system/tmux/OSC-52 clipboard delivery, and `/copy` for the latest assistant reply.
- Add clickable disclosure markers to thinking, tool, grouped-tool, diff, and context blocks.

### Changed

- Replace active-session `Ctrl+PageUp` and `Ctrl+PageDown` with guarded `Alt+Left` and `Alt+Right`.
- Render conversation turns with distinct `You` and `Assistant` headings and fixed spacing above the editor.
- Enable button-motion mouse reporting so selection and wheel scrolling coexist in the fixed transcript viewport.

## [1.5.0] - 2026-08-17

### Added

- Add Enter steering, Tab next-turn queueing, and empty-Up recall for running input.
- Add double-Escape checkpoint navigation that branches the current conversation before a selected turn.
- Add `Ctrl+PageUp` and `Ctrl+PageDown` cycling across active workspace sessions.

### Changed

- Load persisted titles for stopped active sessions and resume same-workspace sessions without replacing the TUI process.
- Delay queued session-reference context until the queued turn begins.
- Render `/context`, `/agents`, `/jobs`, and `/settings` in the chat main area while preserving the frame and sidebar.
- Prevent duplicate local-resume and cross-workspace handoff requests for the same session.

## [1.4.0] - 2026-08-17

### Changed

- Render built-in questions, approvals, model and reasoning-effort choices, transcript details, themes, permissions, renaming, goal actions, and queue actions in the fixed bottom interaction area without popup borders.
- Make `/sessions` replace only the left chat area while preserving the full-screen frame and persistent active-workspace sidebar.
- Make bare `/effort` open the same keyboard-selectable bottom interaction used by other short choices.

## [1.3.0] - 2026-08-17

### Added

- Add `/effort [level]` for model-advertised reasoning levels.
- Decode SGR and X10 mouse-wheel input and page the transcript without moving the editor.

### Fixed

- Read the rc.6 settings document path as a property, so `/settings` no longer fails with `settings.documentPath is not a function`.
- Keep model and reasoning selections isolated between live sessions.
- Add forked sessions to the active workspace and open them immediately.
- Make `/export [path]` honor an explicit output path.
- Render settled thinking duration and diff summary colors consistently.

### Removed

- Remove unavailable `/palette`, `/reload`, `/fleet`, and `/memories` commands and their default-bundle integrations.

## [1.2.0] - 2026-08-17

### Added

- Persist a manually ordered active project-session list through the official dsh workspace registry.
- Add assistant tools to list, create, activate, remove, switch, and message workspace sessions without adding session-management prompt rules.

### Changed

- Start in the current directory's active project session, or create and activate one when none exists.
- Make `/sessions` the single full-history browser; Tab switches to active sessions, Space changes membership, and Enter opens the selected session.
- Keep the personal assistant as a fixed sidebar entry opened with `/assistant`.

### Removed

- Remove F6 and the interactive sidebar focus mode.
- Remove the separate `/resume` command and the obsolete live-only numeric session picker.

## [1.1.0] - 2026-08-16

### Changed

- Replace the chat-adjacent left information pane with a full-screen workbench: transcript and input on the left, persistent Workspace, Sessions, Current, and Status sections on the right.
- Keep the terminal frame fixed while Page Up and Page Down scroll the transcript inside the main area.
- Use F6 to enter session navigation so ordinary cursor movement remains inside the editor.
- Let active inline dialogs replace the editor area and restore the draft after the dialog closes.
- Move model, context, token, cache, queue, permission, and plan values exclusively into the right Status section.
- Start the bundled profile in the personal assistant session.
- Let `/new` create a session in the active project and `/new <path>` create one in another project.
- Run the workbench in the terminal alternate screen so TUI redraws never grow the invoking shell's scrollback.
- Draw an accent outer frame around the full terminal viewport; transcript, sidebar, dialogs, and editor use the framed inner area.

### Fixed

- Render each user message before the assistant output produced for that turn.
- Rebuild file completion and skill discovery when the active session changes projects.

### Removed

- Remove the default block-logo reveal and shimmer animation from application startup.
- Remove duplicated operational status from the prompt footer.

## [1.0.2] - 2026-08-16

### Added

- Add a configurable persistent workspace sidebar with live sessions, agent status, model, context, token, queue, permission, and plan values.

### Changed

- Keep detached session titles, activity, and running state current without requiring the user to switch sessions.
- Preserve the sidebar on narrow terminals; below the combined pane minimum, the chat uses the remaining columns instead of hiding the workspace panel.

### Fixed

- Keep the sidebar aligned with the visible end of long transcripts and after terminal height changes.
- Verify queue state through the complete terminal viewport instead of treating incremental ANSI writes as a complete screen.

## [1.0.1] - 2026-08-16

### Fixed

- Align the TUI, peer dependencies, and development checks with the public DeepSeek Harness rc.6 packages.
- Initialize the shared session layout before mounting a session and keep one layout owner across session switches.
- Guard prompt status refresh until an active channel exists.
- Package the bundle patch, compiled entry points, declarations, README, and license in one installable artifact.
- Build from a clean `lib` directory during `prepack` so deleted modules cannot leak into a release.
- Bundle the patched `pi-tui` editor and its runtime dependencies so public installs receive the editor API used by the TUI.
- Stop late model-context callbacks when TUI construction fails or the owning Cordis fiber starts unloading.
- Declare every default bundle plugin as a runtime dependency and omit the unpublished memory plugin from the default profile.
- Verify the packed artifact through an empty dsh profile and a real PTY hosted by public `@deepseek-ai/dsh@0.1.0-rc.6`.

The published npm package, annotated `v1.0.1` tag, and checksummed GitHub Release identify the same reviewed commit. The package was installed from the public registry into a new host and exercised through a real PTY before release completion.

## [1.0.0] - 2026-08-15 (repository tag only)

### Added

- Initial repository packaging for the dsh-tui-pro plugin
- ✨ Full-screen terminal UI with Claude Code-inspired design
- 🔄 Multi-session management with channel registry and LRU eviction
- 🤖 Personal assistant session with fixed identity and persistent memory
- 🧠 Memory system integration (`/memories` browser with delete support)
- 📊 Fleet monitoring (`/fleet` command for cross-session status)
- 🌐 Remote agent support (ACP over WSL/SSH)
- 🎨 Syntax highlighting with cli-highlight (lazy-loaded, LRU cached)
- 📝 Diff rendering with syntax highlighting and line numbers
- 🎯 Working line with spinner verbs and status indicators
- 🔐 Approval dialogs with risk confirmation (Shift+Tab permission ring)
- ⚙️ Goal management (`/goal`, Ctrl+G)
- 📥 Queue dock for monitoring pending messages
- 🎨 Theme system with presets (`/theme` command)
- 📊 Context pressure monitoring and compaction status
- 🔄 Session resume picker (`/resume`)
- 🍴 Session forking (`/fork`)
- 📤 Session export (`/export`)
- 🔍 File autocomplete in editor
- 📱 Split-view layout for assistant hub
- 💬 Inter-session messaging tools

### Technical Features

- Full Cordis plugin with `dsh.bundle` support
- Unit and component test suites for the intended feature set
- Built with TypeScript, compiled to ESM
- Proper peerDependencies for DeepSeek Harness core packages
- Optional dependencies for enhanced features (memory, skills, persistence)

### Documentation

- Package README
- Development and verification guides
- Bundle configuration example in `cordis.patch.yml`

## Links

- **Repository**: https://github.com/lk251066/dsh-tui-pro
- **NPM Package**: https://www.npmjs.com/package/@lk251066/dsh-tui
- **GitHub Release**: https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.7.0
- **Plugin Catalog**: https://dshfind.com/zh/plugins/lk251066/dsh-tui-pro
