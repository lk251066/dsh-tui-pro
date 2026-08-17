# dsh-tui-pro

Community-maintained interactive terminal UI plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Release status

Version [`1.3.0`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.3.0) is published on npm. Its [GitHub Release](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.3.0), annotated tag, and npm package identify release commit `8fca5ec`.

Do not use the existing `v1.0.0` GitHub tag; it predates the repaired source and bundle metadata. Install from npm or a verified GitHub Release.

Version `1.3.0` keeps durable workspace sessions and the framed workbench from `1.2.0`, fixes settings and model-effort commands, isolates model selection per session, and routes mouse-wheel input to the transcript. See [REPAIR_PLAN.md](REPAIR_PLAN.md) for the release record.

## Intended installation

Install the released package with:

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
```

The package itself owns the TUI plugin and its `cordis.patch.yml` profile layer. There is no separate bundle package.

## Intended features

- Alternate-screen terminal interface with a full outer frame
- Persistent right-side active workspace sessions, current activity, and status sidebar
- Internal transcript paging with fixed input and status areas
- `/sessions` search across complete history, with direct activate, remove, and open actions
- A fixed personal assistant entry with workspace-session tools
- `/new` for the active project and `/new <path>` for another project
- Syntax highlighting, diff rendering, and Markdown rendering
- Thinking blocks are hidden by default; `/details ... reasoning on` expands settled reasoning
- Tool cards support hidden, collapsed, and expanded views; diff cards show colored additions and deletions
- Approval dialogs with risk confirmation

Launching in a directory resumes its first manually ordered active project session. If that directory has no active session, dsh creates one and adds it to the workspace. Removing a session from the workspace retains its history.

The TUI commands are `/help`, `/model`, `/effort`, `/clear`, `/details`, `/theme`, `/queue`, `/rename`, `/fork`, `/status`, `/context`, `/agents`, `/jobs`, `/settings`, `/export`, `/sessions`, `/new`, `/assistant`, `/exit`, and `/quit`. dsh-base may additionally provide `/feedback`, `/goal`, `/compact`, `/permission`, and `/plan`. `/palette`, `/reload`, `/fleet`, and `/memories` are not part of this bundle.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for local setup and [TESTING.md](TESTING.md) for the verification sequence.

## License

MIT
