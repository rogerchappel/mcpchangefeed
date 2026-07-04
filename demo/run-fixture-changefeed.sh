#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OUT_DIR="${OUT_DIR:-tmp/changefeed-demo}"
mkdir -p "$OUT_DIR"

npm run build:cli

node dist-cli/cli.js top --input fixtures/servers.json --limit 3 > "$OUT_DIR/top.txt"
node dist-cli/cli.js search filesystem --input fixtures/servers.json > "$OUT_DIR/search-filesystem.txt"
node dist-cli/cli.js diff --before fixtures/servers-before.json --after fixtures/servers.json > "$OUT_DIR/diff.txt"

test -s "$OUT_DIR/top.txt"
test -s "$OUT_DIR/search-filesystem.txt"
test -s "$OUT_DIR/diff.txt"

printf 'Wrote fixture-backed changefeed demo artifacts to %s\n' "$OUT_DIR"
