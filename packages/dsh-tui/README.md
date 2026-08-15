# @lk251066/dsh-tui

Interactive terminal UI plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Features

- ✨ Full-screen terminal interface with Claude Code-inspired layout
- 🔄 Multi-session management with LRU eviction
- 🤖 Personal assistant session with persistent memory
- 📊 Fleet monitoring across sessions
- 🎨 Syntax highlighting, diff rendering, and markdown support
- ✅ Approval dialogs with risk confirmation
- 💾 Session resume picker

## Installation

```bash
# Install the bundle (includes TUI + dependencies)
dsh plugin --profile tui add @lk251066/dsh-tui-bundle

# Or install TUI core only (requires manual profile configuration)
npm install @lk251066/dsh-tui
```

## Usage

```bash
dsh --profile tui
```

## Configuration

The TUI plugin accepts the following configuration options in your profile's `cordis.patch.yml`:

```yaml
- id: tui
  name: '@lk251066/dsh-tui'
  config:
    sessionId: main              # Session to drive
    showReasoning: true          # Show thinking blocks (false to fold by default)
    maxToolOutputLines: 6        # Tool output preview lines
    theme:
      color: true                # Enable colors
      truecolor: true            # Enable 24-bit colors
```

## Development

See [DEVELOPMENT.md](../../DEVELOPMENT.md) for local development setup.

## License

MIT

## Credits

Based on the original TUI implementation from [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
