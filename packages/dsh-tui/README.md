# @lk251066/dsh-tui

Interactive terminal UI plugin and profile bundle for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Release status

This package is not published to npm. Its packed artifact passes installation and real-PTY interaction against the public dsh rc.6 host, but release still requires the reviewed commit, registry verification, tag, and GitHub Release in [REPAIR_PLAN.md](../../REPAIR_PLAN.md).

## Installation

The supported package name is `@lk251066/dsh-tui`. It declares its own `dsh.bundle.patch`, so a separate `@lk251066/dsh-tui-bundle` package is neither required nor supported.

After an npm release is available, install it with:

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
```

For local artifact testing before publication, follow [TESTING.md](../../TESTING.md). Do not use the repository-root `lk251066-dsh-tui-1.0.0.tgz`; it predates the required bundle metadata.

## Usage

After successful installation and profile validation:

```bash
dsh --profile tui
```

## Configuration

The bundled `cordis.patch.yml` installs the TUI with these defaults:

```yaml
- id: tui
  name: '@lk251066/dsh-tui'
  config:
    sessionId: main
    showReasoning: true
    maxToolOutputLines: 6
```

The package also exports `@lk251066/dsh-tui/prompt` and `@lk251066/dsh-tui/invariant` for its bundle composition. Treat the bundled patch as the supported entry path; direct manual profile composition must provide every service injected by the TUI. Long-term memory is optional and is not mounted by the default bundle because no compatible public `@deepseek-ai/dsh-memory` package is available.

## Runtime requirements

- Node.js `^22.19.0 || >=24.0.0`
- DeepSeek Harness `@deepseek-ai/dsh@0.1.0-rc.6` (the verified public host)
- A terminal with ANSI escape-sequence support

The bundle declares every non-host plugin it loads as a runtime dependency. Its Service Definition peers, runtime plugins, and development checks all use the public rc.6 package line.

The npm artifact bundles the repository-patched `@earendil-works/pi-tui@0.80.7` implementation and its two runtime dependencies. The TUI prompt prefixes, frameless editor rows, and dynamic `setPrompt()` API depend on that implementation; consumers do not need pnpm patch configuration.

## Development

See [DEVELOPMENT.md](../../DEVELOPMENT.md).

## License

MIT

## Credits

Based on the original TUI implementation from [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
