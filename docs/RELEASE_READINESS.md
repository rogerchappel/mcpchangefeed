# Release Readiness

Use this checklist before tagging, publishing, or promoting a refreshed MCP
changefeed build.

Live refreshes follow the official registry's `metadata.nextCursor` using the
`cursor` request parameter. All pages are collected before records are
normalized and duplicate server versions are resolved; cursor loops and
repeated pages stop the refresh safely.

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

The package smoke builds and packs the CLI, installs the tarball in a temporary
prefix, and runs both bin aliases from an unrelated working directory. It
verifies that `top` and `search` can read the bundled latest dataset without an
`--input` path, in addition to checking the package allowlist and both installed
bin aliases' `--version` behavior.

## npm release workflow

Run the **npm release** workflow manually for a non-publishing dry run. A
published GitHub release whose tag is exactly `v` plus the `package.json`
version installs npm 11.5.1 (the minimum release with trusted publishing
support), runs the same gate, and publishes with npm trusted publishing and
provenance. Configure the `npm` GitHub environment and the package's npm trusted
publisher before publishing the first release; no long-lived npm token is used.

## Manual release evidence

- CLI fixture search: `node dist-cli/cli.js search filesystem --input fixtures/servers.json`
- CLI help/version: `node dist-cli/cli.js --help` and `node dist-cli/cli.js --version`
- CLI fixture leaderboard: `node dist-cli/cli.js top --input fixtures/servers.json --limit 2`
- CLI fixture diff: `node dist-cli/cli.js diff --before fixtures/servers-before.json --after fixtures/servers.json`
- Installed default data: from outside the checkout, run `mcpchangefeed top --limit 1` and `mcpfeed search filesystem`
- Explicit input override: from the checkout, run `mcpfeed top --input fixtures/servers.json --limit 1`
- Data validation: `pnpm run validate:data`
- Static site build: `pnpm run build:site`

Do not publish a package from a refresh-only commit unless the package smoke
output shows the built CLI and latest checked-in data in the dry-run tarball.
