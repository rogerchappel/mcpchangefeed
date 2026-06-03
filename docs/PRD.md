# PRD: mcpchangefeed

## Goal

Build a public MCP ecosystem changefeed that is genuinely useful to developers, star-worthy as an open-source repo, and capable of producing frequent meaningful update commits from public data.

## Users

- Developers watching for new MCP servers and meaningful updates.
- Agent builders comparing tool freshness, quality, and maintenance.
- Teams tracking renamed, stale, removed, or newly official integration packages.
- Vendors who want visibility around launches, updates, and category momentum.

## Non-Goals

- No private registry scraping.
- No heavy GitHub API dependence.
- No synthetic commit farming.
- No generic directory clone as the core product.
- No publishing packages or releases without maintainer approval.

## MVP Scope

- Normalize MCP server records.
- Score records by practical signals.
- Provide CLI search, top, and diff commands under `mcpfeed` and `mcpchangefeed`.
- Generate a static site from the latest dataset and highlight change/freshness signals.
- Add scheduled GitHub Action refresh workflow.
- Commit meaningful data/site changes only.

## Sources

- Official MCP registry or compatible JSON endpoint.
- Local source manifest for curated seed URLs.
- npm/PyPI enrichment later.
- GitHub metadata later with caching and low rate limits.

## Success Metrics

- 20-50 meaningful action-generated commits per day once sources are active.
- Public site has index, category pages, server pages, changefeed pages, and sitemap.
- CLI can inspect and compare datasets locally.
- Repo is useful without the website.
