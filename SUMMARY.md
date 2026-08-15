# Project Status

[`@lk251066/dsh-tui@1.0.1`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.0.1) is independently installable from npm into an empty profile hosted by public `@deepseek-ai/dsh@0.1.0-rc.6`. The package includes the required patched terminal editor, every default bundle plugin is a runtime dependency, and the unpublished memory plugin is absent.

The registry package passes a real PTY flow covering startup, optional-memory diagnostics, new sessions, the assistant session, the session picker, keyboard switching, and clean shutdown. [Pull request #1](https://github.com/lk251066/dsh-tui-pro/pull/1), commit [`e521522`](https://github.com/lk251066/dsh-tui-pro/commit/e521522cf969a916193cd646fa204d156b9facc8), the annotated `v1.0.1` tag, npm package, and [GitHub Release](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.0.1) are aligned.

[REPAIR_PLAN.md](REPAIR_PLAN.md) is the authoritative repair plan and progress document. [TESTING.md](TESTING.md) records the audit baseline and the evidence required before release.

The public release is complete. Catalog submission can use [PLUGIN_SUBMISSION.md](PLUGIN_SUBMISSION.md); publication to npm and GitHub does not itself add the plugin to an external catalog.
