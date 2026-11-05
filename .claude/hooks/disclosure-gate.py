#!/usr/bin/env python3
"""Public-disclosure gate for this public repository.

The repo, its commit messages, and its PR text are readable by anyone. This gate blocks text that names
backend vendors or internal identifiers, holds secrets, or hints at weaknesses. See .claude/rules/public-disclosure.md.

Modes
  (stdin JSON)          Claude Code PreToolUse (Bash): scans the text of git commit / gh pr|issue|release writes. exit 2 blocks.
  --staged              scans the added lines of the staged diff (git pre-commit). exit 1 on findings.
  --msg FILE            scans a commit message file (git commit-msg). exit 1 on findings.
  --tree                scans every tracked source and page file (npm run build). exit 1 on findings.
  --self-test           runs the gate against synthetic cases.
  --add-token WORD      stores the hash of WORD so the name itself never enters the repo.
  --add-baseline PATH KEY   allows one existing finding (a legal text, for example). Review it in the PR.

Vendor names and internal identifiers are stored as hashes in disclosure-data.json, so this repo does not publish them.
Every path logs one line, so "fired and found nothing" differs from "did not fire".
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA_FILE = os.path.join(HERE, "disclosure-data.json")
LOG = os.path.expanduser("~/.claude/logs/texter-site-disclosure.log")
# This gate and its rule describe the categories, so they are not scanned.
SELF = re.compile(r"^(\.claude/hooks/disclosure-|\.claude/rules/public-disclosure\.md$)")
SKIP_PATH = re.compile(r"^(dist/|node_modules/|assets/|img/|scripts/vendor/|\.git/)|package-lock\.json$")
TEXT_EXT = re.compile(r"\.(html|xml|txt|md|json|js|py|sh|css|conf|yml|yaml)$|^\.githooks/")

PATTERNS = {
    "secret-aws-key": r"\bAKIA[0-9A-Z]{16}\b",
    "secret-google-key": r"\bAIza[0-9A-Za-z_-]{35}\b",
    "secret-api-key": r"\bsk-[A-Za-z0-9_-]{20,}\b",
    "secret-github-token": r"\bgh[pousr]_[A-Za-z0-9]{30,}\b",
    "secret-slack-token": r"\bxox[baprs]-[A-Za-z0-9-]{10,}",
    "secret-private-key": r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    "secret-jwt": r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}",
    "service-account-email": r"[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.iam\.gserviceaccount\.com",
    "backend-host": r"\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(cloudfunctions\.net|run\.app|firebaseio\.com|firebaseapp\.com|web\.app|amazonaws\.com|appspot\.com)\b",
    "private-repo-path": r"(\b[A-Za-z0-9_]+\.swift\b|\bTexter/(Features|Controller|ViewModel|Model|Resources|Extensions)/|\bfirebase/functions\b)",
    "config-flag-name": r"\b[a-z][a-z0-9]*(_[a-z0-9]+)+_(enabled|percent|cutoff|flag)\b",
    "weakness-hint-ja": r"脆弱性|抜け穴|権限昇格|認証を(回避|突破)|(検査|ゲート|チェック)を(回避|すり抜け)|バイパス",
    "weakness-hint-en": r"(?i)\b(vulnerabilit\w*|exploit\w*|bypass\w*|privilege escalation|CVE-\d{4}-\d{4,}|SQL ?injection)\b",
}
COMPILED = {k: re.compile(v) for k, v in PATTERNS.items()}
WORD = re.compile(r"[A-Za-z0-9]+")
JOINER = re.compile(r"[ _-]+")
# Commands whose text becomes public.
VERB = re.compile(
    r"(^|\s)(git(\s+-\S+(\s+\S+)?)*\s+(commit|tag)\b|gh\s+(pr|issue|release)\s+(create|edit|comment|review|merge|close|reopen)\b|gh\s+api\b)"
)


def log(msg):
    try:
        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {msg}\n")
    except OSError:
        pass


def sha(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def load(path=None):
    try:
        with open(path or DATA_FILE, encoding="utf-8") as f:
            d = json.load(f)
    except (OSError, ValueError):
        d = {}
    return {"tokens": set(d.get("tokens", [])), "baseline": {tuple(x) for x in d.get("baseline", [])}}


def save(d):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump({"tokens": sorted(d["tokens"]), "baseline": sorted(list(x) for x in d["baseline"])}, f, indent=1, ensure_ascii=False)
        f.write("\n")


def keys_in_line(line, tokens):
    """Yield (key, shown) findings. Names match as words, pairs, or triples of adjacent words (so Remote Config = RemoteConfig)."""
    found = [(m.group(0).lower(), m.start(), m.end()) for m in WORD.finditer(line)]
    words = [w for w, _, _ in found]
    seen = set()
    for n in (1, 2, 3):
        for i in range(len(found) - n + 1):
            # Join adjacent words only across spaces, underscores, or hyphens, never across a sentence break.
            if any(not JOINER.fullmatch(line[found[j][2]:found[j + 1][1]]) for j in range(i, i + n - 1)):
                continue
            joined = "".join(words[i:i + n])
            h = sha(joined)
            if h in tokens and h not in seen:
                seen.add(h)
                yield h, joined
    for name, rx in COMPILED.items():
        m = rx.search(line)
        if m:
            yield name, m.group(0)[:40]


def scan_text(text, path, data, label=""):
    out = []
    for no, line in enumerate(text.splitlines(), 1):
        for key, shown in keys_in_line(line, data["tokens"]):
            if (path, key) in data["baseline"]:
                continue
            out.append((path, no, key, shown))
    return out


def report(findings, where):
    lines = [f"[disclosure-gate] 公開してはいけない可能性のある記載が{len(findings)}件あります（{where}）。"]
    for path, no, key, shown in findings[:15]:
        kind = key if key in PATTERNS else "name-or-identifier"
        lines.append(f"  {path}:{no}  {kind}  「{shown}」")
    lines.append("  基盤サービスの固有名、内部の構成、秘密情報、弱点の手がかりは書かず、「クラウドの音声認識」のような一般名で書き直してください。")
    lines.append("  方針: .claude/rules/public-disclosure.md。法的に必要な既存の記載だけは --add-baseline で許可し、PRで人の承認を受けます。")
    return "\n".join(lines)


def staged_findings(data):
    r = subprocess.run(["git", "diff", "--cached", "-U0", "--no-color", "--diff-filter=ACMR"], cwd=ROOT, capture_output=True, text=True, timeout=60)
    path, no, out = None, 0, []
    for line in r.stdout.splitlines():
        if line.startswith("+++ "):
            p = line[4:]
            path = p[2:] if p.startswith("b/") else None
            no = 0
        elif line.startswith("@@"):
            m = re.search(r"\+(\d+)", line)
            no = int(m.group(1)) - 1 if m else 0
        elif line.startswith("+") and path:
            no += 1
            if SELF.search(path) or SKIP_PATH.search(path):
                continue
            for _, _, k, s in scan_text(line[1:], path, data):
                out.append((path, no, k, s))
    return out


def tree_findings(data):
    r = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, timeout=60)
    out = []
    for p in r.stdout.splitlines():
        if SELF.search(p) or SKIP_PATH.search(p) or not TEXT_EXT.search(p):
            continue
        try:
            with open(os.path.join(ROOT, p), encoding="utf-8") as f:
                out.extend(scan_text(f.read(), p, data))
        except (OSError, UnicodeDecodeError):
            continue
    return out


def segments(cmd):
    """Split a shell command into top-level segments. A heredoc body stays with the segment that opened it."""
    segs, cur, pend = [[]], 0, []
    i, n, q = 0, len(cmd), None
    while i < n:
        c = cmd[i]
        if q:
            segs[cur].append(c)
            if c == "\\" and q == '"' and i + 1 < n:
                segs[cur].append(cmd[i + 1])
                i += 2
                continue
            if c == q:
                q = None
            i += 1
            continue
        if c in "'\"":
            q = c
            segs[cur].append(c)
            i += 1
            continue
        if c == "\\" and cmd[i + 1:i + 2] == "\n":
            segs[cur].append(cmd[i:i + 2])
            i += 2
            continue
        m = re.match(r"<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1", cmd[i:])
        if m:
            pend.append((cur, m.group(2)))
            segs[cur].append(m.group(0))
            i += len(m.group(0))
            continue
        if c == "\n":
            i += 1
            for idx, delim in pend:
                while i < n:
                    j = cmd.find("\n", i)
                    j = n if j < 0 else j
                    line = cmd[i:j]
                    segs[idx].append("\n" + line)
                    i = j + 1
                    if line.strip() == delim:
                        break
            pend = []
            segs.append([])
            cur = len(segs) - 1
            continue
        if cmd.startswith(("&&", "||"), i) or c in ";|":
            i += 2 if cmd.startswith(("&&", "||"), i) else 1
            segs.append([])
            cur = len(segs) - 1
            continue
        segs[cur].append(c)
        i += 1
    return ["".join(s) for s in segs if "".join(s).strip()]


def public_text(cmd, cwd):
    """The text of each public write in a Bash command: the segment itself plus any --body-file or -F file."""
    texts = []
    for seg in segments(cmd):
        if not VERB.search(seg):
            continue
        if re.match(r"\s*gh\s+api\b", seg) and not re.search(r"\b(body|title|message)=", seg):
            continue
        texts.append(seg)
        for m in re.finditer(r"(?:--body-file|--notes-file|-F|--file)\s+(\S+)", seg):
            f = m.group(1).strip("'\"")
            if f != "-":
                try:
                    with open(os.path.join(cwd, f) if not os.path.isabs(f) else f, encoding="utf-8") as fh:
                        texts.append(fh.read())
                except OSError:
                    pass
    return texts


def self_test():
    d = {"tokens": {sha("zzvendorname"), sha("remoteflagx")}, "baseline": {("ok.html", sha("zzvendorname"))}}
    fails = []

    def expect(name, cond):
        print(("ok: " if cond else "NG: ") + name)
        if not cond:
            fails.append(name)

    expect("name as a word", bool(scan_text("音声はZzVendorNameへ送る", "a.html", d)))
    expect("name as a pair", bool(scan_text("Remote Flag X を使う", "a.html", d)))
    expect("name inside a host", bool(scan_text("api.zzvendorname.com", "a.html", d)))
    expect("baseline allows a legal text", not scan_text("ZzVendorName", "ok.html", d))
    expect("baseline is per path", bool(scan_text("ZzVendorName", "other.html", d)))
    expect("general wording passes", not scan_text("クラウドの音声認識へ音声を送る", "a.html", d))
    expect("private repo path", bool(scan_text("Texter/Features/Foo.swift", "a.html", d)))
    expect("flag name", bool(scan_text("sync_rollout_enabled", "a.html", d)))
    expect("secret", bool(scan_text("key AKIA" + "A" * 16, "a.html", d)))
    expect("weakness hint", bool(scan_text("認証を回避できる", "a.html", d)))
    heredoc = "git commit -q -F - <<'EOF'\nmsg ZzVendorName\nEOF\necho done"
    t = public_text(heredoc, "/")
    expect("heredoc body is scanned", len(t) == 1 and "ZzVendorName" in t[0])
    chain = "git commit -m ok && git show HEAD | grep -c ZzVendorName"
    t = public_text(chain, "/")
    expect("a later grep in the chain is not scanned", len(t) == 1 and "ZzVendorName" not in t[0])
    expect("gh pr comment is public", len(public_text("gh pr comment 3 --body 'x ZzVendorName'", "/")) == 1)
    expect("gh api read is not public", not public_text("gh api repos/a/b/pulls --jq .x", "/"))
    expect("gh api write is public", len(public_text("gh api repos/a/b/issues/1/comments -f body='x'", "/")) == 1)
    expect("ls is not public", not public_text("ls -la", "/"))
    print("self-test:", "FAIL" if fails else "PASS")
    return 1 if fails else 0


def hook_main():
    try:
        data_in = json.load(sys.stdin)
    except ValueError:
        log("skip: invalid stdin")
        return 0
    if data_in.get("tool_name") != "Bash" or data_in.get("hook_event_name") != "PreToolUse":
        log(f"skip: {data_in.get('hook_event_name')} {data_in.get('tool_name')}")
        return 0
    cmd = (data_in.get("tool_input") or {}).get("command", "")
    cwd = data_in.get("cwd") or ROOT
    texts = public_text(cmd, cwd)
    if not texts:
        log("skip: bash without a public write")
        return 0
    data = load()
    findings = []
    for t in texts:
        findings.extend(scan_text(t, "(コマンドの本文)", data))
    log(f"checked {len(texts)} text(s), findings={len(findings)}")
    if findings:
        print(report(findings, "commit・PR・コメントの本文"), file=sys.stderr)
        return 2
    return 0


def main(argv):
    if len(argv) == 1:
        return hook_main()
    mode = argv[1]
    if mode == "--self-test":
        return self_test()
    if mode == "--add-token" and len(argv) == 3:
        d = load()
        d["tokens"].add(sha("".join(WORD.findall(argv[2])).lower()))
        save(d)
        print("added a hash")
        return 0
    if mode == "--add-baseline" and len(argv) == 4:
        d = load()
        key = argv[3] if argv[3] in PATTERNS else sha("".join(WORD.findall(argv[3])).lower())
        d["baseline"].add((argv[2], key))
        save(d)
        print("added a baseline entry")
        return 0
    data = load()
    if mode == "--staged":
        f = staged_findings(data)
        where = "ステージした差分"
    elif mode == "--tree":
        f = tree_findings(data)
        where = "リポジトリ全体"
    elif mode == "--msg" and len(argv) == 3:
        with open(argv[2], encoding="utf-8") as fh:
            text = "\n".join(l for l in fh.read().splitlines() if not l.startswith("#"))
        f = scan_text(text, "(コミットメッセージ)", data)
        where = "コミットメッセージ"
    else:
        print(__doc__, file=sys.stderr)
        return 2
    log(f"{mode} findings={len(f)}")
    if f:
        print(report(f, where), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except Exception as e:  # a broken gate must not take the session down; the log shows why
        log(f"error: {e!r}")
        sys.exit(0 if len(sys.argv) == 1 else 2)
