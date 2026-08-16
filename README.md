# dsh-tui-pro

Community-maintained interactive terminal UI plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Release status

Version `1.0.1` is publicly available on [npm](https://www.npmjs.com/package/@lk251066/dsh-tui) and in the [GitHub Release](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.0.1). The npm package, `v1.0.1` tag, and Release all identify commit [`e521522`](https://github.com/lk251066/dsh-tui-pro/commit/e521522cf969a916193cd646fa204d156b9facc8).

Do not use the existing `v1.0.0` GitHub tag or repository-root `lk251066-dsh-tui-1.0.0.tgz`. They predate the repaired source and bundle metadata. Treat repository-local tarballs as verification inputs; install from npm or the `v1.0.1` Release.

The source tree, published package, empty-profile installation, and real-PTY runtime pass against public `@deepseek-ai/dsh@0.1.0-rc.6`. See [REPAIR_PLAN.md](REPAIR_PLAN.md) for the completed repair record and release evidence.

The current working tree also contains an unreleased persistent workspace sidebar. It is not part of `1.0.1` until a new reviewed commit, package version, tag, and Release are published together.

## Intended installation

Install the released package with:

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
```

The package itself owns the TUI plugin and its `cordis.patch.yml` profile layer. There is no separate bundle package.

## Intended features

- Full-screen terminal interface
- Persistent workspace, live-session, and active-agent status sidebar
- Multi-session navigation and session resume
- Personal assistant session with optional memory integration
- Fleet monitoring across sessions
- Syntax highlighting, diff rendering, and Markdown rendering
- Approval dialogs with risk confirmation

The `1.0.1` feature set passes the published-package PTY smoke and repository snapshot suite. The unreleased sidebar passes source checks, 440 tests, artifact packing, and clean-profile public-host loading. It still requires a new real-PTY verification and a version bump before the next release.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for local setup and [TESTING.md](TESTING.md) for the verification sequence.

## License

MIT
