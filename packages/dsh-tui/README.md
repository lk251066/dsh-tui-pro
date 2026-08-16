# @lk251066/dsh-tui

Interactive terminal UI plugin and profile bundle for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Release status

Version `1.0.2` is published on [npm](https://www.npmjs.com/package/@lk251066/dsh-tui) with provenance and is mirrored by the checksummed [GitHub Release](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.0.2). The registry package passes empty-profile installation and real-PTY interaction against the public dsh rc.6 host.

The repository source after `1.0.2` contains an unreleased terminal workbench layout. Build and install the local artifact to test that layout; the npm `1.0.2` package still contains the released sidebar implementation.

## Installation

The supported package name is `@lk251066/dsh-tui`. It declares its own `dsh.bundle.patch`, so a separate `@lk251066/dsh-tui-bundle` package is neither required nor supported.

Install it with:

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
```

Then launch it with:

```bash
dsh --profile tui
```

On PowerShell, a DeepSeek API key can be stored for the current Windows user and reused by later terminals:

```powershell
[Environment]::SetEnvironmentVariable('DEEPSEEK_API_KEY', 'sk-your-key', 'User')
```

Open a new terminal after setting it. Do not place the key in this repository or a profile committed to Git.

For artifact and integration verification, follow [TESTING.md](../../TESTING.md).

## Usage

After successful installation and profile validation:

```bash
dsh --profile tui
```

The bundled profile opens the personal assistant session. The TUI renders transcript, tool output, dialogs, and editor in the left main area. A right sidebar keeps Workspace, Sessions, Current, and Status fixed while Page Up and Page Down scroll only the active transcript. An active inline dialog temporarily replaces the editor and restores its draft when the dialog closes.

Press F6 from the editor to focus Sessions. Use Up and Down to select, Enter to switch, and Left Arrow, F6, or Escape to return to the editor. Persisted sessions from previous processes remain available through `/resume`; the sidebar lists only sessions live in the current process.

Use `/new` for another session in the active project. Use the whole command remainder as a project path, including spaces:

```text
/new D:\work\another project
```

## Configuration

The bundled `cordis.patch.yml` installs the TUI with these defaults:

```yaml
- id: tui
  name: '@lk251066/dsh-tui'
  config:
    sessionId: assistant
    sidebarWidth: 32
    showReasoning: true
    maxToolOutputLines: 6
```

`sidebarWidth` sets the preferred right-sidebar width in terminal columns, defaults to 32, and accepts values of 24 or greater. Below 65 total columns the sidebar hides so the main area remains usable. A height of at least 24 rows is recommended to keep Workspace, Sessions, Current, Status, and the editor visible together.

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
