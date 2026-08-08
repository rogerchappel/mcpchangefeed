#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pkg = require(path.join(root, "package.json"));

function requirePath(relativePath, label) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`${label} is missing from the release package surface: ${relativePath}`);
  }
}

for (const [name, target] of Object.entries(pkg.bin || {})) {
  requirePath(target, `bin target ${name}`);
}

for (const required of [
  "data/latest/servers.json",
  "docs/RELEASE_READINESS.md",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
]) {
  requirePath(required, required);
}

const files = new Set(pkg.files || []);
for (const required of [
  "dist-cli",
  "data/latest",
  "docs/RELEASE_READINESS.md",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
]) {
  if (!files.has(required)) {
    throw new Error(`package.json files is missing ${required}`);
  }
}

execFileSync("node", ["dist-cli/cli.js", "--help"], {
  cwd: root,
  stdio: "inherit",
});
const versionOutput = execFileSync("node", ["dist-cli/cli.js", "--version"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (versionOutput !== pkg.version) {
  throw new Error(`CLI --version returned ${versionOutput}, expected ${pkg.version}`);
}

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "mcpchangefeed-package-smoke-"));
const packDirectory = path.join(sandbox, "pack");
const installDirectory = path.join(sandbox, "install");
const foreignCwd = path.join(sandbox, "foreign-cwd");
fs.mkdirSync(packDirectory);
fs.mkdirSync(foreignCwd);

try {
  const packResult = JSON.parse(
    execFileSync("npm", ["pack", "--json", "--pack-destination", packDirectory], {
      cwd: root,
      encoding: "utf8",
    }),
  );
  const tarball = path.join(packDirectory, packResult[0].filename);
  execFileSync("npm", ["install", "--ignore-scripts", "--prefix", installDirectory, tarball], {
    cwd: root,
    stdio: "inherit",
  });

  for (const binName of Object.keys(pkg.bin || {})) {
    const bin = path.join(installDirectory, "node_modules", ".bin", binName);
    const installedVersion = execFileSync(bin, ["--version"], {
      cwd: foreignCwd,
      encoding: "utf8",
    }).trim();
    if (installedVersion !== pkg.version) {
      throw new Error(`${binName} --version returned ${installedVersion}, expected ${pkg.version}`);
    }
    for (const args of [["top", "--limit", "1"], ["search", "filesystem"]]) {
      const output = execFileSync(bin, args, {
        cwd: foreignCwd,
        encoding: "utf8",
      });
      if (args[0] === "top" && !output.trim()) {
        throw new Error(`${binName} ${args.join(" ")} returned no packaged dataset results`);
      }
    }
  }
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}
