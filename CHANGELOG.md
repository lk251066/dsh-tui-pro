# Changelog

All notable changes to this project will be documented in this file.

The `v1.0.0` tag is not an installable public release: no npm package was published, and the repository-root tarball does not contain the required dsh bundle metadata. See [REPAIR_PLAN.md](REPAIR_PLAN.md) for the first verified release criteria.

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
- **GitHub Release**: https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.0.2
- **Plugin Catalog**: ready for submission using [PLUGIN_SUBMISSION.md](PLUGIN_SUBMISSION.md)
