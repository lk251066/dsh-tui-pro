# dsh-tui-pro Plugin Submission Draft

## Submission status

Version `1.2.0` is published. The GitHub release workflow repeated the source, package, clean-profile public-host, snapshot, and real-PTY checks from commit `a3ead1b`, then published npm and its checksummed GitHub Release. The npm package, annotated tag, GitHub commit, and release assets identify the same version.

The public repository now carries the `dsh-plugin` GitHub topic, which is dshfind's official submission mechanism. dshfind synchronizes that topic daily at 10:17 China Standard Time. Its current public snapshot does not yet contain `lk251066/dsh-tui-pro`; the next successful site sync is required before its listing URL can be verified.

The completed repair and acceptance evidence are tracked in [REPAIR_PLAN.md](REPAIR_PLAN.md). Catalog publication remains a separate submission action.

## Package information

| Field | Value |
| --- | --- |
| Package | `@lk251066/dsh-tui` |
| Display name | `dsh-tui-pro` |
| License | MIT |
| Repository | <https://github.com/lk251066/dsh-tui-pro> |
| npm | <https://www.npmjs.com/package/@lk251066/dsh-tui> |
| Verified release | <https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.2.0> |
| dshfind submission | <https://github.com/topics/dsh-plugin> |

`@lk251066/dsh-tui` is the only supported package name. It owns both the TUI plugin and its `cordis.patch.yml` layer through the `dsh.bundle.patch` manifest field.

## Intended description

Community-maintained alternate-screen terminal UI plugin for DeepSeek Harness. It provides a fixed framed workbench with transcript-only scrolling, durable active workspace sessions, searchable complete history, a personal assistant session, syntax highlighting, diff rendering, and approval workflows.

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
- [x] The npm version, GitHub tag, GitHub Release, and release commit agree.
- [x] The public installation command succeeds without the development workspace or `.tarballs/` directory.

## Public links

- Repository: <https://github.com/lk251066/dsh-tui-pro>
- Issues: <https://github.com/lk251066/dsh-tui-pro/issues>
- npm package: <https://www.npmjs.com/package/@lk251066/dsh-tui>
- Verified GitHub Release: <https://github.com/lk251066/dsh-tui-pro/releases/tag/v1.2.0>
- dshfind discovery source: <https://github.com/topics/dsh-plugin>
