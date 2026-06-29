# mcpchangefeed

Public changefeed, CLI, and static site for MCP servers and agent tools.

`mcpchangefeed` tracks public Model Context Protocol servers from registry-style data, normalizes metadata, detects meaningful changes, scores freshness/usefulness signals, and publishes both a CLI and a crawlable static site.

## Why

MCP discovery is fragmented, but directory space is already crowded. The useful angle is knowing what changed:

- new servers
- removed servers
- renamed packages and repositories
- changed install commands
- changed categories and tags
- stale or missing documentation warnings
- freshness views for maintained and fast-moving tools

## CLI

The CLI makes the repo useful even before SEO compounds: developers can query the same normalized dataset locally, compare snapshots in CI, and script checks around MCP server freshness.

```sh
pnpm install
pnpm run build:cli
node dist-cli/cli.js top --input fixtures/servers.json
node dist-cli/cli.js search filesystem --input fixtures/servers.json
node dist-cli/cli.js diff --before fixtures/servers-before.json --after fixtures/servers.json
```

Planned package usage:

```sh
npx mcpchangefeed top
mcpfeed search github
mcpfeed diff --before old.json --after new.json
```

## Data Sources

Initial source priority:

1. Official MCP registry snapshots.
2. Known reference/community server lists.
3. npm and PyPI packages with MCP naming and metadata.
4. Light GitHub enrichment from known repository URLs, cached and rate-limited.

The GitHub API should be enrichment, not the main dependency.

## GitHub Action Commit Engine

The scheduled workflow refreshes public data and commits only meaningful changes:

- latest normalized snapshot
- dated history snapshot
- changed leaderboard output
- changed static pages
- daily changelog entry

No timestamp-only commits.

The workflow is intentionally GitHub-token-light. It starts with the official MCP registry endpoint and can add npm/PyPI enrichment without depending on high-volume GitHub API calls.

## Static Site

Build the public SEO surface:

```sh
pnpm run build:site
```

Output goes to `site/` and can be published by GitHub Pages or Cloudflare Pages.

The first generated site includes:

- homepage leaderboard
- per-server pages
- category landing pages
- sitemap and robots files
- JSON export for client-side/search consumers

## Limitations

- Registry and package metadata can lag or disappear, so freshness scores should be treated as triage signals rather than authority.
- External enrichment must stay cached and rate-limited; the CLI should remain useful from checked-in fixtures when network data is unavailable.
- The changefeed reports public metadata changes and does not audit server runtime safety, permissions, or transport security.

## Verification

```sh
pnpm test
pnpm run smoke
pnpm run smoke:cli
pnpm run package:smoke
pnpm run release:check
```

`pnpm test` runs the unit tests, typecheck, data validation, static site build,
and canonical CLI smoke command. `pnpm run smoke` is the stable release-readiness
entrypoint; `pnpm run smoke:cli` remains available for CLI-only iteration. Use
`pnpm run package:smoke` when changing package contents, and finish
release-facing changes with `pnpm run release:check`.
