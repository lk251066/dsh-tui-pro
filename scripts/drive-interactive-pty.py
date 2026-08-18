#!/usr/bin/env python3
"""Drive the dsh TUI in a real PTY with minimal terminal responses."""

from __future__ import annotations

import argparse
import errno
import fcntl
import os
import pty
import select
import signal
import struct
import sys
import termios
import time
from pathlib import Path


FRAME_MARKERS = (b"Workspace", b"Active", b"Status", b"Perm", b"plan")
FORBIDDEN_MARKERS = (
    b"fatal load failure",
    b"plugin tree failed to load",
    b"setPrompt is not a function",
    b"TUI prompt value",
    b"ERR_MODULE_NOT_FOUND",
)
TERMINAL_RESPONSES = (
    (b"\x1b[?996n", b"\x1b[?997;1n"),
    (b"\x1b[?u", b"\x1b[?0u"),
    (b"\x1b[c", b"\x1b[?1;2c"),
    (b"\x1b[16t", b"\x1b[6;18;9t"),
)
INTERACTIONS = (
    (0.0, b"/help\r"),
    (0.4, b"\x1b"),
    (0.3, b"/settings\r"),
    (0.4, b"\x1b"),
    (0.2, b"/effort\r"),
    (0.5, b"/details collapsed reasoning off\r"),
    (0.2, b"/theme dracula\r"),
    (0.2, b"/rename PTY command audit\r"),
    (0.2, b"/context\r"),
    (0.4, b"\x1b"),
    (0.2, b"/agents\r"),
    (0.4, b"\x1b"),
    (0.2, b"/jobs\r"),
    (0.4, b"\x1b"),
    (0.2, b"/memory\r"),
    (0.2, b"/memory on\r"),
    (0.2, b"/memory off\r"),
    (0.2, b"\x1bv"),
    (0.6, b"\x1b"),
    (0.2, b"/status\r"),
    (0.6, b"\x1b"),
    (0.6, b"/export ../pty-export.md\r"),
    (0.3, b"\x1b[<64;10;4M"),
    (0.2, b"\x1b[<65;10;4M"),
    (0.2, b"/new\r"),
    (0.4, b"/switch previous\r"),
    (0.3, b"/switch next\r"),
    (0.3, b"\x1b[1;3D"),
    (0.3, b"\x1b[1;3C"),
    (0.3, b"/switch\r"),
    (0.4, b"\x1b"),
    (0.8, b"/fork\r"),
    (0.3, b"/sessions\r"),
    (0.5, b"\x1b"),
    (0.2, b"/assistant\r"),
    (0.8, b"/exit\r"),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--capture", required=True)
    parser.add_argument("--cwd", required=True)
    parser.add_argument("--env", action="append", default=[])
    parser.add_argument("--columns", type=int, default=140)
    parser.add_argument("--rows", type=int, default=32)
    parser.add_argument("--timeout", type=float, default=45.0)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.command[:1] == ["--"]:
        args.command = args.command[1:]
    if not args.command:
        parser.error("a command is required after --")
    return args


def child_environment(entries: list[str]) -> dict[str, str]:
    environment = os.environ.copy()
    for entry in entries:
        key, separator, value = entry.partition("=")
        if not separator or not key:
            raise ValueError(f"invalid --env entry: {entry!r}")
        environment[key] = value
    return environment


def set_window_size(fd: int, rows: int, columns: int) -> None:
    size = struct.pack("HHHH", rows, columns, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, size)


def stop_child(pid: int) -> None:
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    time.sleep(0.2)
    try:
        os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def main() -> int:
    args = parse_args()
    environment = child_environment(args.env)
    capture_path = Path(args.capture)
    capture_path.parent.mkdir(parents=True, exist_ok=True)

    pid, master_fd = pty.fork()
    if pid == 0:
        os.chdir(args.cwd)
        os.execvpe(args.command[0], args.command, environment)

    set_window_size(master_fd, args.rows, args.columns)
    os.set_blocking(master_fd, False)
    output = bytearray()
    responded: set[bytes] = set()
    interaction_index = 0
    next_interaction_at: float | None = None
    deadline = time.monotonic() + args.timeout
    child_status: int | None = None

    try:
        while time.monotonic() < deadline:
            ready, _, _ = select.select([master_fd], [], [], 0.05)
            if ready:
                try:
                    chunk = os.read(master_fd, 65536)
                except OSError as error:
                    if error.errno != errno.EIO:
                        raise
                    chunk = b""
                if chunk:
                    output.extend(chunk)
                    recent = bytes(output[-4096:])
                    for query, response in TERMINAL_RESPONSES:
                        if query in recent and query not in responded:
                            os.write(master_fd, response)
                            responded.add(query)

            if next_interaction_at is None and all(marker in output for marker in FRAME_MARKERS):
                next_interaction_at = time.monotonic()

            if next_interaction_at is not None and interaction_index < len(INTERACTIONS):
                delay, payload = INTERACTIONS[interaction_index]
                if time.monotonic() >= next_interaction_at + delay:
                    os.write(master_fd, payload)
                    interaction_index += 1
                    next_interaction_at = time.monotonic()

            finished_pid, status = os.waitpid(pid, os.WNOHANG)
            if finished_pid == pid:
                child_status = status
                break
    finally:
        capture_path.write_bytes(output)
        if child_status is None:
            stop_child(pid)
            _, child_status = os.waitpid(pid, 0)
        os.close(master_fd)

    missing = [marker.decode() for marker in FRAME_MARKERS if marker not in output]
    forbidden = [marker.decode() for marker in FORBIDDEN_MARKERS if marker in output]
    exit_code = os.waitstatus_to_exitcode(child_status)
    if missing:
        print(f"PTY capture did not render: {', '.join(missing)}", file=sys.stderr)
        return 1
    if forbidden:
        print(f"PTY capture contains errors: {', '.join(forbidden)}", file=sys.stderr)
        return 1
    if interaction_index != len(INTERACTIONS):
        print("PTY interaction sequence did not finish", file=sys.stderr)
        return 1
    if exit_code != 0:
        print(f"TUI exited with status {exit_code}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
