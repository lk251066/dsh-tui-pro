# @lk251066/dsh-tui

[English](https://github.com/lk251066/dsh-tui-pro#readme) | [简体中文](https://github.com/lk251066/dsh-tui-pro/blob/master/README.zh-CN.md)

Interactive full-screen terminal UI plugin and profile bundle for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

![dsh-tui-pro project conversation and active-session workspace](./assets/overview.png)

## Install

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
dsh --profile tui
```

The package declares its own `dsh.bundle.patch`. A separate bundle package is neither required nor supported.

## What it provides

- A fixed full-screen canvas where only the active transcript scrolls
- A separate durable Assistant with no workspace or project directory
- Workspace-grouped Active project sessions and complete-history browsing
- Enter steering, Tab queueing, Esc queue recovery, and checkpoint rewind
- Per-session model, reasoning effort, image draft, input draft, and memory state
- Structured thinking, tools, code, diffs, plans, todo progress, and subagent output
- Bottom-area selectors for models, effort, skills, themes, settings, permissions, questions, and approvals
- Direct transcript selection and clipboard delivery

Starting in a project directory resumes its first manually ordered active session or creates one when none exists. `/new` creates another session for the current project, `/new <path>` opens another project, and `/assistant` opens the fixed Assistant. `/quit` closes the current project session while preserving history; `/exit` closes the whole TUI.

Use `/sessions` for complete history and `/switch` for the compact active-session selector. `Alt+Left` and `Alt+Right` cycle active project sessions. Empty-input `Delete` closes the selected project session. Double Escape browses checkpoints from the current conversation.

## Input and media

While the agent runs, Enter sends immediate steering and Tab queues the next turn. Empty Up recalls the latest submission. With an empty editor, Esc restores the latest queued message before a later Esc can cancel the turn.

Drag across transcript text to copy it without ANSI styles. `Alt+V` reads a clipboard image into the current session draft. Sending retains the draft unless the selected model explicitly advertises image input. PNG, JPEG, WebP, and GIF are supported; Windows uses PowerShell, macOS requires `pngpaste`, and Linux uses `wl-paste` or `xclip`.

## Commands

The TUI owns `/help`, `/model`, `/effort`, `/clear`, `/details`, `/theme`, `/rename`, `/fork`, `/status`, `/context`, `/agents`, `/jobs`, `/settings`, `/memory`, `/skill`, `/export`, `/sessions`, `/switch`, `/new`, `/assistant`, `/quit`, and `/exit`. dsh-base may add `/feedback`, `/goal`, `/compact`, `/permission`, and `/plan`.

`/skill` opens a searchable bottom selector. `/memory on|off` persists memory state per session; the Assistant defaults on and project sessions default off.

## Configuration

```yaml
- id: tui
  name: '@lk251066/dsh-tui'
  config:
    sidebarWidth: 32
    showReasoning: false
    maxToolOutputLines: 6
    maxMessageLines: 30
```

`sidebarWidth` accepts values of 24 or greater. The sidebar hides below 65 inner columns, and a height of at least 24 rows is recommended. `maxMessageLines` controls when settled assistant replies fold behind an expansion row.

The package also exports `@lk251066/dsh-tui/prompt`, `@lk251066/dsh-tui/invariant`, `@lk251066/dsh-tui/memory`, and `@lk251066/dsh-tui/workspace-agent-loop` for the bundled composition. Treat `cordis.patch.yml` as the supported entry path.

## Requirements

- Node.js `^22.19.0 || >=24.0.0`
- DeepSeek Harness `@deepseek-ai/dsh@0.1.0-rc.6`
- An ANSI-capable terminal
- `DEEPSEEK_API_KEY` configured outside the package

The package bundles the patched `@earendil-works/pi-tui@0.80.7` implementation and its required runtime dependencies.

## Development and verification

See the repository [development guide](https://github.com/lk251066/dsh-tui-pro/blob/master/DEVELOPMENT.md) and [verification guide](https://github.com/lk251066/dsh-tui-pro/blob/master/TESTING.md).

## License

MIT

## Credits

Based on the original TUI implementation from [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
