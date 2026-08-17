# Project Status

[`@lk251066/dsh-tui@1.3.0`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.3.0) is the current public package. Its annotated tag, npm package, and [GitHub Release](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.3.0) identify release commit `8fca5ec`.

Version `1.3.0` keeps the fixed framed workbench and durable active workspace sessions. It fixes settings inspection, adds `/effort`, isolates model selection by live session, routes mouse-wheel input to the transcript, and removes unavailable commands from the public command list. The sidebar shows the assistant plus user-maintained project sessions; `/sessions` owns complete history; current-directory startup resumes an active project session or creates and activates one.

[CHANGES.md](CHANGES.md) owns current behavior. [REPAIR_PLAN.md](REPAIR_PLAN.md) records release readiness, and [TESTING.md](TESTING.md) defines the required evidence.
