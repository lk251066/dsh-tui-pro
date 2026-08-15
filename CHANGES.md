# Multi-session Layout Draft

The intended user-facing change is to show the session list beside every active chat instead of limiting the split layout to the personal assistant session.

The repaired implementation establishes one shared layout before the first session mounts, keeps that layout across session switches, and passes the source-level lifecycle and focus tests. Public feature claims remain pending until the interactive checks in Phase 4 of [REPAIR_PLAN.md](REPAIR_PLAN.md) pass.

The shared layout has one owner, receives the active channel explicitly, and preserves focus and transcript state across repeated session switches. Required interactive checks are listed in [TESTING.md](TESTING.md).
