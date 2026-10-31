#!/bin/bash
# Runs the yomiyasu check on the staged snapshot, using that snapshot's own pages, baseline, and linter.
# This checks what the commit will contain, whatever the working tree holds.
top=$(git rev-parse --show-toplevel) || exit 2
git -C "$top" cat-file -e :scripts/check-yomiyasu.py 2>/dev/null || exit 0
snapshot=$(mktemp -d) || exit 2
trap 'rm -rf "$snapshot"' EXIT
git -C "$top" checkout-index -a --prefix="$snapshot/" || exit 2
python3 "$snapshot/scripts/check-yomiyasu.py"
