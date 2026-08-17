# Terminal Workbench

## 1.3.0 changes

The workbench remains in the terminal alternate screen with a fixed outer frame, fixed sidebar, and fixed editor. Keyboard Page Up/Page Down and mouse-wheel input scroll only the transcript; input never receives wheel escape sequences. The transcript renders user messages before the assistant response, settled thinking as a duration summary when hidden, and tool/diff cards with their configured visibility and colored change counts.

`/settings` reads the rc.6 settings document path correctly. `/effort` queries or changes only levels advertised by the current model. Model and reasoning selections belong to each live session, so switching sessions cannot leak the previous session's selection. `/fork` adds and opens the new project session, and `/export [path]` writes to the requested path.

The public command set is documented in the package README. Removed experimental or unavailable commands are not registered.

The TUI is a fixed full-screen workbench. The left area owns the transcript, tool output, dialogs, and editor. Page Up and Page Down scroll only the transcript. The right sidebar and input stay fixed inside the outer terminal frame.

The sidebar contains Workspace, Active, Current, and Status. Active is a user-maintained list, not recent-session history: it always includes the personal assistant entry, then project sessions stored through the dsh workspace registry. A stopped active session stays visible. Removing one from the list retains its session log.

`/sessions` opens complete history by default. Type to search, use Up and Down to select, Enter to open, Space to add or remove workspace membership, and Tab to switch between complete history and the active list. `/new` creates and activates a session in the current project; `/new <path>` does the same for another existing directory. `/assistant` opens the fixed assistant session.

Starting dsh in a directory resumes the first manually ordered active session for that directory. When the directory has none, startup creates a session and attaches it. A session removed from the workspace is not selected again merely because dsh later starts in the same directory.

The assistant can list, create, activate, remove, switch, and message workspace sessions through scoped tools. These capabilities do not add session-management rules to its prompt.

An active inline dialog replaces the editor area and restores the draft when it closes. Stopping the workbench exits the alternate screen and restores the invoking terminal.

Required source, artifact, clean-profile, and PTY checks are listed in [TESTING.md](TESTING.md).
