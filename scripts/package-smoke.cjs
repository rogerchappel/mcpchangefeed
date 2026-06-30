#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
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

execFileSync("npm", ["pack", "--dry-run"], {
  cwd: root,
  stdio: "inherit",
});
