# Patch Status

No manual patch or file-copy procedure is supported for the multi-session change.

The feature must be repaired in the plugin source, covered by regression tests, and verified through a packed artifact installed by `dsh plugin`. Copying `index.ts` into the DeepSeek Harness repository would bypass package metadata, dependency resolution, and the real plugin entry path.

Follow [REPAIR_PLAN.md](REPAIR_PLAN.md) for implementation order and [TESTING.md](TESTING.md) for acceptance evidence.
