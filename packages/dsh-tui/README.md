# @lk251066/dsh-tui

Interactive terminal UI plugin and profile bundle for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Release status

Version [`1.8.0`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.8.0) is the current release. The current source targets `1.8.1`; its verification status is recorded in [TESTING.md](../../TESTING.md).

The `1.8.1` source gives established conversations the full main-column height above the framed input. Persistent top chrome, blank padding, and the repeated full-width input rule are removed; the welcome box remains limited to pristine sessions. The bottom line reports the current step's rolling `token/s` estimate while output is streaming. The editor prompt contains only `>` or the current running-state glyph, without a repeated `dsh` prefix.

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

The bundled profile opens the active project session for the current directory. If the directory has no active session, it creates one and adds it to the workspace. The TUI enters the terminal alternate screen and renders a full outer frame. Transcript, tool output, and editor occupy the left inner area; a right sidebar keeps Workspace, workspace-grouped Active sessions, and Status fixed while Page Up, Page Down, and the mouse wheel scroll only the active transcript. Short choices replace the fixed bottom input area without popup borders. Stopping the TUI restores the invoking terminal and its scrollback.

A pristine conversation opens with a rounded welcome box: the block logo, the configured welcome line, the live model and directory, and a few suggested commands. The box sweeps in left-to-right on startup and the logo shimmers once. Any conversation traffic removes the welcome box and leaves the transcript unobstructed. The bottom status line contains cwd, branch, model, context, and the active step's rolling output rate. The rate uses streamed text from the latest two seconds and disappears when generation finishes. Because providers report exact usage only after generation, the live value estimates one token per four emitted characters. The sidebar Status section contains agent state, plan mode, tokens, cache, and permission.

Use `/sessions` to replace the left chat area with complete history while the outer frame and right sidebar remain fixed. Up and Down select a row, Enter opens it, Tab switches between complete history and the active list, and Space adds or removes a project session from the active workspace list. Escape returns to the transcript. Removing membership never deletes the session log. Use `/assistant` for the fixed personal assistant session.

Use `Alt+Left` and `Alt+Right` from an empty editor to cycle active workspace sessions without opening a browser. Use `/switch` for the bottom selector, or `/switch next`, `/switch previous`, `/switch <number>`, and `/switch <exact title>` for direct switching. Clicking an active row in the right sidebar opens it. With that project session selected, run `/quit` or press `Delete` while the input is empty to close it. A running turn is cancelled, the session leaves Active, owned live resources are released, and the assistant opens; history remains available through `/sessions`. The assistant cannot be closed, and a non-empty input keeps normal editor `Delete` behavior. Stopped sessions resume in the current process using each session's own workspace path, including sessions from another workspace. Persisted session titles are shown before a stopped session is opened.

Drag directly across transcript text with the left mouse button to select and copy it. ANSI styles are removed from copied text, while Chinese and emoji graphemes remain intact. Local terminals use the system clipboard; tmux uses its clipboard forwarding; SSH and other unsupported local clipboard paths use OSC 52. The mouse wheel continues to scroll transcript history while mouse reporting is active.

Press `Alt+V` to read an image from the system clipboard and add an `[Image #N]` placeholder to the active session draft. Each session keeps its own draft. Backspace immediately after a placeholder deletes the whole token and drops that image from the draft; only images whose placeholder still appears in the editor text are attached on send. Sending checks the selected model through dsh and proceeds only when that model explicitly advertises image input; a text-only or unknown model leaves the text and images in the editor. PNG, JPEG, WebP, and GIF are supported. Windows uses PowerShell, macOS requires `pngpaste`, and Linux uses `wl-paste` or `xclip`.

Conversation turns do not repeat `You` or `Assistant` labels. Your own messages stand apart as a subtle full-width band filled with a background a shade off the terminal's own (the one background fill in an otherwise foreground-only palette), with a `›` marker and hanging body indent; assistant replies remain bare Markdown one row below the preceding user message or tool output. Shown thinking carries a dim `▎` quote bar, and a settled tool card keeps its status color only on the glyph while its title drops to dim. Code blocks carry the same dim `▎` left bar, and a paired diff row emphasizes its changed words in bold over the line color. A settled reply longer than `maxMessageLines` rendered lines folds to a head preview ending in a `… +M lines (click to expand)` row; a streaming reply always renders in full. Thinking, individual tool calls, grouped tool calls, diffs, and injected context show `▶` or `▼`; click their header to expand or collapse that block. `Ctrl+O` and `Ctrl+R` remain the global visibility controls. The input frame stays dim, starts directly with `>` or a running-state glyph, and flags only the two modes that change what a submission does: plan mode in accent, the danger permission preset in warning.

While the agent is running, Enter sends the editor text as immediate steering and Tab queues it for the next turn. Empty Up recalls the latest Enter or Tab submission; resubmitting the same queued text replaces that queue entry. With an empty editor, Esc returns the latest queued message to the editor before a later Esc can cancel the running turn. Double Escape opens checkpoints from the current conversation only when the agent is idle and the editor is empty. Left or Escape selects an older checkpoint, Right selects a newer one, Enter branches the conversation to just before the selected turn and replaces the current session with that branch in the active list (the rewound-away log stays in complete history), and `Ctrl+C` or `q` closes the view. This is separate from `/sessions`, which browses complete session history.

The TUI owns these commands: `/help`, `/model`, `/effort`, `/clear`, `/details`, `/theme`, `/rename`, `/fork`, `/status`, `/context`, `/agents`, `/jobs`, `/settings`, `/memory`, `/skill`, `/export`, `/exit`, `/quit`, `/sessions`, `/switch`, `/new`, and `/assistant`. `/skill` opens a searchable selector in the bottom interaction area; `/skill <name> [instructions]` loads one user-invocable skill directly, and completion is available for the name argument. `/exit` cancels the current turn and exits the TUI; `/quit` closes the current project session and returns to the assistant. `/help`, `/status`, `/context`, `/agents`, `/jobs`, `/settings`, and `/sessions` replace the left main area with a bounded scrollable view and preserve the outer frame and active-workspace sidebar. `/effort` only accepts reasoning levels advertised by the selected model; model and effort selections are independent for each live session. `/memory` reports the current session setting, while `/memory on` and `/memory off` persist it; an enabled session shows `mem on` in the status row. The fixed assistant defaults to memory on and project sessions default to off. Its scoped `read_session_conversation` tool reads paged user/assistant dialogue from another Active project session while excluding reasoning, tools, diffs, injected context, and unfinished output. Enabled sessions receive `memory_save` and `memory_search`; stored memories are shared so another enabled session can recall them. dsh-base may add `/feedback`, `/goal`, `/compact`, `/permission`, and `/plan`. The bundle does not provide `/queue`, `/palette`, `/reload`, `/fleet`, or `/memories`.

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
    maxMessageLines: 30
```

`sidebarWidth` sets the preferred right-sidebar width in terminal columns, defaults to 32, and accepts values of 24 or greater. The outer frame reserves one row and column on each edge. Below 65 total columns the sidebar hides so the main area remains usable. A height of at least 24 rows is recommended to keep Workspace, Active sessions, Status, and the editor visible together. `maxMessageLines` caps a settled assistant reply at that many rendered lines (default 30, minimum 1) before it folds behind a click-to-expand disclosure row.

The package also exports `@lk251066/dsh-tui/prompt`, `@lk251066/dsh-tui/invariant`, and `@lk251066/dsh-tui/memory` for its bundle composition. Treat the bundled patch as the supported entry path; direct manual profile composition must provide every service injected by the TUI, including attachment storage and the memory storage domain.

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
