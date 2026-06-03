# AGENTS.md

This repo is public. Do not add private data, credentials, private package names, private Slack/GitHub context, or unpublished customer details.

## Project Shape

- CLI: `src/cli.ts`
- Shared ranking and data model: `src/lib`
- Data refresh scripts: `scripts`
- Public static site output: `site`
- Latest generated data: `data/latest`
- Historical run data: `data/history`

## Quality Bar

- Keep generated commits meaningful: new records, changed metadata, changed scores, updated index pages, or dated changelogs.
- Do not create timestamp-only or whitespace-only churn.
- Run `pnpm test` before pushing human-authored changes.
