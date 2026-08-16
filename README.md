# dsh-tui-pro

Community-maintained interactive terminal UI plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Release status

Version `1.0.2` is publicly available on [npm](https://www.npmjs.com/package/@lk251066/dsh-tui) and in the [GitHub Release](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.0.2). The npm package, `v1.0.2` tag, and checksummed Release identify the same reviewed source.

Do not use the existing `v1.0.0` GitHub tag; it predates the repaired source and bundle metadata. Install from npm or a verified GitHub Release.

The source tree, published package, empty-profile installation, and real-PTY runtime pass against public `@deepseek-ai/dsh@0.1.0-rc.6`. Version `1.0.2` adds the persistent workspace sidebar and fixed operational status display. See [REPAIR_PLAN.md](REPAIR_PLAN.md) for the completed repair record and release evidence.

Version [`1.2.0`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.2.0) adds durable active workspace sessions and unified history management while retaining the framed terminal workbench from `1.1.0`. Its checksummed [GitHub Release](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.2.0) identifies the same commit.

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
- A fixed personal assistant entry with optional memory integration
- `/new` for the active project and `/new <path>` for another project
- Fleet monitoring across sessions
- Syntax highlighting, diff rendering, and Markdown rendering
- Approval dialogs with risk confirmation

Launching in a directory resumes its first manually ordered active project session. If that directory has no active session, dsh creates one and adds it to the workspace. Removing a session from the workspace retains its history.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for local setup and [TESTING.md](TESTING.md) for the verification sequence.

## License

MIT
