# Project Status

[`@lk251066/dsh-tui@1.6.1`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.6.1) is the current release. Its source, artifact, public-host, and real PTY checks are recorded in [TESTING.md](TESTING.md).

Version `1.6.1` keeps the fixed framed workbench and durable active workspace sessions. `Alt+Left` and `Alt+Right`, `/switch`, and sidebar clicks change active sessions. Transcript dragging copies through local, tmux, or OSC-52 clipboard paths; the redundant `/copy` command is removed. Cross-workspace stopped sessions resume in the current process using their recorded workspace path. `You` and `Assistant` headings, fixed input spacing, and clickable disclosure rows make conversation structure explicit without message bubbles.

[CHANGES.md](CHANGES.md) owns current behavior. [REPAIR_PLAN.md](REPAIR_PLAN.md) records release readiness, and [TESTING.md](TESTING.md) defines the required evidence.
