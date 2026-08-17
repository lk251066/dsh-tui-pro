# Project Status

[`@lk251066/dsh-tui@1.7.0`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.7.0) is the current release. Its source, artifact, public-host, and real PTY checks are recorded in [TESTING.md](TESTING.md).

Version `1.7.0` keeps the fixed framed workbench and durable active workspace sessions, groups the sidebar by workspace, and removes duplicate status rows. New sessions use the welcome view; existing conversations use a compact header and bottom status line. `Alt+V` adds clipboard images to a session draft for vision-capable models. `/memory on|off` controls per-session enablement for shared durable memory. Enter steers, Tab queues, empty Up recalls, and Esc returns the latest queued message before cancellation. Double Escape rewinds by replacing the active source with its branch while retaining complete history.

[CHANGES.md](CHANGES.md) owns current behavior. [REPAIR_PLAN.md](REPAIR_PLAN.md) records release readiness, and [TESTING.md](TESTING.md) defines the required evidence.
