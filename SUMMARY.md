# Project Status

[`@lk251066/dsh-tui@1.7.1`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.7.1) is the current release. The current source targets `1.8.0`; its verification status is recorded in [TESTING.md](TESTING.md).

The `1.8.0` source reserves `/exit` for whole-TUI shutdown. `/quit` and empty-input `Delete` cancel and close the current project session, preserve its history, and return to the assistant. The assistant can read paged user/assistant dialogue from another Active project session without receiving reasoning, tool traffic, diffs, injected context, or unfinished output.

[CHANGES.md](CHANGES.md) owns current behavior. [REPAIR_PLAN.md](REPAIR_PLAN.md) records release readiness, and [TESTING.md](TESTING.md) defines the required evidence.
