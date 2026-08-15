# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-08-15

### Added

- 🎉 Initial release of dsh-tui-pro plugin
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
- Comprehensive test coverage (401+ passing tests)
- Built with TypeScript, compiled to ESM
- Proper peerDependencies for DeepSeek Harness core packages
- Optional dependencies for enhanced features (memory, skills, persistence)

### Documentation

- English and Chinese README files
- Comprehensive API documentation
- Installation and configuration guides
- Integration examples with cordis.patch.yml

## Links

- **Repository**: https://github.com/lk251066/dsh-tui-pro
- **NPM Package**: `@lk251066/dsh-tui`
- **Plugin Registry**: https://dshfind.com
