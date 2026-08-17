# Project Status

[`@lk251066/dsh-tui@1.6.3`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.6.3) is the current release. Its source, artifact, public-host, and real PTY checks are recorded in [TESTING.md](TESTING.md).

Version `1.6.3` keeps the fixed framed workbench and durable active workspace sessions. `Alt+Left` and `Alt+Right`, `/switch`, and sidebar clicks change active sessions. After selecting a project session in the sidebar, empty-input `Delete` removes it from Active without closing the conversation or deleting history. Transcript dragging copies through local, tmux, or OSC-52 clipboard paths; `/copy` is not registered. Stored session images render with complete attachment metadata; clipboard image paste is not supported.

[CHANGES.md](CHANGES.md) owns current behavior. [REPAIR_PLAN.md](REPAIR_PLAN.md) records release readiness, and [TESTING.md](TESTING.md) defines the required evidence.
