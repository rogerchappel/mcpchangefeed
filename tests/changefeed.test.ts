import assert from "node:assert/strict";
import test from "node:test";
import { diffServers } from "../src/lib/diff.js";
import { rankServers, scoreServer } from "../src/lib/score.js";
import { validateServers } from "../src/lib/validate.js";
import type { McpServer } from "../src/lib/types.js";

const baseServer: McpServer = {
  id: "filesystem",
  name: "Filesystem MCP",
  description: "Local filesystem server",
  category: "developer-tools",
  repository: "https://github.com/modelcontextprotocol/servers",
  install: "npx @modelcontextprotocol/server-filesystem",
  tags: ["filesystem", "local"],
  signals: {
    stars: 1200,
    downloads: 45000,
    hasExamples: true,
    hasLicense: true,
    hasReadme: true,
    lastPublishedAt: "2026-06-01T00:00:00.000Z"
  }
};

test("validateServers rejects duplicate records before scoring", () => {
  assert.throws(
    () => validateServers([baseServer, { ...baseServer }]),
    /Duplicate server id: filesystem/
  );
});

test("diffServers reports user-visible field changes and ignores recalculated signals", () => {
  const before: McpServer[] = [baseServer];
  const after: McpServer[] = [
    {
      ...baseServer,
      install: "uvx mcp-server-filesystem",
      signals: { ...baseServer.signals, stars: 2000 }
    },
    {
      ...baseServer,
      id: "github",
      name: "GitHub MCP",
      description: "GitHub repository automation",
      tags: ["github"]
    }
  ];

  const diff = diffServers(before, after);

  assert.deepEqual(diff.added.map((server) => server.id), ["github"]);
  assert.deepEqual(diff.removed, []);
  assert.equal(diff.changed.length, 1);
  assert.deepEqual(diff.changed[0].fields, ["install"]);
});

test("rankServers prefers complete and fresh server records", () => {
  const staleIncomplete: McpServer = {
    ...baseServer,
    id: "stale",
    name: "Stale MCP",
    repository: undefined,
    install: undefined,
    license: undefined,
    signals: {
      stars: 2,
      lastCommitAt: "2024-01-01T00:00:00.000Z",
      hasReadme: false,
      hasExamples: false,
      hasLicense: false
    }
  };

  const now = new Date("2026-06-20T00:00:00.000Z");
  const scored = scoreServer(staleIncomplete, now);

  assert.ok(scored.warnings.includes("Missing install command"));
  assert.ok(scored.warnings.includes("Missing license signal"));
  assert.ok(scored.warnings.includes("No recent activity signal"));
  assert.equal(rankServers([staleIncomplete, baseServer])[0].id, "filesystem");
});

test("rankServers scores freshness relative to the committed snapshot", () => {
  const boundaryServer = {
    ...baseServer,
    id: "boundary",
    signals: { ...baseServer.signals, lastPublishedAt: "2025-01-01T00:00:00.000Z" }
  };
  const snapshotLeader = {
    ...baseServer,
    id: "latest",
    signals: { ...baseServer.signals, lastPublishedAt: "2025-04-30T00:00:00.000Z" }
  };

  const first = rankServers([boundaryServer, snapshotLeader]);
  const second = rankServers([boundaryServer, snapshotLeader]);

  assert.deepEqual(first, second);
  assert.equal(first.find((server) => server.id === "boundary")?.score, scoreServer(boundaryServer, new Date("2025-04-30T00:00:00.000Z")).score);
});
