# Agent Note: Session image drafts and shared memory

Status: implemented

## Problem

Clipboard images and long-term memory both add model-visible context, but they have different durability. An image belongs to one unsent session draft. A saved user fact is durable and useful across sessions, while each session still needs an explicit choice about whether those facts and tools enter its agent scope.

## Decision

Each live TUI slot owns an image draft. `Alt+V` reads PNG, JPEG, WebP, or GIF bytes through a platform clipboard adapter, persists the attachment, and inserts an `[Image #N]` placeholder. Submission resolves the selected model metadata and requires `image` in its input modalities. A missing model, text-only model, failed metadata lookup, or changed active draft leaves the draft available for correction. Successful submission clears only that slot's draft.

One storage-domain service owns shared durable memories and per-session enablement. The fixed assistant defaults to enabled and project sessions default to disabled. `/memory on|off` persists an explicit session setting. An enabled agent receives `memory_save`, `memory_search`, memory guidance, and bounded recalled context; disabling it disposes those registrations without deleting stored memories.

Image drafts and memory registrations follow session adoption and disposal. They never attach to the terminal root or leak across a session switch merely because the editor and workbench chrome are shared.

## Alternatives considered

Treating clipboard images as terminal text cannot preserve image bytes or media type. Sending without checking model metadata defers a predictable capability failure and can lose the user's draft. A global memory switch cannot express the assistant-on and project-off defaults or isolate sensitive project sessions. Separate memory stores per session prevent the assistant from recalling facts saved in another enabled session.

## Consequences

The bundle includes the TUI memory service and consumes the single attachment service supplied by the supported dsh-base composition. Loading another local attachment provider would duplicate that service and prevent startup. Tests cover platform clipboard decoding, draft limits and isolation, multimodal message construction, unsupported-model retention, durable memory limits, defaults, tool installation, and disposal.
