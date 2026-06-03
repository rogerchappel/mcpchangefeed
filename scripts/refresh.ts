import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { slugify } from "../src/lib/slug.js";
import { validateServers } from "../src/lib/validate.js";
import type { McpServer } from "../src/lib/types.js";

const args = parseArgs(process.argv.slice(2));
const out = args.out ?? "data/latest/servers.json";
const history = args.history ?? "data/history";
const registryUrl = args.registryUrl ?? "https://prod.registry.modelcontextprotocol.io/v0/servers";
const live = process.env.MCPWATCH_LIVE === "1" || args.live === "true";

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

async function fetchOfficialRegistry(url: string): Promise<McpServer[]> {
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "mcpwatch/0.1" } });
  if (!response.ok) {
    throw new Error(`Registry fetch failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as { servers?: unknown[] };
  const records = Array.isArray(body.servers) ? body.servers : [];
  const latest = new Map<string, McpServer>();

  for (const record of records) {
    const server = normalizeRegistryRecord(record);
    if (!server) continue;
    const existing = latest.get(server.id);
    if (!existing || compareVersionish(server.version, existing.version) >= 0) {
      latest.set(server.id, server);
    }
  }

  return [...latest.values()];
}

function normalizeRegistryRecord(record: unknown): McpServer | null {
  if (!record || typeof record !== "object") return null;
  const wrapper = record as { server?: Record<string, unknown>; _meta?: Record<string, unknown> };
  const source = wrapper.server;
  if (!source || typeof source !== "object") return null;

  const official = wrapper._meta?.["io.modelcontextprotocol.registry/official"] as Record<string, unknown> | undefined;
  const name = stringValue(source.title) ?? stringValue(source.name);
  const registryName = stringValue(source.name);
  const description = stringValue(source.description);
  if (!name || !registryName || !description) return null;

  const repository = firstRepository(source.repository) ?? firstRepository(source.source);
  const packageInfo = firstPackage(source.packages);
  const homepage = stringValue(source.websiteUrl) ?? stringValue(source.homepage) ?? repository;
  const packageName = packageInfo?.identifier ?? packageInfo?.packageName;
  const packageRegistry = registryNameFromPackage(packageInfo?.registryType ?? packageInfo?.registry);

  return {
    id: slugify(registryName),
    name,
    description,
    category: inferCategory(registryName, description),
    homepage,
    repository,
    packageName,
    packageRegistry,
    version: stringValue(source.version),
    license: stringValue(source.license),
    install: installCommand(packageRegistry, packageName),
    tags: inferTags(registryName, description),
    signals: {
      lastPublishedAt: stringValue(official?.publishedAt),
      lastCommitAt: stringValue(official?.updatedAt),
      hasReadme: Boolean(description),
      hasExamples: false,
      hasLicense: Boolean(source.license)
    }
  };
}

function firstRepository(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const repo = value as Record<string, unknown>;
    return stringValue(repo.url) ?? stringValue(repo.repository) ?? stringValue(repo.source);
  }
  return undefined;
}

function firstPackage(value: unknown): Record<string, string> | undefined {
  if (!Array.isArray(value)) return undefined;
  const first = value.find((entry) => entry && typeof entry === "object") as Record<string, unknown> | undefined;
  if (!first) return undefined;
  return Object.fromEntries(Object.entries(first).filter(([, item]) => typeof item === "string")) as Record<string, string>;
}

function registryNameFromPackage(value: string | undefined): McpServer["packageRegistry"] | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes("npm")) return "npm";
  if (normalized.includes("pypi")) return "pypi";
  if (normalized.includes("docker")) return "docker";
  return "other";
}

function installCommand(registry: McpServer["packageRegistry"] | undefined, packageName: string | undefined) {
  if (!registry || !packageName) return undefined;
  if (registry === "npm") return `npx ${packageName}`;
  if (registry === "pypi") return `uvx ${packageName}`;
  if (registry === "docker") return `docker run ${packageName}`;
  return undefined;
}

function inferCategory(name: string, description: string) {
  const haystack = `${name} ${description}`.toLowerCase();
  if (haystack.includes("browser") || haystack.includes("playwright") || haystack.includes("puppeteer")) return "browser-automation";
  if (haystack.includes("database") || haystack.includes("postgres") || haystack.includes("sql")) return "data";
  if (haystack.includes("github") || haystack.includes("gitlab") || haystack.includes("repository")) return "developer-tools";
  if (haystack.includes("file") || haystack.includes("filesystem")) return "developer-tools";
  if (haystack.includes("search") || haystack.includes("web")) return "search";
  return "agent-tools";
}

function inferTags(name: string, description: string) {
  const words = `${name} ${description}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !["model", "context", "protocol", "server", "with", "from", "that", "this"].includes(word));
  return [...new Set(words)].slice(0, 8);
}

function compareVersionish(a: string | undefined, b: string | undefined) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
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
