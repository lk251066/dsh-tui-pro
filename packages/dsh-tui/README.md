# @lk251066/dsh-tui

Interactive terminal UI plugin and profile bundle for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Release status

Version `1.0.1` is published on [npm](https://www.npmjs.com/package/@lk251066/dsh-tui) with provenance and is mirrored by the checksummed [GitHub Release](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.0.1). The registry package passes empty-profile installation and real-PTY interaction against the public dsh rc.6 host.

## Installation

The supported package name is `@lk251066/dsh-tui`. It declares its own `dsh.bundle.patch`, so a separate `@lk251066/dsh-tui-bundle` package is neither required nor supported.

Install it with:

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
```

For artifact and integration verification, follow [TESTING.md](../../TESTING.md). Do not use the repository-root `lk251066-dsh-tui-1.0.0.tgz`; it predates the required bundle metadata.

## Usage

After successful installation and profile validation:

```bash
dsh --profile tui
```

The TUI keeps a left workspace sidebar mounted beside the active chat. Workspace shows the active directory and branch, Sessions lists the live sessions in the current process, and Status shows the active agent, model, context, token, cache, queue, permission, and plan values. The fixed prompt context remains below the editor.

Press Left Arrow from the editor to focus Sessions. Use Up and Down to select, Enter to switch, and Right Arrow or Escape to return to the editor. Persisted sessions from previous processes remain available through `/resume`; the sidebar lists only sessions live in the current process.

## Configuration

The bundled `cordis.patch.yml` installs the TUI with these defaults:

```yaml
- id: tui
  name: '@lk251066/dsh-tui'
  config:
    sessionId: main
    sidebarWidth: 32
    showReasoning: true
    maxToolOutputLines: 6
```

`sidebarWidth` sets the preferred workspace sidebar width in terminal columns, defaults to 32, and accepts values of 24 or greater. The sidebar never auto-hides. Below 65 total columns it keeps its 24-column minimum and the chat uses the remaining space; below 26 columns both panes shrink. A height of at least 24 rows is recommended to keep Workspace, Sessions, Status, and the editor visible together. The sidebar stays aligned with the visible end of long transcripts.

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
