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
import shlex
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA_FILE = os.path.join(HERE, "disclosure-data.json")
LOG = os.path.expanduser("~/.claude/logs/texter-site-disclosure.log")
# This gate and its rule describe the categories, so they are not scanned.
SELF = re.compile(r"^(\.claude/hooks/disclosure-gate\.py|\.claude/rules/public-disclosure\.md)$")
SKIP_PATH = re.compile(r"^(node_modules/|\.git/)|(^|/)package-lock\.json$")
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


class DataError(Exception):
    pass


def load(path=None):
    """Fails closed: a missing or malformed data file must stop the gate, not silently disable it."""
    try:
        with open(path or DATA_FILE, encoding="utf-8") as f:
            d = json.load(f)
        tokens = set(d["tokens"])
        baseline = {tuple(x) for x in d["baseline"] if len(x) == 3}
    except (OSError, ValueError, KeyError, TypeError) as e:
        raise DataError(f"disclosure-data.json を読めません（{type(e).__name__}）。検査を止めます") from e
    if not tokens:
        raise DataError("disclosure-data.json に名前の一覧がありません。検査を止めます")
    return {"tokens": tokens, "baseline": baseline}


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


ESCAPE_U = re.compile(r"\\u([0-9a-fA-F]{4})")


def unescape(line):
    """Undo \\uXXXX and \\n so an escape in front of a name (JSON or source) cannot glue it to the previous word."""
    line = ESCAPE_U.sub(lambda m: chr(int(m.group(1), 16)), line)
    return line.replace("\\n", " ").replace("\\r", " ").replace("\\t", " ")


def scan_text(text, path, data, label=""):
    out = []
    for no, line in enumerate(text.splitlines(), 1):
        lh = sha(line.strip())
        for key, shown in keys_in_line(unescape(line), data["tokens"]):
            # An allowance covers only the reviewed line, so the same name added elsewhere in the file is still caught.
            if (path, key, lh) in data["baseline"]:
                continue
            out.append((path, no, key, shown))
    return out


def add_baseline(path, word):
    d = load()
    key = word if word in PATTERNS else sha("".join(WORD.findall(word)).lower())
    n = 0
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        for line in f.read().splitlines():
            if any(k == key for k, _ in keys_in_line(line, d["tokens"])):
                d["baseline"].add((path, key, sha(line.strip())))
                n += 1
    if not n:
        print("該当する行がありません。許可を追加しません", file=sys.stderr)
        return 2
    save(d)
    print(f"added {n} baseline line(s)")
    return 0


def report(findings, where):
    lines = [f"[disclosure-gate] 公開してはいけない可能性のある記載が{len(findings)}件あります（{where}）。"]
    for path, no, key, shown in findings[:15]:
        kind = key if key in PATTERNS or key == "unscannable-stdin" else "name-or-identifier"
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


FILE_ARG = re.compile(r"(?:--body-file|--notes-file|--input|-F|--file)\s+(\S+)")
FIELD_FILE = re.compile(r"(?:-F|--field|-f|--raw-field)\s+['\"]?[\w\[\].-]+=@([^\s'\"]+)")
STDIN_ARG = re.compile(r"(?:--body-file|--notes-file|--input|-F|--file)\s+-(?:\s|$)")
WRITE_API = re.compile(r"(--input\b|-X\s*(POST|PATCH|PUT|DELETE)\b|--method[ =](POST|PATCH|PUT|DELETE)\b|(^|\s)(-f|-F|--field|--raw-field)\b)")
UNSCANNABLE = "\0unscannable-stdin\0"


def read_file(path, cwd):
    try:
        with open(path if os.path.isabs(path) else os.path.join(cwd, path), encoding="utf-8") as fh:
            return fh.read()
    except (OSError, UnicodeDecodeError):
        return None


def public_text(cmd, cwd):
    """The text of each public write in a Bash command: the segment, any file it reads, and piped standard input."""
    texts = []
    segs = segments(cmd)
    for seg in segs:
        if not VERB.search(seg):
            continue
        if re.match(r"\s*gh\s+api\b", seg) and not WRITE_API.search(seg):
            continue
        texts.append(seg)
        if STDIN_ARG.search(seg) and not re.search(r"<<(?!<)", seg):
            # The body comes from a pipe or a redirect. Scan the whole command and every file a producer reads.
            texts.append(cmd)
            if "$(" in cmd or "`" in cmd:
                texts.append(UNSCANNABLE)
            for other in segs:
                if other is seg:
                    continue
                try:
                    toks = shlex.split(other)
                except ValueError:
                    toks = other.split()
                for tok in toks:
                    if not tok.startswith("-"):
                        body = read_file(tok.lstrip("<"), cwd)
                        if body:
                            texts.append(body)
            for m in re.finditer(r"<\s*([^\s<>|&;]+)", seg):
                body = read_file(m.group(1).strip("'\""), cwd)
                if body:
                    texts.append(body)
        for m in list(FILE_ARG.finditer(seg)) + list(FIELD_FILE.finditer(seg)):
            f = m.group(1).strip("'\"")
            if f != "-":
                body = read_file(f, cwd)
                if body:
                    texts.append(body)
    return texts


def self_test():
    d = {
        "tokens": {sha("zzvendorname"), sha("remoteflagx")},
        "baseline": {("ok.html", sha("zzvendorname"), sha("ZzVendorName"))},
    }
    fails = []

    def expect(name, cond):
        print(("ok: " if cond else "NG: ") + name)
        if not cond:
            fails.append(name)

    expect("name as a word", bool(scan_text("音声はZzVendorNameへ送る", "a.html", d)))
    expect("name as a pair", bool(scan_text("Remote Flag X を使う", "a.html", d)))
    expect("name inside a host", bool(scan_text("api.zzvendorname.com", "a.html", d)))
    expect("a unicode escape does not hide a name", bool(scan_text("\\u3092ZzVendorName", "a.json", d)))
    expect("a newline escape does not hide a name", bool(scan_text("x\\nZzVendorName", "a.js", d)))
    expect("baseline allows the reviewed line", not scan_text("ZzVendorName", "ok.html", d))
    expect("baseline does not cover another line of the same file", bool(scan_text("ZzVendorName を追記", "ok.html", d)))
    expect("baseline is per path", bool(scan_text("ZzVendorName", "other.html", d)))
    expect("general wording passes", not scan_text("クラウドの音声認識へ音声を送る", "a.html", d))
    expect("a sentence break does not join words", not scan_text("in the zz. Vendor name here", "a.html", {"tokens": {sha("zzvendor")}, "baseline": set()}))
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
    heredoc_chain = "git commit -q -F - <<'EOF'\nok\nEOF\ngrep -c ZzVendorName x"
    expect("a grep after a heredoc commit is not scanned", not any("ZzVendorName" in x for x in public_text(heredoc_chain, "/")))
    expect("gh pr comment is public", len(public_text("gh pr comment 3 --body 'x ZzVendorName'", "/")) == 1)
    piped = "printf 'x ZzVendorName' | gh pr comment 3 --body-file -"
    expect("a body piped through standard input is scanned", any("ZzVendorName" in x for x in public_text(piped, "/")))
    expect("gh api --input is public", len(public_text("gh api repos/a/b/issues/1/comments --input payload.json", "/")) >= 1)
    expect("gh api with an explicit write method is public", bool(public_text("gh api -X POST repos/a/b/issues/1/comments", "/")))
    expect("gh api read is not public", not public_text("gh api repos/a/b/pulls --jq .x", "/"))
    expect("gh api write is public", len(public_text("gh api repos/a/b/issues/1/comments -f body='x'", "/")) == 1)
    expect("ls is not public", not public_text("ls -la", "/"))
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        bad = os.path.join(td, "bad.json")
        with open(bad, "w", encoding="utf-8") as f:
            f.write("{not json")
        for label, path in (("missing", os.path.join(td, "none.json")), ("malformed", bad)):
            try:
                load(path)
                ok = False
            except DataError:
                ok = True
            expect(f"a {label} data file stops the gate", ok)
    with tempfile.TemporaryDirectory() as td:
        with open(os.path.join(td, "payload.txt"), "w", encoding="utf-8") as f:
            f.write("本文 ZzVendorName")
        scanned = lambda c: any("ZzVendorName" in x for x in public_text(c, td))
        expect("a file piped into --body-file - is read", scanned("cat payload.txt | gh pr comment 3 --body-file -"))
        expect("a file redirected into --body-file - is read", scanned("gh pr comment 3 --body-file - < payload.txt"))
        expect("a quoted -F field file is read", scanned("gh api repos/o/r/issues/1/comments -F 'body=@payload.txt'"))
        expect("a nested -F field file is read", scanned("gh api repos/o/r/issues/1/comments -F 'a[b]=@payload.txt'"))
        expect("a stdin body from a command substitution is unscannable", UNSCANNABLE in public_text('echo "$(cat x)" | gh pr comment 3 --body-file -', td))
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
    try:
        texts = public_text(cmd, cwd)
        if not texts:
            log("skip: bash without a public write")
            return 0
        data = load()
        findings = []
        for t in texts:
            if t == UNSCANNABLE:
                findings.append(("(コマンド)", 0, "unscannable-stdin", "標準入力の本文は検査できません。ファイルに書いて --body-file <パス> で渡してください"))
            else:
                findings.extend(scan_text(t, "(コマンドの本文)", data))
    except DataError as e:
        log(f"blocked: {e}")
        print(f"[disclosure-gate] {e}", file=sys.stderr)
        return 2
    except Exception as e:  # a gate that cannot decide must not let a public write through
        log(f"error: {e!r}")
        if VERB.search(cmd):
            print(f"[disclosure-gate] 検査に失敗したので止めます: {e!r}", file=sys.stderr)
            return 2
        return 0
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
        try:
            d = load()
        except DataError:
            d = {"tokens": set(), "baseline": set()}
        d["tokens"].add(sha("".join(WORD.findall(argv[2])).lower()))
        save(d)
        print("added a hash")
        return 0
    if mode == "--add-baseline" and len(argv) == 4:
        return add_baseline(argv[2], argv[3])
    data = load()
    if mode == "--staged":
        f = staged_findings(data)
        where = "ステージした差分"
    elif mode == "--tree":
        f = tree_findings(data)
        where = "リポジトリ全体"
    elif mode == "--msg" and len(argv) == 3:
        with open(argv[2], encoding="utf-8") as fh:
            text = fh.read()  # a "#" line stays in a -m or -F message, so every line is scanned
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
    except DataError as e:
        log(f"blocked: {e}")
        print(f"[disclosure-gate] {e}", file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        log(f"error: {e!r}")
        sys.exit(2)
