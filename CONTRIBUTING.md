# Contributing

Thanks for helping improve dsh-tui-pro. Bug reports, terminal compatibility findings, focused fixes, and interaction improvements are welcome.

## Before opening an issue

Use the issue templates and include the plugin version, dsh version, operating system, terminal, reproduction steps, and the exact visible error. Remove API keys, local paths, session content, and other private data from logs and screenshots.

## Development setup

Follow [DEVELOPMENT.md](DEVELOPMENT.md) to install dependencies, run the TUI from source, and understand the package layout.

Before opening a pull request, run the checks that cover the change:

```bash
pnpm run typecheck
pnpm run test
pnpm run lint
pnpm run build
```

Changes to installation, bundle composition, packaging, or terminal interaction also need the relevant artifact and PTY checks from [TESTING.md](TESTING.md).

## Pull requests

Keep each pull request focused on one behavior. Describe the user-visible result, list the commands you ran, and include or update tests for behavior changes. Update the root English and Chinese READMEs together when shared user guidance changes.

Do not commit credentials, local profiles, real session logs, generated test output, or screenshots containing private data.
