# dsh-tui-pro Plugin Submission Draft

## Submission status

Version `1.7.1` is the current release. Its source, artifact, public-host, PTY, npm, tag, and GitHub Release records are required to identify the same release.

The public repository carries the `dsh-plugin` GitHub topic, which is dshfind's official submission mechanism. The current listing is <https://dshfind.com/zh/plugins/lk251066/dsh-tui-pro>. The page is live after publication; its directory metadata can lag the npm and Release records until the next catalog sync.

The private repository-root manifest mirrors the published package name and points `dsh.bundle.patch` at `packages/dsh-tui/cordis.patch.yml`. This lets dshfind's root-manifest probe associate the monorepo with the checksummed `@lk251066/dsh-tui` Release asset without making the repository root publishable.

The repair and acceptance evidence are tracked in [REPAIR_PLAN.md](REPAIR_PLAN.md). Catalog publication remains a separate submission action.

## Package information

| Field | Value |
| --- | --- |
| Package | `@lk251066/dsh-tui` |
| Display name | `dsh-tui-pro` |
| License | MIT |
| Repository | <https://github.com/lk251066/dsh-tui-pro> |
| npm | <https://www.npmjs.com/package/@lk251066/dsh-tui> |
| Release target | <https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.7.1> |
| dshfind submission | <https://github.com/topics/dsh-plugin> |

`@lk251066/dsh-tui` is the only supported package name. It owns both the TUI plugin and its `cordis.patch.yml` layer through the `dsh.bundle.patch` manifest field.

## Intended description

Community-maintained alternate-screen terminal UI plugin for DeepSeek Harness. It provides a fixed framed workbench with transcript-only scrolling, durable active workspace sessions, clipboard image drafts for vision-capable models, per-session long-term memory, a searchable main-area history browser, bottom-area choices, model reasoning-effort selection, syntax highlighting, diff rendering, and approval workflows.

Feature wording must be checked against the packed-artifact smoke test before submission. Do not publish test counts, compatibility claims, screenshots, or commands that were verified only through a workspace link.

## Intended installation

Use this verified installation command:

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
```

## Submission checklist

- [x] Source type check, tests, lint, and build pass at the release commit.
- [x] The local npm tarball contains all exports and `cordis.patch.yml`.
- [x] Every runtime package referenced by the rebuilt bundle resolves from a clean dsh profile.
- [x] Rebuilt tarball installation activates the package as a profile bundle.
- [x] The same checks pass on the release commit and registry package.
- [x] The packed TUI starts, opens commands, creates and switches sessions, and shuts down cleanly through a real PTY.
- [x] User-visible behavior has keyless snapshot coverage and reproducible terminal evidence.
- [x] The `1.7.1` npm version, GitHub tag, GitHub Release, and release commit agree.
- [x] The public installation command succeeds without the development workspace or `.tarballs/` directory.
- [x] The repository-root discovery metadata identifies the published plugin and its nested bundle patch for the next dshfind catalog probe.

## Public links

- Repository: <https://github.com/lk251066/dsh-tui-pro>
- Issues: <https://github.com/lk251066/dsh-tui-pro/issues>
- npm package: <https://www.npmjs.com/package/@lk251066/dsh-tui>
- Release target: <https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.7.1>
- dshfind listing: <https://dshfind.com/zh/plugins/lk251066/dsh-tui-pro>
- dshfind discovery source: <https://github.com/topics/dsh-plugin>
