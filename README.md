# dsh-tui-pro

Community-maintained interactive terminal UI plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Release status

Version [`1.6.3`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.6.3) is the current release. Its source, artifact, empty-profile installation, and real PTY evidence are recorded in [TESTING.md](TESTING.md).

Do not use the existing `v1.0.0` GitHub tag; it predates the repaired source and bundle metadata. Install from npm or a verified GitHub Release.

The `1.6.3` source lets you click a project session in the sidebar and press `Delete` from an empty input to remove it from Active without deleting its history. See [REPAIR_PLAN.md](REPAIR_PLAN.md) for the release record.

## Intended installation

Install the released package with:

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
```

The package itself owns the TUI plugin and its `cordis.patch.yml` profile layer. There is no separate bundle package.

## Intended features

- Alternate-screen terminal interface with a full outer frame
- Persistent right-side active workspace sessions, current activity, and status sidebar
- Internal transcript paging with fixed input and status areas
- `/sessions` main-area browser across complete history, with direct activate, remove, and open actions
- Double Escape checkpoint browser for branching before an earlier turn in the current conversation
- Enter steering, Tab next-turn queueing, and empty Up recall while the agent runs
- `Alt+Left` and `Alt+Right`, `/switch`, and sidebar-click active-session switching
- Empty-input `Delete` removal for the current project session, with complete history preserved
- Direct transcript drag selection with automatic clipboard delivery
- Fixed bottom selectors for questions, approvals, models, reasoning effort, details, themes, permissions, renaming, goals, and queue actions
- A fixed personal assistant entry with workspace-session tools
- `/new` for the active project and `/new <path>` for another project
- Turn-level `You` and `Assistant` headings, syntax highlighting, diff rendering, and Markdown rendering
- Thinking blocks are hidden by default; `/details ... reasoning on` expands settled reasoning
- Tool cards support hidden, collapsed, and expanded views; diff cards show colored additions and deletions
- Approval dialogs with risk confirmation

Launching in a directory resumes its first manually ordered active project session. If that directory has no active session, dsh creates one and adds it to the workspace. To remove a project session from Active, click it in the right sidebar and press `Delete` while the input is empty. The conversation remains open and its history remains available through `/sessions`; the assistant cannot be removed.

The TUI commands are `/help`, `/model`, `/effort`, `/clear`, `/details`, `/theme`, `/queue`, `/rename`, `/fork`, `/status`, `/context`, `/agents`, `/jobs`, `/settings`, `/export`, `/sessions`, `/switch`, `/new`, `/assistant`, `/exit`, and `/quit`. `/context`, `/agents`, `/jobs`, `/settings`, and `/sessions` use the chat main area while the frame and sidebar remain fixed. dsh-base may additionally provide `/feedback`, `/goal`, `/compact`, `/permission`, and `/plan`. `/palette`, `/reload`, `/fleet`, and `/memories` are not part of this bundle.

The TUI input path currently accepts text only. Terminal paste protocols deliver text, not image bytes, so copying an image and pressing Ctrl+V does not attach it to a prompt. Image blocks already stored in a session are displayed through the attachment store with their original media type, but image capture from the system clipboard is not implemented.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for local setup and [TESTING.md](TESTING.md) for the verification sequence.

## License

MIT
