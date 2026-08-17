# dsh-tui-pro

Community-maintained interactive terminal UI plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Release status

Version [`1.7.0`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.7.0) is the current release. Its source, artifact, empty-profile installation, and real PTY evidence are recorded in [TESTING.md](TESTING.md).

Do not use the existing `v1.0.0` GitHub tag; it predates the repaired source and bundle metadata. Install from npm or a verified GitHub Release.

The `1.7.0` source adds session-scoped clipboard image drafts and per-session enablement for shared durable memory, makes rewind replace the active branch, and simplifies the fixed workbench without changing the manually maintained Active-session model. See [REPAIR_PLAN.md](REPAIR_PLAN.md) for the release record.

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
- Empty-input `Delete` removal for the current project session, with complete history preserved
- Direct transcript drag selection with automatic clipboard delivery
- Fixed bottom selectors for questions, approvals, models, reasoning effort, details, themes, permissions, renaming, and goals
- `Alt+V` clipboard image attachment for vision-capable models
- Per-session `/memory on|off`, enabled by default for the assistant and disabled by default for project sessions
- A fixed personal assistant entry with workspace-session tools
- `/new` for the active project and `/new <path>` for another project
- Turn-level `You` and `Assistant` headings, syntax highlighting, diff rendering, and Markdown rendering
- Thinking blocks are hidden by default; `/details ... reasoning on` expands settled reasoning
- Tool cards support hidden, collapsed, and expanded views; diff cards show colored additions and deletions
- Approval dialogs with risk confirmation

New untitled conversations show the large welcome view. Existing conversations use the compact `dsh v{version} — {title}` header, while cwd, branch, model, and context stay in the bottom status line.

Launching in a directory resumes its first manually ordered active project session. If that directory has no active session, dsh creates one and adds it to the workspace. To remove a project session from Active, click it in the right sidebar and press `Delete` while the input is empty. The conversation remains open and its history remains available through `/sessions`; the assistant cannot be removed.

The TUI commands are `/help`, `/model`, `/effort`, `/clear`, `/details`, `/theme`, `/rename`, `/fork`, `/status`, `/context`, `/agents`, `/jobs`, `/settings`, `/memory`, `/export`, `/sessions`, `/switch`, `/new`, `/assistant`, `/exit`, and `/quit`. `/context`, `/agents`, `/jobs`, `/settings`, and `/sessions` use the chat main area while the frame and sidebar remain fixed. dsh-base may additionally provide `/feedback`, `/goal`, `/compact`, `/permission`, and `/plan`. `/queue`, `/palette`, `/reload`, `/fleet`, and `/memories` are not part of this bundle.

Press `Alt+V` to read an image from the system clipboard and add an `[Image #N]` placeholder to the active session draft. Submission succeeds only when the selected model explicitly advertises image input; otherwise the draft is retained so a vision-capable model can be selected. PNG, JPEG, WebP, and GIF are supported. Windows uses PowerShell, macOS requires `pngpaste`, and Linux uses `wl-paste` or `xclip`.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for local setup and [TESTING.md](TESTING.md) for the verification sequence.

## License

MIT
