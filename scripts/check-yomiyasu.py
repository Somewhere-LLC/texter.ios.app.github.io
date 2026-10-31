#!/usr/bin/env python3
"""Enforce the yomiyasu writing lint on the Japanese pages.

Guides must have no warnings. Other pages may not gain warnings beyond scripts/yomiyasu-baseline.json:
legal text and list-shaped FAQ answers trip the repeated-ending rule, and rewriting them just to satisfy a
lint would change their meaning. Text in <pre> and <details> is left out because it quotes app output verbatim.

Usage: check-yomiyasu.py [--self-test] [--update-baseline] [--staged]
"""
import html
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Vendored copy of the yomiyasu skill linter, so a clean checkout can build. Refresh it by copying from the skill.
LINT = os.path.join(ROOT, "scripts", "vendor", "yomiyasu_lint.py")
BASELINE = os.path.join(ROOT, "scripts", "yomiyasu-baseline.json")
SKIP_DIRS = {".git", ".claude", "assets", "dist", "en", "node_modules", "proposals", "scripts", "tasks"}


def visible_text(page):
    page = re.sub(r"<(script|style|pre|details|svg|head)\b.*?</\1>", "", page, flags=re.S | re.I)
    page = re.sub(r"<!--.*?-->", "", page, flags=re.S)
    page = re.sub(r"</(p|li|h[1-6]|div|td|th|dd|dt|section|figcaption|tr)>|<br\s*/?>", "\n", page, flags=re.I)
    text = html.unescape(re.sub(r"<[^>]+>", "", page))
    return "\n".join(line.strip() for line in text.split("\n") if line.strip())


def warnings(page):
    r = subprocess.run([sys.executable, LINT, "--json"], input=visible_text(page), capture_output=True, text=True, check=True)
    return [f for f in json.loads(r.stdout)["findings"] if f["severity"] in ("warn", "error")]


def generated_pages():
    # Read the generator's output, so an edit to data.js is checked before anyone runs the build.
    code = "process.stdout.write(JSON.stringify(require('./scripts/seo/build').generate()))"
    r = subprocess.run(["node", "-e", code], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def japanese_html_files():
    """Every Japanese page in the repo, so a new page is checked without being listed anywhere."""
    found = []
    for folder, dirs, names in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in names:
            if name.endswith(".html"):
                found.append(os.path.relpath(os.path.join(folder, name), ROOT))
    return found


def load_pages():
    generated = generated_pages()
    pages = {}
    for rel in japanese_html_files():
        page = open(os.path.join(ROOT, rel), encoding="utf-8").read()
        if re.search(r"<html[^>]*\blang=[\"']ja", page):
            pages[rel] = page
    # The generator's output wins, so an edit to data.js is checked before anyone runs the build.
    pages.update({k: v for k, v in generated.items() if k in pages or k.startswith("guides/")})
    return pages


def check(pages, baseline):
    errors = []
    for rel, page in sorted(pages.items()):
        found = warnings(page)
        allowed = 0 if rel.startswith("guides/") else baseline.get(rel, 0)
        if len(found) > allowed:
            errors.append(f"{rel}: 警告{len(found)}件（上限{allowed}件）")
            errors += [f"  L{f['line']} {f['message']}\n    > {f['snippet'][:80]}" for f in found[:12]]
    return errors


def self_test(pages, baseline):
    slop = "<p>処理は次のとおりです：</p>"
    cases = [("ガイドに文末コロン", "guides/ai-minutes/index.html"), ("基準のあるページで警告が増加", "tokushoho/index.html")]
    missed = 0
    for name, rel in cases:
        broken = dict(pages)
        broken[rel] = pages[rel].replace("</body>", slop + "</body>")
        caught = any(e.startswith(rel) for e in check(broken, baseline))
        print(f"{'caught' if caught else 'MISSED'}: {name}")
        missed += not caught
    added = dict(pages)
    added["support/index.html"] = "<html lang=\"ja\"><body>" + slop + "</body></html>"
    caught = any(e.startswith("support/index.html") for e in check(added, baseline))
    print(f"{'caught' if caught else 'MISSED'}: 新しいページに基準がなく警告がある")
    missed += not caught
    quoted = dict(pages)
    rel = "guides/ai-minutes/index.html"
    quoted[rel] = pages[rel].replace("</body>", "<pre>処理は次のとおりです：</pre></body>")
    ok = not any(e.startswith(rel) for e in check(quoted, baseline))
    print(f"{'accepted' if ok else 'MISSED'}: 転載の<pre>は検査しない")
    return missed + (not ok)


def main():
    if not os.path.exists(LINT):
        print(f"NG yomiyasuのlintがありません: {LINT}", file=sys.stderr)
        return 2
    pages = load_pages()
    if "--update-baseline" in sys.argv:
        counts = {rel: len(warnings(page)) for rel, page in sorted(pages.items()) if not rel.startswith("guides/")}
        with open(BASELINE, "w", encoding="utf-8") as f:
            json.dump(counts, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(counts)
        return 0
    baseline = json.load(open(BASELINE, encoding="utf-8"))
    errors = check(pages, baseline)
    if "--staged" in sys.argv:
        # A committed page must match its generator, or the lint above judged a different text.
        for rel, content in generated_pages().items():
            path = os.path.join(ROOT, rel)
            if not os.path.exists(path) or open(path, encoding="utf-8").read() != content:
                errors.append(f"{rel}: 生成元と一致しません。npm run build を実行してください")
    for e in errors:
        print("NG " + e, file=sys.stderr)
    if errors:
        print("yomiyasuの原則で本文を直してください。", file=sys.stderr)
        return 1
    print(f"OK: yomiyasu {len(pages)} pages")
    return 1 if "--self-test" in sys.argv and self_test(pages, baseline) else 0


sys.exit(main())
