# dsh-tui-pro

[English](README.md) | [简体中文](README.zh-CN.md)

**A multi-session terminal workbench for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).** Keep a durable Assistant and the project sessions you actively maintain in one full-screen TUI.

[![npm version](https://img.shields.io/npm/v/@lk251066/dsh-tui?style=flat-square&color=3b82f6)](https://www.npmjs.com/package/@lk251066/dsh-tui)
[![CI](https://img.shields.io/github/actions/workflow/status/lk251066/dsh-tui-pro/ci.yml?branch=master&style=flat-square&label=CI)](https://github.com/lk251066/dsh-tui-pro/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](LICENSE)

![dsh-tui-pro switching between persistent project sessions in one terminal workbench](packages/dsh-tui/assets/session-workbench.gif)

[Install](#quick-start) · [Latest release](https://github.com/lk251066/dsh-tui-pro/releases/latest) · [dshfind](https://dshfind.com/zh/plugins/lk251066/dsh-tui-pro) · [Report an issue](https://github.com/lk251066/dsh-tui-pro/issues/new/choose)

## Quick start

You need Node.js `^22.19.0 || >=24.0.0` and `DEEPSEEK_API_KEY` configured outside this repository.

Already have the [`dsh` CLI](https://github.com/deepseek-ai/deepseek-harness)? Install the plugin and its profile layer once:

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
```

Then launch it from any project directory:

```bash
dsh --profile tui
```

Without a global dsh installation, use the same profile through `npx`:

```bash
npx -y @deepseek-ai/dsh@latest plugin --profile tui add @lk251066/dsh-tui
npx -y @deepseek-ai/dsh@latest --profile tui
```

The package owns both the TUI plugin and its `cordis.patch.yml` profile layer. No second bundle package is required.

## Why this TUI

### One terminal, multiple projects

The Assistant is a durable session outside every project workspace. Active project sessions stay grouped by workspace in the fixed sidebar, so long-running work remains available without repeatedly leaving and resuming sessions.

### A stable full-screen canvas

Only the transcript scrolls. The editor, current plan, live status, model, context usage, and active sessions remain in place while user messages, Markdown, thinking, tools, diffs, plans, todos, and subagents use distinct compact treatments.

### Native DeepSeek Harness composition

The package is an out-of-tree dsh plugin bundle, not a fork of the harness. Sessions, tools, skills, models, permissions, compaction, and subagents continue to use the services provided by the selected dsh profile.

## Session workflow

Launching from a directory opens its first manually ordered active project session. If the directory has none, dsh creates one and adds it to that workspace.

- `/new` creates another session in the current project.
- `/new <path>` creates a session for another project.
- `/assistant` returns to the fixed Assistant.
- `/switch`, `Alt+Left`, `Alt+Right`, or a sidebar click changes the active project session.
- `/quit` closes the current project session, preserves its history, and returns to the Assistant.
- `/sessions` browses complete history; `/exit` closes the TUI.

The Assistant can manage active project sessions and read their completed user/assistant dialogue. Hidden reasoning, tool traffic, and unfinished output are not exposed across sessions.

## Interaction

| Action | Control |
| --- | --- |
| Send immediate steering | `Enter` while a turn is running |
| Queue the next turn | `Tab` |
| Recover the latest queued message | `Esc` before cancellation |
| Recall the latest submission | Empty-input `Up` |
| Browse current-conversation checkpoints | Double `Esc` |
| Expand tool and context detail | `Ctrl+O` |
| Expand settled reasoning | `Ctrl+R` |
| Select and copy transcript text | Drag with the left mouse button |
| Attach a clipboard image | `Alt+V` |
| Control session memory | `/memory`, `/memory on`, `/memory off` |

Run `/help` for the complete command list. Models, reasoning effort, skills, themes, settings, permissions, questions, and approvals use the fixed bottom area instead of centered popup windows.

## Images and terminals

`@` completes workspace files. `Alt+V` attaches a clipboard image when the selected model advertises image input. Windows uses PowerShell to read clipboard images, macOS requires `pngpaste`, and Linux requires `wl-paste` or `xclip`.

The TUI requires an ANSI-capable terminal. The sidebar hides below 65 inner columns, and a terminal height of at least 24 rows is recommended.

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

See the [package reference](packages/dsh-tui/README.md) for the supported entry path and exported composition plugins.

## Project links

- [npm package](https://www.npmjs.com/package/@lk251066/dsh-tui)
- [GitHub releases](https://github.com/lk251066/dsh-tui-pro/releases)
- [Community discussions](https://github.com/lk251066/dsh-tui-pro/discussions)
- [Development setup](DEVELOPMENT.md)
- [Verification guide](TESTING.md)
- [Change history](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)

This plugin follows the developer-preview dsh release line. Each release is checked from source, from its packed npm artifact, through a clean public dsh profile, and through a real Linux PTY before publication.

![Complete dsh-tui-pro workbench with structured tool output and plan progress](packages/dsh-tui/assets/overview.png)

## License

[MIT](LICENSE). Based on the original TUI implementation from [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
