# dsh-tui-pro - Plugin Submission Info

## Basic Information

**Package Name:** `@lk251066/dsh-tui`  
**Display Name:** dsh-tui-pro  
**Version:** 1.0.0  
**License:** MIT  
**Author:** lk251066  
**Repository:** https://github.com/lk251066/dsh-tui-pro

## Description

**English:**
Community-maintained interactive terminal UI plugin for DeepSeek Harness. Features full-screen terminal interface with Claude Code-inspired layout, multi-session management, personal assistant with memory, fleet monitoring, syntax highlighting, and comprehensive approval workflows.

**中文:**
社区维护的 DeepSeek Harness 交互式终端 UI 插件。提供全屏终端界面（Claude Code 风格布局）、多会话管理、带记忆的个人助手、fleet 监控、语法高亮和完整的审批工作流。

## Installation

```bash
npm install @lk251066/dsh-tui
# or
pnpm add @lk251066/dsh-tui
```

## Usage

### Method 1: Direct Profile Configuration

```yaml
# ~/.dsh/profiles/tui/cordis.yml
plugins:
  ~ui-tui:
    $require: '@lk251066/dsh-tui'
    sessionId: main
    showReasoning: true
    theme:
      color: true
      truecolor: true
```

### Method 2: Use Bundle (Recommended)

Create a bundle profile in your project:

```json
{
  "name": "@my-org/dsh-tui-bundle",
  "version": "1.0.0",
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  },
  "dependencies": {
    "@deepseek-ai/dsh-base": "^0.1.0",
    "@lk251066/dsh-tui": "^1.0.0"
  }
}
```

```yaml
# cordis.patch.yml
- insert:
    - id: tui-prompt
      name: '@lk251066/dsh-tui/prompt'
    - id: tui
      name: '@lk251066/dsh-tui'
      config:
        sessionId: main
        showReasoning: true
```

Then use: `dsh --profile my-bundle`

## Key Features

### Core UI
- ✨ Full-screen terminal interface
- 🎨 Syntax highlighting (lazy-loaded, LRU cached)
- 📝 Diff rendering with line numbers
- 🔄 Multi-session management (LRU eviction)

### Assistant & Memory
- 🤖 Personal assistant session (fixed ID)
- 🧠 Persistent memory system
- 💬 Inter-session messaging

### Monitoring & Control
- 📊 Fleet monitoring (`/fleet`)
- 📥 Queue dock for pending turns
- ⚙️ Goal management (`/goal`, Ctrl+G)
- 📊 Context pressure warnings

### Approval & Safety
- 🔐 Approval dialogs with risk confirmation
- ⚠️ Shift+Tab permission ring (safe → workspace → danger)
- ✅ Human-in-the-loop for dangerous operations

### Session Management
- 🔄 Session switcher (Ctrl+N new, /sessions list)
- 📤 Session export (`/export`)
- 🍴 Session forking (`/fork`)
- 🔄 Resume picker (`/resume`)

### Theme & Customization
- 🎨 8 built-in theme presets
- 🌈 True color support
- 🎭 Automatic terminal capability detection

## Commands

- `/assistant` - Switch to personal assistant session
- `/memories` - Browse and manage memories (r:refresh, d:delete)
- `/fleet` - View all active sessions across processes
- `/new` - Create new session
- `/sessions` - List and switch sessions
- `/resume` - Resume from persisted sessions
- `/fork` - Fork current session
- `/export` - Export session to markdown
- `/theme` - Change theme preset
- `/goal` - Manage current goal
- `/queue` - Show message queue
- `/context` - Show context breakdown
- `/agents` - List active agents
- `/jobs` - List background jobs
- `/settings` - Show settings

## Keyboard Shortcuts

- `Ctrl+N` - New session
- `Ctrl+G` - Goal actions
- `Ctrl+C` (double tap) - Exit
- `Ctrl+O` - Toggle tool visibility
- `Shift+Tab` - Cycle permission presets
- `↑/↓` - Message queue navigation (when empty prompt)
- `Tab` - Autocomplete / focus navigation

## Requirements

**Peer Dependencies:**
- `@deepseek-ai/cordis` ^0.1.0
- `@deepseek-ai/dsh-agent` ^0.1.0
- `@deepseek-ai/dsh-session` ^0.1.0
- `@deepseek-ai/dsh-llm` ^0.1.0
- `@deepseek-ai/dsh-commands` ^0.1.0
- And other core packages (see package.json)

**Optional Dependencies:**
- `@deepseek-ai/dsh-memory` - For `/memories` and assistant memory
- `@deepseek-ai/dsh-skill` - For skill invocation
- `@deepseek-ai/dsh-session-persistence` - For `/resume`
- `@deepseek-ai/dsh-session-query` - For `/fleet` cross-process monitoring

**Runtime:**
- Node.js: ^22.19.0 || >=24.0.0
- Terminal: ANSI color support (truecolor recommended)

## Tags

terminal, tui, ui, interface, assistant, memory, multi-session, monitoring, approval, workflow, claude-code, syntax-highlighting, diff, theme

## Category

UI / Frontend

## Screenshots

(TODO: Add terminal screenshots showing:
1. Main chat interface with syntax highlighting
2. Approval dialog with risk confirmation
3. Fleet monitoring view
4. Memory browser
5. Split-view assistant hub)

## Links

- **GitHub**: https://github.com/lk251066/dsh-tui-pro
- **Issues**: https://github.com/lk251066/dsh-tui-pro/issues
- **Documentation**: https://github.com/lk251066/dsh-tui-pro/tree/master/packages/dsh-tui

## Notes for dshfind.com Reviewers

- This is a community fork and enhancement of the original `@deepseek-ai/dsh-tui` which was removed from the main harness repository (commit 10bb9cbf, 2026-08-04)
- Includes all original features plus new enhancements (assistant hub, fleet monitoring, split-view layout)
- Fully tested with 400+ test cases
- Follows official DeepSeek Harness plugin conventions
- Compatible with dsh-base bundles
- Can be used standalone or as part of a custom profile

## Support

For issues, questions, or contributions, please visit:
https://github.com/lk251066/dsh-tui-pro/issues
