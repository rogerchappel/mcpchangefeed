# PRD: mcpwatch

## Goal

Build a public MCP and agent-tool leaderboard that is genuinely useful to developers, star-worthy as an open-source repo, and capable of producing frequent meaningful update commits from public data.

## Users

- Developers looking for MCP servers to install.
- Agent builders comparing tool quality and maintenance.
- Teams choosing safe, maintained integration packages.
- SEO users searching for MCP server lists, pricing/tooling comparisons, and installation guidance.

## Non-Goals

- No private registry scraping.
- No heavy GitHub API dependence.
- No synthetic commit farming.
- No publishing packages or releases without maintainer approval.

## MVP Scope

- Normalize MCP server records.
- Score records by practical signals.
- Provide CLI search, top, and diff commands.
- Generate a static site from the latest dataset.
- Add scheduled GitHub Action refresh workflow.
- Commit meaningful data/site changes only.

## Sources

- Official MCP registry or compatible JSON endpoint.
- Local source manifest for curated seed URLs.
- npm/PyPI enrichment later.
- GitHub metadata later with caching and low rate limits.

## Success Metrics

- 20-50 meaningful action-generated commits per day once sources are active.
- Public site has index, category pages, server pages, and sitemap.
- CLI can inspect and compare datasets locally.
- Repo is useful without the website.
