# Terminal Workbench

## 1.8.1 source changes

Established conversations no longer reserve a persistent top header or its surrounding blank rows. The transcript begins at the top of the main column and uses every row above the fixed input area. The new-session welcome remains visible only before conversation activity begins.

The editor frame is the only boundary below the transcript; a second full-width rule no longer repeats that edge. The reclaimed row belongs to the transcript, and scrolling, disclosure clicks, and drag selection use the expanded viewport coordinates.

User message bands and assistant Markdown now provide the speaker distinction directly. The repeated `You` and `Assistant` heading rows and their heading timestamps are removed. The user fill is deliberately subtle on dark terminals, while message wrapping, reasoning, tool cards, and reply folding remain unchanged.

Assistant replies now open one row below the preceding user message or tool output. The editor prompt no longer repeats `dsh`; it contains only the idle caret or the current running-state glyph.

The bottom status line now reports the current model step's rolling output rate instead of the completed-session weighted average. It estimates tokens from text and tool-argument deltas emitted during the latest two seconds, refreshes while streaming, resets for each step, and disappears when that step finishes. The working row keeps only its action and elapsed time; cwd and branch are dim, while model and live rate remain readable without competing with the transcript.

The Active-session list uses one status glyph per row and accents only the current title. The redundant current-row arrow is removed, and multi-workspace group labels are dim instead of bold.

## 1.8.0 source changes

`/exit` closes the whole TUI. `/quit` and empty-input `Delete` close the current project session: a running turn is cancelled, Active membership and the mounted session slot are removed, owned agent resources are released, history remains available through `/sessions`, and the fixed assistant becomes current. The assistant itself cannot be closed.

The fixed assistant can read another Active project session through its scoped `read_session_conversation` tool. The result contains only direct user text, image placeholders, and completed assistant text. It excludes reasoning, tool calls and results, diffs, injected context, and unfinished streaming output. Long conversations are read newest-page first and support earlier-page continuation.

The fixed status line includes weighted-average `token/s`, and plan mode uses its own palette role in the prompt and sidebar. `/help`, `/status`, `/context`, `/agents`, `/jobs`, and `/settings` open in one bounded main-area viewer with line, page, Home, and End navigation. `/skill` opens a searchable bottom selector, while `/skill <name> [instructions]` supports name completion and direct invocation without filling the top-level command list with one entry per skill.

Streaming reasoning shows a live elapsed time until answer text begins. Read, search, web fetch/search, error, and diff results use structured terminal cards with source lines, grouped matches, URLs, summaries, and consistent result markers. In-process subagents inherit the provider, model, and explicit reasoning effort used by the delegating parent request instead of its creation-time route.

## 1.7.0 changes

The fixed workbench keeps one compact header, a workspace-grouped Active-session list, and a compact Status section. The bottom line is the single home for cwd, branch, model, and context. New untitled sessions show the welcome view until their first user message. The outer frame remains fixed while only the transcript scrolls.

Running input uses Enter for immediate steering and Tab for the next turn. Empty Up recalls the latest submission. With an empty editor, Esc first returns the latest queued message to the editor; Esc can cancel the turn when no queued message remains. `/queue` is not registered.

Double Escape remains the current-conversation checkpoint navigator. Confirming a checkpoint replaces the source session in Active with its branch and restores the selected prompt for editing. The source log remains available through `/sessions`, so repeated rewind does not grow the active list.

`Alt+V` reads PNG, JPEG, WebP, or GIF data from the system clipboard and adds an `[Image #N]` placeholder to that session's draft. Sending requires a selected model that explicitly advertises image input. A text-only or unknown model retains the draft.

`/memory`, `/memory on`, and `/memory off` control long-term memory for the current session. The assistant defaults on and project sessions default off. Enabled sessions can save and search the shared durable memory store; disabling a session removes its memory tools and prompt sections without deleting stored memories.

## 1.6.3 changes

Click a project session in the right sidebar, then press `Delete` from an empty input to remove it from `Active sessions`. The current conversation remains open and usable, and its complete history remains available through `/sessions`. The assistant cannot be removed. A non-empty input keeps normal editor `Delete` behavior.

## 1.6.2 changes

Stopped active sessions now keep their display title when the session-query service finishes mounting shortly after the TUI. Resuming a stopped session releases the newly created agent if workspace attachment or UI adoption fails, so the same session can be opened again instead of remaining blocked by an invisible live agent.

Stored image blocks pass their complete attachment reference to the attachment store. PNG, JPEG, WebP, and GIF history therefore retain their media type and dimensions when rendered. This repairs existing session history only; terminal paste remains text-only and does not attach an image copied to the system clipboard.

## 1.6.1 changes

The right sidebar labels its count as `Active sessions · N` so it is clear that the section is the manually maintained active-workspace list, not recent history. Stopped sessions from another workspace resume in the current process using their session cwd; the host handoff remains available when that resume cannot be created. The `/copy` command is removed because transcript drag selection is the single copy path.

The TUI input path accepts text only. Image blocks can be rendered when already present in a session, but terminal clipboard image capture and image attachment on Ctrl+V are not supported.

## 1.6.0 changes

Active-session switching now uses guarded `Alt+Left` and `Alt+Right`, the `/switch` command, and direct sidebar clicks. The old `Ctrl+PageUp` and `Ctrl+PageDown` bindings are removed so they cannot conflict with transcript navigation or terminal key handling.

Left-button dragging selects transcript cells directly and copies plain text on release. Selection preserves multi-line blank rows and complete wide graphemes, coexists with wheel scrolling, and clears when a terminal resize changes line wrapping. Clipboard delivery supports the local system, tmux forwarding, and OSC 52.

Conversation turns now use separate `You` and `Assistant` headings with consistent blank space before the editor. Thinking, tool, grouped-tool, diff, and context headers show disclosure markers and respond to clicks. The existing restrained running-state animation remains above the input without moving the fixed sidebar.

## 1.5.0 changes

Running input now has two explicit paths. Enter sends immediate steering for the current turn, while Tab queues text for the next turn. Empty Up recalls the latest real Enter or Tab submission, and resubmitting an unchanged queued item replaces it instead of creating a duplicate. Queued session-reference context is applied with the queued turn rather than injected into the turn already running.

Double Escape opens checkpoint navigation for the current conversation when the agent is idle and the editor is empty. The navigator creates a new branch before the selected turn and preserves the original session. `/sessions` remains the separate complete-history browser.

`Ctrl+PageUp` and `Ctrl+PageDown` cycle the active workspace sessions. Stopped sessions in the startup workspace resume in the current process, while sessions from another workspace use host handoff. Duplicate open requests are ignored until the first request completes. Persisted titles are loaded for stopped active sessions.

`/context`, `/agents`, `/jobs`, and `/settings` now replace the chat main area like `/sessions`, leaving the full-screen frame and active-workspace sidebar fixed.

## 1.4.0 changes

Built-in choices now use the fixed bottom interaction area without popup borders. This applies to questions, approvals, model and reasoning-effort selection, transcript details, themes, permissions, session renaming, goal actions, and queue actions. The transcript stays visible above the selector and the right sidebar remains fixed.

`/sessions` is a main-area browser rather than a bottom selector. It replaces only the left chat area while open, so complete history has room for search and session details without covering the outer frame or the active-workspace sidebar. Escape returns to the same session transcript and editor.

## 1.3.0 changes

The workbench remains in the terminal alternate screen with a fixed outer frame, fixed sidebar, and fixed editor. Keyboard Page Up/Page Down and mouse-wheel input scroll only the transcript; input never receives wheel escape sequences. The transcript renders user messages before the assistant response, settled thinking as a duration summary when hidden, and tool/diff cards with their configured visibility and colored change counts.

`/settings` reads the rc.6 settings document path correctly. `/effort` queries or changes only levels advertised by the current model. Model and reasoning selections belong to each live session, so switching sessions cannot leak the previous session's selection. `/fork` adds and opens the new project session, and `/export [path]` writes to the requested path.

The public command set is documented in the package README. Removed experimental or unavailable commands are not registered.

The TUI is a fixed full-screen workbench. The left area owns the transcript, tool output, dialogs, and editor. Page Up and Page Down scroll only the transcript. The right sidebar and input stay fixed inside the outer terminal frame.

The sidebar contains Workspace, Active, Current, and Status. Active is a user-maintained list, not recent-session history: it always includes the personal assistant entry, then project sessions stored through the dsh workspace registry. A stopped active session stays visible. Removing one from the list retains its session log.

`/sessions` opens complete history by default. Type to search, use Up and Down to select, Enter to open, Space to add or remove workspace membership, and Tab to switch between complete history and the active list. `/new` creates and activates a session in the current project; `/new <path>` does the same for another existing directory. `/assistant` opens the fixed assistant session.

Starting dsh in a directory resumes the first manually ordered active session for that directory. When the directory has none, startup creates a session and attaches it. A session removed from the workspace is not selected again merely because dsh later starts in the same directory.

The assistant can list, create, activate, remove, switch, message, and read the visible dialogue of workspace sessions through scoped tools. These capabilities do not add session-management rules to its prompt.

An active inline dialog replaces the editor area and restores the draft when it closes. Stopping the workbench exits the alternate screen and restores the invoking terminal.

Required source, artifact, clean-profile, and PTY checks are listed in [TESTING.md](TESTING.md).
