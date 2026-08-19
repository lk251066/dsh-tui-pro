# @lk251066/dsh-tui

[English](https://github.com/lk251066/dsh-tui-pro#readme) | [简体中文](https://github.com/lk251066/dsh-tui-pro/blob/master/README.zh-CN.md)

A multi-session terminal workbench plugin and profile bundle for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

![dsh-tui-pro switching between persistent project sessions](./assets/session-workbench.gif)

## Install

This package requires Node.js `^22.19.0 || >=24.0.0`, the `dsh` CLI, and `DEEPSEEK_API_KEY` configured outside the package.

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
dsh --profile tui
```

Without a global dsh installation:

```bash
npx -y @deepseek-ai/dsh@latest plugin --profile tui add @lk251066/dsh-tui
npx -y @deepseek-ai/dsh@latest --profile tui
```

The package declares its own `dsh.bundle.patch`; a separate bundle package is neither required nor supported.

## Runtime behavior

- Only the transcript scrolls; the input, live status, plan, and sidebar remain fixed.
- One durable Assistant remains outside project workspaces, uses a permanent working directory, and manages active project sessions.
- Project sessions are grouped by workspace, retain their ordering, and resume from the launch directory.
- Enter steers a running turn, Tab queues the next turn, Esc recovers queued input, and double Esc browses checkpoints.
- Model, reasoning effort, image draft, input draft, and memory state remain independent per live session.
- Thinking, tools, code, diffs, plans, todo progress, and subagents use structured renderers.
- Final replies always render in full. Tool bodies have compact and expanded states; tool identity, status, and failures never disappear.
- Model, effort, skill, theme, setting, permission, question, and approval selectors use the fixed bottom area.
- Transcript selection copies plain text without ANSI styles; `Alt+V` attaches clipboard images.

Starting in a project directory resumes its first manually ordered active session or creates one when none exists. `/new` creates another session for the current project, `/new <path>` opens another project, and `/assistant` opens the fixed Assistant. `/quit` closes the current project session while preserving history; `/exit` closes the TUI.

Use `/sessions` for complete history and `/switch` for the compact active-session selector. `Alt+Left` and `Alt+Right` cycle active project sessions. Empty-input `Delete` closes the selected project session.

## Input and media

While the agent runs, Enter sends immediate steering and keeps a receipt visible until the current turn claims or discards it. Tab queues the next turn. Empty Up recalls the latest submission. With an empty editor, Esc restores the latest queued message before a later Esc can cancel the turn.

Drag across transcript text to copy it. `Alt+V` reads a clipboard image into the current session draft. PNG, JPEG, WebP, and GIF are supported; Windows uses PowerShell, macOS requires `pngpaste`, and Linux uses `wl-paste` or `xclip`.

## Commands

The TUI owns `/help`, `/model`, `/effort`, `/clear`, `/details`, `/theme`, `/rename`, `/fork`, `/status`, `/context`, `/agents`, `/jobs`, `/settings`, `/memory`, `/skill`, `/export`, `/sessions`, `/switch`, `/new`, `/assistant`, `/quit`, and `/exit`. The selected dsh composition may register additional commands.

`/skill` opens a searchable bottom selector. `/memory on|off` persists memory state per session; the Assistant defaults on and project sessions default off. Enabled sessions share durable user facts through plugin-local save, search, correction, and deletion tools. The store has no fixed-count eviction; automatic recall remains bounded to keep model context finite.

## Configuration

```yaml
- id: tui
  name: '@lk251066/dsh-tui'
  config:
    sidebarWidth: 32
    assistantCwd: '/absolute/path/to/assistant'
    showReasoning: false
    maxToolOutputLines: 6
```

`assistantCwd` defaults to `$DSH_HOME/assistant`, or `~/.dsh/assistant` when `DSH_HOME` is unset. It is recorded when the fixed Assistant is created; a persisted Assistant resumes with its recorded directory. `sidebarWidth` accepts values of 24 or greater. The sidebar hides below 65 inner columns, and a height of at least 24 rows is recommended.

The package also exports `@lk251066/dsh-tui/prompt`, `@lk251066/dsh-tui/invariant`, `@lk251066/dsh-tui/memory`, and `@lk251066/dsh-tui/workspace-agent-loop` for the bundled composition. Treat `cordis.patch.yml` as the supported entry path.

## Development and support

See the repository [development guide](https://github.com/lk251066/dsh-tui-pro/blob/master/DEVELOPMENT.md), [verification guide](https://github.com/lk251066/dsh-tui-pro/blob/master/TESTING.md), and [issue tracker](https://github.com/lk251066/dsh-tui-pro/issues).

## License

[MIT](./LICENSE). Based on the original TUI implementation from [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
