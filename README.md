# dsh-tui-pro

Community-maintained interactive terminal UI plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Release status

Version `1.0.2` is publicly available on [npm](https://www.npmjs.com/package/@lk251066/dsh-tui) and in the [GitHub Release](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.0.2). The npm package, `v1.0.2` tag, and checksummed Release identify the same reviewed source.

Do not use the existing `v1.0.0` GitHub tag; it predates the repaired source and bundle metadata. Install from npm or a verified GitHub Release.

The source tree, published package, empty-profile installation, and real-PTY runtime pass against public `@deepseek-ai/dsh@0.1.0-rc.6`. Version `1.0.2` adds the persistent workspace sidebar and fixed operational status display. See [REPAIR_PLAN.md](REPAIR_PLAN.md) for the completed repair record and release evidence.

The current source contains the `1.1.0` full-screen workbench. It uses the terminal alternate screen, so the invoking shell remains unchanged after exit; chat history scrolls only inside the framed left pane while the right sidebar and input remain fixed. Use a locally packed artifact until npm publishes `1.1.0`; npm still serves `1.0.2`.

## Intended installation

Install the released package with:

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
```

The package itself owns the TUI plugin and its `cordis.patch.yml` profile layer. There is no separate bundle package.

## Intended features

- Alternate-screen terminal interface with a full outer frame
- Persistent right-side workspace, live-session, current-activity, and status sidebar
- Internal transcript paging with fixed input and status areas
- Multi-session navigation and session resume
- Personal assistant as the default session, with optional memory integration
- `/new` for the active project and `/new <path>` for another project
- Fleet monitoring across sessions
- Syntax highlighting, diff rendering, and Markdown rendering
- Approval dialogs with risk confirmation

The current source passes 442 tests, clean build and packing, empty-profile installation against public dsh rc.6, and a real Linux PTY flow. Version `1.1.0` is prepared in the source manifest but is not published.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for local setup and [TESTING.md](TESTING.md) for the verification sequence.

## License

MIT
