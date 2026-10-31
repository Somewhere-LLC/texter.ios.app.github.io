#!/usr/bin/env python3
"""Enforce the yomiyasu writing lint on the Japanese pages.

Guides must have no warnings. Other pages may not gain warnings beyond scripts/yomiyasu-baseline.json:
legal text and list-shaped FAQ answers trip the repeated-ending rule, and rewriting them just to satisfy a
lint would change their meaning. Text in <pre> and <details> is left out because it quotes app output verbatim.

Usage: check-yomiyasu.py [--self-test] [--update-baseline]
"""
import html
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINT = os.path.expanduser("~/.claude/skills/yomiyasu/scripts/yomiyasu_lint.py")
BASELINE = os.path.join(ROOT, "scripts", "yomiyasu-baseline.json")
BASELINED = ["index.html", "faq/index.html", "privacy-policy/index.html", "terms-of-service/index.html", "tokushoho/index.html", "pdf/texter-for-business.html"]


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


def load_pages():
    generated = generated_pages()
    pages = {k: v for k, v in generated.items() if k.startswith("guides/")}
    for rel in BASELINED:
        pages[rel] = generated.get(rel) or open(os.path.join(ROOT, rel), encoding="utf-8").read()
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
        counts = {rel: len(warnings(pages[rel])) for rel in BASELINED}
        with open(BASELINE, "w", encoding="utf-8") as f:
            json.dump(counts, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(counts)
        return 0
    baseline = json.load(open(BASELINE, encoding="utf-8"))
    errors = check(pages, baseline)
    for e in errors:
        print("NG " + e, file=sys.stderr)
    if errors:
        print("yomiyasuの原則で本文を直してください。", file=sys.stderr)
        return 1
    print(f"OK: yomiyasu {len(pages)} pages")
    return 1 if "--self-test" in sys.argv and self_test(pages, baseline) else 0


sys.exit(main())
