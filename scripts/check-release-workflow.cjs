#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const workflow = fs.readFileSync(
  path.resolve(__dirname, "../.github/workflows/release.yml"),
  "utf8",
);

for (const expected of [
  "workflow_dispatch:",
  "release:",
  "types: [published]",
  "contents: read",
  "id-token: write",
  "npm install --global npm@11.5.1",
  "pnpm run release:check",
  "npm publish --provenance --access public",
  "github.event_name == 'release'",
  "environment: npm",
]) {
  if (!workflow.includes(expected)) {
    throw new Error(`release workflow is missing: ${expected}`);
  }
}

const publishSteps = workflow.match(/npm publish --provenance --access public/g) || [];
if (publishSteps.length !== 1) {
  throw new Error(`expected one guarded npm publish step, found ${publishSteps.length}`);
}

const npmSetup = workflow.indexOf("npm install --global npm@11.5.1");
const releaseCheck = workflow.indexOf("pnpm run release:check");
const publish = workflow.indexOf("npm publish --provenance --access public");

if (!(npmSetup < releaseCheck && releaseCheck < publish)) {
  throw new Error(
    "expected supported npm setup before the release gate and publish step",
  );
}
