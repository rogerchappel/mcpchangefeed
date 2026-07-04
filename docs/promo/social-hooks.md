# Social hooks

Ground these hooks in the checked-in fixture demo and avoid claims about live
registry coverage until the refresh data is reviewed.

## Short posts

1. MCP discovery has a "what changed?" problem. `mcpchangefeed` turns registry
   snapshots into local CLI views for top servers, search, and before/after
   diffs.
2. New demo: build the `mcpchangefeed` CLI, query fixture data, and compare MCP
   server snapshots without network access. Good for a quick screencast or CI
   smoke.
3. Instead of another MCP directory, `mcpchangefeed` focuses on drift: new
   servers, changed metadata, stale docs signals, and scriptable diffs.

## Video beat

- Open with `node dist-cli/cli.js diff --before fixtures/servers-before.json --after fixtures/servers.json`.
- Cut to `top --limit 3` to show the same normalized snapshot can support
  leaderboard-style discovery.
- Close on `docs/tutorials/fixture-changefeed-demo.md` and note that the demo is
  fixture-backed, repeatable, and network-free.
