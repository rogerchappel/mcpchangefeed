# Release Readiness

Use this checklist before tagging, publishing, or promoting a refreshed MCP
changefeed build.

## Local gate

```sh
pnpm install --frozen-lockfile
pnpm run release:check
```

`release:check` runs unit tests, type checking, checked-in data validation, the
static site build, CLI fixture smoke coverage, and package smoke verification.

## Package smoke

```sh
pnpm run package:smoke
```

The package smoke builds the CLI, verifies both bin aliases point at an existing
`dist-cli/cli.js`, confirms the checked-in latest data and support docs are
included in the package allowlist, checks CLI help/version behavior, and
finishes with `npm pack --dry-run`.

## Manual release evidence

- CLI fixture search: `node dist-cli/cli.js search filesystem --input fixtures/servers.json`
- CLI help/version: `node dist-cli/cli.js --help` and `node dist-cli/cli.js --version`
- CLI fixture leaderboard: `node dist-cli/cli.js top --input fixtures/servers.json --limit 2`
- CLI fixture diff: `node dist-cli/cli.js diff --before fixtures/servers-before.json --after fixtures/servers.json`
- Data validation: `pnpm run validate:data`
- Static site build: `pnpm run build:site`

Do not publish a package from a refresh-only commit unless the package smoke
output shows the built CLI and latest checked-in data in the dry-run tarball.
