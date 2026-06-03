const { chmodSync, readFileSync, writeFileSync } = require("node:fs");

const path = "dist-cli/cli.js";
const source = readFileSync(path, "utf8");

if (!source.startsWith("#!/usr/bin/env node")) {
  writeFileSync(path, `#!/usr/bin/env node\n${source}`);
}

chmodSync(path, 0o755);
