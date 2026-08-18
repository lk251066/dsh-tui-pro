# dsh-tui-pro

Community-maintained interactive terminal UI plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Release status

Version [`1.8.0`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.8.0) is the current release. The current source targets `1.8.1`; its verification status is recorded in [TESTING.md](TESTING.md).

Do not use the existing `v1.0.0` GitHub tag; it predates the repaired source and bundle metadata. Install from npm or a verified GitHub Release.

The `1.8.0` source reserves `/exit` for whole-TUI shutdown. `/quit` and empty-input `Delete` close the current project session, preserve its history, and return to the fixed assistant. The assistant can read user/assistant dialogue and image placeholders from another Active project session without exposing reasoning or tool traffic. See [REPAIR_PLAN.md](REPAIR_PLAN.md) for the implementation record.

The `1.8.1` source removes persistent top chrome from established conversations and replaces the blank row above the input area with one dim separator. The transcript owns every other available row while the pristine-session welcome remains unchanged.

## Intended installation

Install the released package with:

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
```

The package itself owns the TUI plugin and its `cordis.patch.yml` profile layer. There is no separate bundle package.

## Intended features

- Alternate-screen terminal interface with a full outer frame
- Persistent right-side active sessions grouped by workspace, with compact activity and status
- Internal transcript paging with fixed input and status areas
- `/sessions` main-area browser across complete history, with direct activate, remove, and open actions
- Double Escape checkpoint browser for returning the current conversation to an earlier turn, restoring its prompt for editing
- Enter steering, Tab next-turn queueing, empty Up recall, and Esc queue recovery while the agent runs
- `Alt+Left` and `Alt+Right`, `/switch`, and sidebar-click active-session switching
- `/quit` and empty-input `Delete` session closing, with complete history preserved
- Assistant-only paged reading of visible user/assistant dialogue from Active project sessions
- Direct transcript drag selection with automatic clipboard delivery
- Fixed bottom selectors for questions, approvals, models, reasoning effort, skills, details, themes, permissions, renaming, and goals
- `Alt+V` clipboard image attachment for vision-capable models
- Per-session `/memory on|off`, enabled by default for the assistant and disabled by default for project sessions
- A fixed personal assistant entry with workspace-session tools
- `/new` for the active project and `/new <path>` for another project
- Turn-level `You` and `Assistant` headings, syntax highlighting, diff rendering, and Markdown rendering
- Thinking blocks are hidden by default; `/details ... reasoning on` expands settled reasoning
- Tool cards support hidden, collapsed, and expanded views; diff cards show colored additions and deletions
- Approval dialogs with risk confirmation

New untitled conversations show the large welcome view. Existing conversations use the compact `dsh v{version} — {title}` header, while cwd, branch, model, and context stay in the bottom status line.

Launching in a directory resumes its first manually ordered active project session. If that directory has no active session, dsh creates one and adds it to the workspace. To close a project session, open it and run `/quit`, or press `Delete` while the input is empty. A running turn is cancelled, the session leaves Active, the assistant opens, and history remains available through `/sessions`. The assistant cannot be closed.

The TUI commands are `/help`, `/model`, `/effort`, `/clear`, `/details`, `/theme`, `/rename`, `/fork`, `/status`, `/context`, `/agents`, `/jobs`, `/settings`, `/memory`, `/skill`, `/export`, `/sessions`, `/switch`, `/new`, `/assistant`, `/exit`, and `/quit`. `/skill` opens the searchable bottom selector; `/skill <name> [instructions]` loads one user-invocable skill directly. `/exit` cancels the current turn and exits the TUI; `/quit` closes the current project session and returns to the assistant. `/help`, `/status`, `/context`, `/agents`, `/jobs`, `/settings`, and `/sessions` use the scrollable chat main area while the frame and sidebar remain fixed. dsh-base may additionally provide `/feedback`, `/goal`, `/compact`, `/permission`, and `/plan`. `/queue`, `/palette`, `/reload`, `/fleet`, and `/memories` are not part of this bundle.

Press `Alt+V` to read an image from the system clipboard and add an `[Image #N]` placeholder to the active session draft. Submission succeeds only when the selected model explicitly advertises image input; otherwise the draft is retained so a vision-capable model can be selected. PNG, JPEG, WebP, and GIF are supported. Windows uses PowerShell, macOS requires `pngpaste`, and Linux uses `wl-paste` or `xclip`.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for local setup and [TESTING.md](TESTING.md) for the verification sequence.

## License

MIT
