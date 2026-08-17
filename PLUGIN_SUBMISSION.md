# dsh-tui-pro Plugin Submission Draft

## Submission status

Version `1.4.0` is the current release target. Version `1.3.0` remains public until the new source, artifact, public-host, and PTY checks pass and the matching tag publishes.

The public repository now carries the `dsh-plugin` GitHub topic, which is dshfind's official submission mechanism. dshfind synchronizes that topic daily at 10:17 China Standard Time. Its current public snapshot does not yet contain `lk251066/dsh-tui-pro`; the next successful site sync is required before its listing URL can be verified.

The repair and acceptance evidence are tracked in [REPAIR_PLAN.md](REPAIR_PLAN.md). Catalog publication remains a separate submission action.

## Package information

| Field | Value |
| --- | --- |
| Package | `@lk251066/dsh-tui` |
| Display name | `dsh-tui-pro` |
| License | MIT |
| Repository | <https://github.com/lk251066/dsh-tui-pro> |
| npm | <https://www.npmjs.com/package/@lk251066/dsh-tui> |
| Release target | <https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.4.0> |
| dshfind submission | <https://github.com/topics/dsh-plugin> |

`@lk251066/dsh-tui` is the only supported package name. It owns both the TUI plugin and its `cordis.patch.yml` layer through the `dsh.bundle.patch` manifest field.

## Intended description

Community-maintained alternate-screen terminal UI plugin for DeepSeek Harness. It provides a fixed framed workbench with transcript-only scrolling, durable active workspace sessions, a searchable main-area history browser, bottom-area choices, a personal assistant session, model reasoning-effort selection, syntax highlighting, diff rendering, and approval workflows.

Feature wording must be checked against the packed-artifact smoke test before submission. Do not publish test counts, compatibility claims, screenshots, or commands that were verified only through a workspace link.

## Intended installation

Use this verified installation command:

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
```

## Submission checklist

- [ ] Source type check, tests, lint, and build pass at the release commit.
- [ ] The local npm tarball contains all exports and `cordis.patch.yml`.
- [ ] Every runtime package referenced by the rebuilt bundle resolves from a clean dsh profile.
- [ ] Rebuilt tarball installation activates the package as a profile bundle.
- [ ] The same checks pass on the release commit and registry package.
- [ ] The packed TUI starts, opens commands, creates and switches sessions, and shuts down cleanly through a real PTY.
- [ ] User-visible behavior has keyless snapshot coverage and reproducible terminal evidence.
- [ ] The `1.4.0` npm version, GitHub tag, GitHub Release, and release commit agree.
- [ ] The public installation command succeeds without the development workspace or `.tarballs/` directory.

## Public links

- Repository: <https://github.com/lk251066/dsh-tui-pro>
- Issues: <https://github.com/lk251066/dsh-tui-pro/issues>
- npm package: <https://www.npmjs.com/package/@lk251066/dsh-tui>
- Release target: <https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.4.0>
- dshfind discovery source: <https://github.com/topics/dsh-plugin>
