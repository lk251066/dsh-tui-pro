# @lk251066/dsh-tui

Interactive terminal UI plugin and profile bundle for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Release status

Version [`1.6.1`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.6.1) is the current release. Its source, artifact, empty-profile installation, and real PTY evidence are recorded in [TESTING.md](../../TESTING.md).

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

The bundled profile opens the active project session for the current directory. If the directory has no active session, it creates one and adds it to the workspace. The TUI enters the terminal alternate screen and renders a full outer frame. Transcript, tool output, and editor occupy the left inner area; a right sidebar keeps Workspace, Active, Current, and Status fixed while Page Up, Page Down, and the mouse wheel scroll only the active transcript. Short choices replace the fixed bottom input area without popup borders. Stopping the TUI restores the invoking terminal and its scrollback.

Use `/sessions` to replace the left chat area with complete history while the outer frame and right sidebar remain fixed. Up and Down select a row, Enter opens it, Tab switches between complete history and the active list, and Space adds or removes a project session from the active workspace list. Escape returns to the transcript. Removing membership never deletes the session log. Use `/assistant` for the fixed personal assistant session.

Use `Alt+Left` and `Alt+Right` from an empty editor to cycle active workspace sessions without opening a browser. Use `/switch` for the bottom selector, or `/switch next`, `/switch previous`, `/switch <number>`, and `/switch <exact title>` for direct switching. Clicking an active row in the right sidebar opens it. Stopped sessions resume in the current process using each session's own workspace path, including sessions from another workspace. Persisted session titles are shown before a stopped session is opened.

Drag directly across transcript text with the left mouse button to select and copy it. ANSI styles are removed from copied text, while Chinese and emoji graphemes remain intact. Local terminals use the system clipboard; tmux uses its clipboard forwarding; SSH and other unsupported local clipboard paths use OSC 52. The mouse wheel continues to scroll transcript history while mouse reporting is active.

The TUI input path currently accepts text only. Terminal paste protocols deliver text, not image bytes, so copying an image and pressing Ctrl+V does not attach it to a prompt. Image blocks already stored in a session can be displayed, but image capture from the system clipboard is not implemented.

Conversation turns use `You` and `Assistant` headings instead of message bubbles. Thinking, individual tool calls, grouped tool calls, diffs, and injected context show `▶` or `▼`; click their header to expand or collapse that block. `Ctrl+O` and `Ctrl+R` remain the global visibility controls.

While the agent is running, Enter sends the editor text as immediate steering and Tab queues it for the next turn. Empty Up recalls the latest Enter or Tab submission; resubmitting the same queued text replaces that queue entry. Double Escape opens checkpoints from the current conversation only when the agent is idle and the editor is empty. Left or Escape selects an older checkpoint, Right selects a newer one, Enter creates and activates a branch before the selected turn, and `Ctrl+C` or `q` closes the view. This is separate from `/sessions`, which browses complete session history.

The TUI owns these commands: `/help`, `/model`, `/effort`, `/clear`, `/details`, `/theme`, `/queue`, `/rename`, `/fork`, `/status`, `/context`, `/agents`, `/jobs`, `/settings`, `/export`, `/exit`, `/quit`, `/sessions`, `/switch`, `/new`, and `/assistant`. `/context`, `/agents`, `/jobs`, `/settings`, and `/sessions` replace the left main area and preserve the outer frame and active-workspace sidebar. `/effort` only accepts reasoning levels advertised by the selected model; model and effort selections are independent for each live session. dsh-base may add `/feedback`, `/goal`, `/compact`, `/permission`, and `/plan`. The bundle does not provide `/palette`, `/reload`, `/fleet`, or `/memories`.

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
    sidebarWidth: 32
    showReasoning: false
    maxToolOutputLines: 6
```

`sidebarWidth` sets the preferred right-sidebar width in terminal columns, defaults to 32, and accepts values of 24 or greater. The outer frame reserves one row and column on each edge. Below 65 total columns the sidebar hides so the main area remains usable. A height of at least 24 rows is recommended to keep Workspace, Sessions, Current, Status, and the editor visible together.

The package also exports `@lk251066/dsh-tui/prompt` and `@lk251066/dsh-tui/invariant` for its bundle composition. Treat the bundled patch as the supported entry path; direct manual profile composition must provide every service injected by the TUI.

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
