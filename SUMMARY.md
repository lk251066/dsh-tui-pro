# Project Status

`@lk251066/dsh-tui` passes its source checks, produces a self-contained npm tarball, and installs into an empty profile hosted by public `@deepseek-ai/dsh@0.1.0-rc.6`. The artifact includes the required patched terminal editor, every default bundle plugin is a runtime dependency, and the unpublished memory plugin is absent.

The packed artifact passes a real PTY flow covering startup, optional-memory diagnostics, new sessions, the assistant session, the session picker, keyboard switching, and clean shutdown. Release remains pending until the pull request is reviewed and merged, npm publication is verified from a clean profile, and the GitHub tag and Release identify the published commit.

[REPAIR_PLAN.md](REPAIR_PLAN.md) is the authoritative repair plan and progress document. [TESTING.md](TESTING.md) records the audit baseline and the evidence required before release.

Do not describe the plugin as publicly released or ready for dshfind.com until every release acceptance item in the repair plan is complete.
