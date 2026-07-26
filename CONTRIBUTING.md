# Contributing

Contributions are welcome when they improve discovery quality, data correctness, CLI usefulness, or public documentation.

Before opening a PR:

```sh
corepack enable
pnpm install
pnpm run release:check
```

Corepack reads the exact supported pnpm version from `package.json`.

Do not submit private registry data, credentials, customer-specific records, or copied proprietary directories.
