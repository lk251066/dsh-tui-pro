# Agent Note: Product README and community entry points

Status: implemented

## Problem

The repository README described a generic full-screen terminal interface and distributed equal emphasis across many controls. A visitor could not quickly identify the multi-session workflow that distinguishes the plugin, determine whether `dsh` was required, or find a direct support and community path. Hand-written release status also became stale after publication.

## Decision

The root README is the product introduction. Its first screen states the multi-session terminal-workbench role, demonstrates switching between persistent project sessions, links installation and support destinations, and gives verified commands for users with and without a global dsh installation. It explains three user outcomes before detailed controls: multiple projects in one terminal, a stable full-screen canvas, and native dsh composition.

The npm package README remains a concise runtime reference. Shared user guidance stays synchronized between the English and Chinese root READMEs. Version and CI signals use public dynamic sources instead of hand-written release status.

The demonstration uses the production TUI test composition with anonymous in-memory sessions. The generator drives the real active-session selector and resume path, validates required visible text in every frame, and packages both the static overview and animated workflow with the npm artifact.

GitHub Issues, Discussions, contribution guidance, private vulnerability reporting, repository topics, npm, Releases, and dshfind form the public project entry points.

## Alternatives considered

A longer feature inventory would move installation below implementation detail without clarifying why the plugin differs from other DSH terminal interfaces. A manually designed animation could present interactions that drift from runtime behavior. Static version and test-count badges require maintenance and can display stale claims.

## Consequences

New users can identify the product, inspect the primary workflow, and reach a working installation path from the first README screen. Maintainers can regenerate the public media without profiles, credentials, or real sessions. Public support requests collect the environment and reproduction information needed to diagnose terminal-specific behavior.
