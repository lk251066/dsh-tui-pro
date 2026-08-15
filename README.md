# dsh-tui-pro

Community-maintained interactive terminal UI plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Release status

The source tree and a newly packed `@lk251066/dsh-tui@1.0.1` artifact pass the source, package-content, and empty-profile runtime checks against public `@deepseek-ai/dsh@0.1.0-rc.6`. The repaired version is not yet reviewed or published to npm.

Do not use the existing `v1.0.0` GitHub tag or repository-root `lk251066-dsh-tui-1.0.0.tgz`. They predate the repaired source and bundle metadata. The current local package artifact is a verification input, not a public release.

See [REPAIR_PLAN.md](REPAIR_PLAN.md) for the blocking defects, repair order, and release acceptance criteria.

## Intended installation

After the package is published and the release checks pass, the supported installation command will be:

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
```

The package itself owns the TUI plugin and its `cordis.patch.yml` profile layer. There is no separate bundle package.

## Intended features

- Full-screen terminal interface
- Multi-session navigation and session resume
- Personal assistant session with optional memory integration
- Fleet monitoring across sessions
- Syntax highlighting, diff rendering, and Markdown rendering
- Approval dialogs with risk confirmation

These features remain release candidates until the interactive TTY smoke, user-visible evidence, reviewed GitHub commit, and public registry checks in [REPAIR_PLAN.md](REPAIR_PLAN.md) are complete.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for local setup and [TESTING.md](TESTING.md) for the verification sequence.

## License

MIT
