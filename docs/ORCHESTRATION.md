# ORCHESTRATION

## Automated Refresh

The GitHub Action runs on a schedule and executes:

```sh
pnpm install --frozen-lockfile
pnpm run refresh
pnpm run validate:data
pnpm run build:site
```

It commits only when git detects real file changes.

## Commit Groups

Use separate commits when a run has enough material:

1. Data snapshot changes.
2. Leaderboard/index changes.
3. Static site changes.
4. Changelog or run report changes.

Do not split tiny changes just to increase count.

## Failure Rules

- One bad source should be reported and skipped.
- Validation failure should stop commit/publish.
- Network failure should not create churn.
