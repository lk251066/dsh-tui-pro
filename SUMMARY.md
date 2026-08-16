# Project Status

[`@lk251066/dsh-tui@1.0.2`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.0.2) is independently installable from npm into an empty profile hosted by public `@deepseek-ai/dsh@0.1.0-rc.6`. The package includes the persistent workspace sidebar, fixed operational status display, required patched terminal editor, and every default bundle runtime dependency; the unpublished memory plugin remains absent.

The registry package passes a real PTY flow covering the visible sidebar, startup, optional-memory diagnostics, new sessions, the assistant session, the session picker, keyboard switching, and clean shutdown. The annotated `v1.0.2` tag, npm package, and [GitHub Release](https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.0.2) are aligned.

The persistent sidebar keeps workspace, session, status, and queue information visible beside long transcripts and after terminal resizing, and keeps detached session titles and running state current. The packed and registry plugin pass empty-profile loading and a real-PTY screen replay that contains every sidebar section.

[REPAIR_PLAN.md](REPAIR_PLAN.md) is the authoritative repair plan and progress document. [TESTING.md](TESTING.md) records the audit baseline and the evidence required before release.

The public release is complete. Catalog submission can use [PLUGIN_SUBMISSION.md](PLUGIN_SUBMISSION.md); publication to npm and GitHub does not itself add the plugin to an external catalog.
