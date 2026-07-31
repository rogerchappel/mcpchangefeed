import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fetchOfficialRegistry } from "../src/lib/registry.js";
import { validateServers } from "../src/lib/validate.js";
import type { McpServer } from "../src/lib/types.js";

const args = parseArgs(process.argv.slice(2));
const out = args.out ?? "data/latest/servers.json";
const history = args.history ?? "data/history";
const registryUrl = args.registryUrl ?? "https://prod.registry.modelcontextprotocol.io/v0/servers";
const live = process.env.MCPCHANGEFEED_LIVE === "1" || args.live === "true";

const servers = live ? await fetchOfficialRegistry(registryUrl) : await readFixture();
const validated = validateServers(servers).sort((a, b) => a.name.localeCompare(b.name));
const payload = `${JSON.stringify(validated, null, 2)}\n`;
const stamp = new Date().toISOString().slice(0, 10);

await mkdir(join(history, stamp), { recursive: true });
await mkdir(out.split("/").slice(0, -1).join("/") || ".", { recursive: true });
await writeFile(out, payload);
await writeFile(join(history, stamp, basename(out)), payload);
await writeFile(join(history, stamp, "run.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), count: validated.length, live, registryUrl }, null, 2)}\n`);
console.log(`refreshed ${validated.length} server records`);

async function readFixture() {
  await mkdir("data/latest", { recursive: true });
  await copyFile("fixtures/servers.json", "data/latest/servers.json").catch(() => undefined);
  return JSON.parse(await readFile("fixtures/servers.json", "utf8")) as McpServer[];
}

function parseArgs(values: string[]) {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const next = values[index + 1];
    parsed[value.slice(2)] = next && !next.startsWith("--") ? next : "true";
    if (next && !next.startsWith("--")) index += 1;
  }
  return parsed;
}
