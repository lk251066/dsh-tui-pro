# Agent Note: Session closing and assistant conversation reads

Status: implemented

Supersedes the active-session removal behavior in `2026-08-17-terminal-interaction-routing.md`.

## Problem

The TUI used `/exit` and `/quit` as aliases for whole-process shutdown while `Delete` only removed Active membership and left the selected conversation mounted. The fixed assistant could manage and message Active project sessions but could not inspect their visible dialogue, so it lacked the context needed to coordinate them.

## Decision

`/exit` owns bounded whole-TUI shutdown. `/quit` and empty-input `Delete` close the current project session through one operation: cancel a running turn, open the fixed assistant, detach Active membership, remove the project slot, dispose an owned agent handle, and retain durable history. Active-detachment failure returns to the project. The fixed assistant cannot be closed.

The assistant receives one read-only `read_session_conversation` tool. It accepts only an Active project session id and reads the live-preferred durable log without activating the target. The projection keeps append-origin direct user text, image placeholders, and completed assistant text. It omits reasoning, tool traffic, diffs, injected context, replacement events, and unfinished chunks. Results start with the newest bounded page and expose an earlier-page cursor. Active membership is checked before and after the read.

## Alternatives considered

Keeping `/quit` as an `/exit` alias leaves no command for the more frequent workspace action. Detaching membership while leaving the project mounted makes a closed session remain current and can hide running work outside Active. Reading raw logs exposes internal events and replacement history; activating or resuming a target merely to inspect it changes user-visible state.

## Consequences

Closing a project has one command and keyboard path, and the assistant becomes the predictable destination. Removed sessions remain recoverable through `/sessions`. The assistant can coordinate Active projects from their visible dialogue without receiving hidden reasoning or tool data. Tests cover cancellation, handle disposal, rollback, assistant protection, pagination, Active authorization, image placeholders, and excluded event classes.
