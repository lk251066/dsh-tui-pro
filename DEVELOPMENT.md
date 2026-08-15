# Development Guide

This guide covers local development and release verification for `@lk251066/dsh-tui`. The package is a dsh plugin and profile bundle, not a standalone application.

## Current status

The current working tree passes the source and packed-artifact checks. It is not releasable until the interactive terminal evidence and public release steps in [REPAIR_PLAN.md](REPAIR_PLAN.md) are complete.

## Prerequisites

- Node.js `^22.19.0 || >=24.0.0`
- pnpm `^11.7.0`
- A DeepSeek Harness checkout for profile and terminal integration tests

## Setup

```bash
git clone https://github.com/lk251066/dsh-tui-pro.git
cd dsh-tui-pro
pnpm install
```

Development dependencies under `@deepseek-ai/dsh-*` currently resolve from `.tarballs/`. These tarballs are development inputs only and do not prove that the published plugin can resolve its runtime dependencies.

## Local development

The adjacent DeepSeek Harness checkout may include this package as an external workspace member:

```yaml
packages:
  - packages/*/*
  - ../dsh-tui-pro/packages/*
```

The harness package that launches the profile must also declare `@lk251066/dsh-tui` as a `workspace:*` dependency. Run `pnpm install` in the harness after changing workspace membership, then build the plugin before launching the profile.

```bash
cd ../dsh-tui-pro
pnpm --filter @lk251066/dsh-tui run build

cd ../deepseekharness
pnpm dsh --profile tui
```

Workspace linking is only a development path. It can hide missing package files and runtime dependencies, so it is not release evidence.

## Repository checks

Run these commands from the plugin repository root after each repair phase:

```bash
pnpm run typecheck
pnpm run test
pnpm run lint
pnpm run build
git diff --check
```

All commands must exit successfully. Warnings require review but do not substitute for a failing exit status. See [TESTING.md](TESTING.md) for the behavior and artifact checks that follow.

## Packed-artifact test

Build and pack from the package directory so the artifact is generated from the current manifest:

```bash
pnpm --filter @lk251066/dsh-tui run build
cd packages/dsh-tui
pnpm pack --dry-run
pnpm pack --pack-destination ..
```

Inspect the generated archive before installation. It must contain `lib/index.js`, the exported declaration files, `cordis.patch.yml`, `README.md`, `LICENSE`, and a `package.json` with `dsh.bundle.patch` set to `./cordis.patch.yml`.

Use a new dsh home and a new profile for the install test:

```bash
dsh plugin --profile tui-smoke add ./lk251066-dsh-tui-<version>.tgz
dsh --profile tui-smoke --dump-config
dsh --profile tui-smoke
```

Set `DSH_HOME` to an empty temporary directory for all three commands. The install must add `@lk251066/dsh-tui` to the profile dependency list and to `dsh.profile.bundles`; the config dump must resolve every package named by the bundled patch.

## Release process

Publish only after every acceptance item in [REPAIR_PLAN.md](REPAIR_PLAN.md) is complete.

1. Commit the source, tests, generated artifacts, and documentation that describe the same version.
2. Push the reviewed commit and confirm the GitHub branch matches the local commit.
3. Run the repository checks and packed-artifact test from that commit.
4. Publish from `packages/dsh-tui` with `npm publish --access public`.
5. Confirm `npm view @lk251066/dsh-tui version` and repeat the clean-profile installation using the registry package name.
6. Create the GitHub tag and Release from the exact published commit. Attach the generated tarball and checksum when GitHub assets are used.
7. Submit the plugin registry entry only after the public installation command succeeds.

The repository provides `.github/workflows/ci.yml` for Linux and Windows pull-request checks. `.github/workflows/release.yml` is the executable public-release path: configure the repository `NPM_TOKEN` secret, merge the reviewed change, and push a tag matching the package version (for example `v1.0.1`). The workflow verifies the tag, reruns checks, publishes with npm provenance, verifies the registry version, and attaches the package tarball and SHA-256 file to the GitHub Release.

Never move or reuse the existing `v1.0.0` tag for a different commit. Choose a new version for the first verified release.

## Project structure

```text
dsh-tui-pro/
  packages/dsh-tui/
    src/                 TypeScript source
    tests/               Unit and component tests
    lib/                 Generated package output
    cordis.patch.yml     dsh profile layer
    package.json         npm and dsh bundle metadata
  .tarballs/             Development-only dsh package inputs
  REPAIR_PLAN.md         Current blockers and repair order
  TESTING.md             Verification requirements
```

## License

MIT
