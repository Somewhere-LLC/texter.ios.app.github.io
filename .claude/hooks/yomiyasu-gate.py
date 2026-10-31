#!/usr/bin/env python3
"""Claude Code hook. git commit (PreToolUse, Bash): exit 2 blocks on lint failure.
Edit or Write of page text (PostToolUse): returns the findings as context right away.
Every path logs one line, so "fired and did nothing" differs from "did not fire"."""
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
LOG = os.path.expanduser("~/.claude/logs/texter-site-yomiyasu.log")
PAGE = re.compile(r"(\.html$|/scripts/(guides|seo)/)")


def log(msg):
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {msg}\n")
    except OSError:
        pass


def run_check(staged=False):
    """A commit is judged on its staged snapshot, an edit on the working tree."""
    if staged:
        cmd = ["bash", os.path.join(ROOT, "scripts/check-yomiyasu-staged.sh")]
    else:
        cmd = [sys.executable, os.path.join(ROOT, "scripts/check-yomiyasu.py")]
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=90)
    return r.returncode, (r.stderr or r.stdout).strip()


try:
    data = json.load(sys.stdin)
except ValueError:
    log("skip: invalid stdin")
    sys.exit(0)
tool, event = data.get("tool_name"), data.get("hook_event_name")
inp = data.get("tool_input") or {}
try:
    if event == "PreToolUse" and tool == "Bash":
        if not re.search(r"(^|[;&|\s])git(\s+-\S+(\s+\S+)?)*\s+commit\b", inp.get("command", "")):
            log("skip: bash without git commit")
            sys.exit(0)
        code, out = run_check(staged=True)
        log(f"commit gate rc={code}")
        if code == 1:
            print(out, file=sys.stderr)
            sys.exit(2)
    elif event == "PostToolUse" and tool in ("Edit", "Write"):
        path = inp.get("file_path", "")
        if not PAGE.search(path):
            log(f"skip: not a page {os.path.basename(path)}")
            sys.exit(0)
        code, out = run_check()
        log(f"edit check rc={code} {os.path.basename(path)}")
        if code == 1:
            print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": out[:3000]}}, ensure_ascii=False))
    else:
        log(f"skip: {event} {tool}")
except subprocess.SubprocessError as e:
    log(f"error: {e}")
sys.exit(0)
