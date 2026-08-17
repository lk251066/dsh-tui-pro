# Project Status

[`@lk251066/dsh-tui@1.6.2`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.6.2) is the current release. Its source, artifact, public-host, and real PTY checks are recorded in [TESTING.md](TESTING.md).

Version `1.6.2` keeps the fixed framed workbench and durable active workspace sessions. `Alt+Left` and `Alt+Right`, `/switch`, and sidebar clicks change active sessions. Transcript dragging copies through local, tmux, or OSC-52 clipboard paths; `/copy` is not registered. Stopped sessions resume in the current process using their recorded workspace path, failed setup is released for retry, and delayed title loading replaces raw session ids when a stored title exists. Stored session images render with complete attachment metadata; clipboard image paste is not supported.

[CHANGES.md](CHANGES.md) owns current behavior. [REPAIR_PLAN.md](REPAIR_PLAN.md) records release readiness, and [TESTING.md](TESTING.md) defines the required evidence.
