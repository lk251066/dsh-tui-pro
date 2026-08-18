# Project Status

[`@lk251066/dsh-tui@1.8.0`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.8.0) is the current release. The current source targets `1.8.1`; its verification status is recorded in [TESTING.md](TESTING.md).

The `1.8.0` source reserves `/exit` for whole-TUI shutdown. `/quit` and empty-input `Delete` cancel and close the current project session, preserve its history, and return to the assistant. The assistant can read paged user/assistant dialogue from another Active project session without receiving reasoning, tool traffic, diffs, injected context, or unfinished output.

Help and read-only diagnostics open over the main chat area without adding rows to the transcript. `/status` reports the latest session event time, while `/context`, `/agents`, `/jobs`, and `/settings` use the same bounded view with line, page, and endpoint scrolling.

The `1.8.1` source removes the persistent top header from established conversations. A single dim rule separates the expanded transcript viewport from the fixed input area; the welcome box remains limited to pristine sessions. User bands and assistant Markdown distinguish speakers without separate `You` or `Assistant` heading rows. Assistant replies begin one row after user messages, the input prompt has no `dsh` prefix, and the bottom line shows the current step's rolling output rate only while streaming.

[CHANGES.md](CHANGES.md) owns current behavior. [REPAIR_PLAN.md](REPAIR_PLAN.md) records release readiness, and [TESTING.md](TESTING.md) defines the required evidence.
