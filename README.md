# dsh-tui-pro

Community-maintained interactive terminal UI plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Release status

Version [`1.6.0`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.6.0) is the current release. Its source, artifact, empty-profile installation, and real PTY evidence are recorded in [TESTING.md](TESTING.md).

Do not use the existing `v1.0.0` GitHub tag; it predates the repaired source and bundle metadata. Install from npm or a verified GitHub Release.

The `1.6.0` source adds reliable active-session switching, direct transcript selection and clipboard delivery, clearer conversation turns, and clickable thinking, tool, diff, and context disclosures inside the fixed workbench. See [REPAIR_PLAN.md](REPAIR_PLAN.md) for the release record.

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
- Direct transcript drag selection with automatic clipboard delivery and `/copy` for the latest assistant reply
- Fixed bottom selectors for questions, approvals, models, reasoning effort, details, themes, permissions, renaming, goals, and queue actions
- A fixed personal assistant entry with workspace-session tools
- `/new` for the active project and `/new <path>` for another project
- Turn-level `You` and `Assistant` headings, syntax highlighting, diff rendering, and Markdown rendering
- Thinking blocks are hidden by default; `/details ... reasoning on` expands settled reasoning
- Tool cards support hidden, collapsed, and expanded views; diff cards show colored additions and deletions
- Approval dialogs with risk confirmation

Launching in a directory resumes its first manually ordered active project session. If that directory has no active session, dsh creates one and adds it to the workspace. Removing a session from the workspace retains its history.

The TUI commands are `/help`, `/model`, `/effort`, `/clear`, `/details`, `/theme`, `/queue`, `/rename`, `/fork`, `/status`, `/context`, `/agents`, `/jobs`, `/settings`, `/export`, `/sessions`, `/switch`, `/copy`, `/new`, `/assistant`, `/exit`, and `/quit`. `/context`, `/agents`, `/jobs`, `/settings`, and `/sessions` use the chat main area while the frame and sidebar remain fixed. dsh-base may additionally provide `/feedback`, `/goal`, `/compact`, `/permission`, and `/plan`. `/palette`, `/reload`, `/fleet`, and `/memories` are not part of this bundle.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for local setup and [TESTING.md](TESTING.md) for the verification sequence.

## License

MIT
