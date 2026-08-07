import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { diffServers } from "../src/lib/diff.js";
import { previousHistorySnapshot } from "../src/lib/history.js";
import { readServers } from "../src/lib/io.js";
import { rankServers } from "../src/lib/score.js";

const args = parseArgs(process.argv.slice(2));
const input = args.input ?? "data/latest/servers.json";
const before = args.before ?? await previousHistorySnapshot(args.history ?? "data/history", input);
const publicDir = args.publicDir ?? "site-src/public";

const latestServers = await readServers(input);
const beforeServers = before ? await readOptionalServers(before) : [];
const ranked = rankServers(latestServers);
const changes = diffServers(beforeServers, latestServers);

await writeJson(join(publicDir, "data", "servers.json"), ranked);
await writeJson(join(publicDir, "data", "changes.json"), changes);
await writePage(join(publicDir, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: /sitemap-index.xml\n");

console.log(`prepared ${ranked.length} servers and ${changes.added.length + changes.changed.length + changes.removed.length} changes for Astro`);

async function readOptionalServers(path: string) {
  try {
    return await readServers(path);
  } catch {
    return [];
  }
}

async function writeJson(path: string, value: unknown) {
  await writePage(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writePage(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

function parseArgs(values: string[]) {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[value.slice(2)] = next;
      index += 1;
    }
  }
  return parsed;
}
