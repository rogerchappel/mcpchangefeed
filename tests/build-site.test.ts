import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { previousHistorySnapshot } from "../src/lib/history.js";
import type { McpServer, ServerDiff } from "../src/lib/types.js";

const baseServer: McpServer = {
  id: "alpha",
  name: "Alpha",
  description: "Alpha server",
  category: "developer-tools",
  tags: ["alpha"],
  signals: { hasReadme: true }
};

test("selects the snapshot immediately before the latest history entry", async () => {
  const root = await mkdtemp(join(tmpdir(), "mcpchangefeed-history-"));
  await snapshot(root, "2026-08-01", [baseServer]);
  await snapshot(root, "2026-08-03", [{ ...baseServer, name: "Latest" }]);
  await snapshot(root, "2026-08-02", [{ ...baseServer, name: "Previous" }]);

  assert.equal(await previousHistorySnapshot(root, "data/latest/servers.json"), join(root, "2026-08-02", "servers.json"));
});

test("returns no baseline on a first run with no previous snapshot", async () => {
  const root = await mkdtemp(join(tmpdir(), "mcpchangefeed-history-"));
  await snapshot(root, "2026-08-03", [baseServer]);

  assert.equal(await previousHistorySnapshot(root, "data/latest/servers.json"), undefined);
  assert.equal(await previousHistorySnapshot(join(root, "missing"), "data/latest/servers.json"), undefined);
});

test("build output counts changes against the previous snapshot", async () => {
  const root = await mkdtemp(join(tmpdir(), "mcpchangefeed-build-"));
  const history = join(root, "history");
  const input = join(root, "servers.json");
  const publicDir = join(root, "public");
  const removed = { ...baseServer, id: "removed", name: "Removed" };
  const changed = { ...baseServer, id: "changed", name: "Before" };
  const latest = [
    { ...changed, name: "After" },
    { ...baseServer, id: "added", name: "Added" }
  ];

  await snapshot(history, "2026-08-01", [{ ...baseServer, id: "old", name: "Old" }]);
  await snapshot(history, "2026-08-02", [removed, changed]);
  await snapshot(history, "2026-08-03", latest);
  await writeFile(input, JSON.stringify(latest));

  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/build-site.ts", "--input", input, "--history", history, "--publicDir", publicDir], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);

  const diff = JSON.parse(await readFile(join(publicDir, "data", "changes.json"), "utf8")) as ServerDiff;
  assert.deepEqual({ added: diff.added.length, removed: diff.removed.length, changed: diff.changed.length }, { added: 1, removed: 1, changed: 1 });
});

async function snapshot(root: string, date: string, servers: McpServer[]) {
  const directory = join(root, date);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "servers.json"), JSON.stringify(servers));
}
