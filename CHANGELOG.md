# Changelog

All notable changes to this project will be documented in this file.

The `v1.0.0` tag is not an installable public release: no npm package was published, and the repository-root tarball does not contain the required dsh bundle metadata. See [REPAIR_PLAN.md](REPAIR_PLAN.md) for the first verified release criteria.

## [1.0.1] - Unreleased

### Fixed

- Align the TUI with the current DeepSeek Harness APIs and package versions.
- Initialize the shared session layout before mounting a session and keep one layout owner across session switches.
- Guard prompt status refresh until an active channel exists.
- Package the bundle patch, compiled entry points, declarations, README, and license in one installable artifact.
- Build from a clean `lib` directory during `prepack` so deleted modules cannot leak into a release.
- Verify 431 tests and installation through an empty dsh profile.

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
- **NPM Package**: pending publication as `@lk251066/dsh-tui`
- **Plugin Registry**: pending verified release
