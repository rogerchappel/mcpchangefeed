# Fixture-backed MCP Changefeed demo

This walkthrough uses only the checked-in fixtures, so it is safe for a local
recording, CI smoke, or a docs review without live registry or GitHub access.

## Run the demo

```sh
bash demo/run-fixture-changefeed.sh
```

The script builds the CLI and writes three outputs under `tmp/changefeed-demo/`:

- `top.txt` shows the highest-ranked servers from `fixtures/servers.json`.
- `search-filesystem.txt` shows a focused query against the same normalized data.
- `diff.txt` compares `fixtures/servers-before.json` with `fixtures/servers.json`.

## Manual commands

Use these commands when recording the flow step by step:

```sh
npm run build:cli
node dist-cli/cli.js top --input fixtures/servers.json --limit 3
node dist-cli/cli.js search filesystem --input fixtures/servers.json
node dist-cli/cli.js diff --before fixtures/servers-before.json --after fixtures/servers.json
```

## What to point out

- The CLI works from a local JSON snapshot, so demos do not need network access.
- `diff` is the promotion-worthy angle: users can see MCP metadata changes
  instead of browsing yet another static directory.
- The fixture commands mirror the release smoke path in `package.json`, which
  keeps the tutorial close to maintained verification.

## Cleanup

```sh
rm -rf tmp/changefeed-demo
```
