import { slugify } from "./slug.js";
import type { McpServer } from "./types.js";

type RegistryPage = {
  servers?: unknown;
  metadata?: unknown;
};

type RegistryFetchOptions = {
  maxRetries?: number;
  requestTimeoutMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
};

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export async function fetchOfficialRegistry(
  url: string,
  fetcher: typeof fetch = fetch,
  options: RegistryFetchOptions = {}
): Promise<McpServer[]> {
  const records: unknown[] = [];
  const seenCursors = new Set<string>();
  const seenPages = new Set<string>();
  let cursor: string | undefined;

  while (true) {
    const pageUrl = new URL(url);
    if (cursor) pageUrl.searchParams.set("cursor", cursor);

    const response = await fetchRegistryPage(pageUrl, fetcher, options);

    const body = (await response.json()) as RegistryPage;
    const pageRecords = Array.isArray(body.servers) ? body.servers : [];
    const pageSignature = JSON.stringify(pageRecords);
    if (seenPages.has(pageSignature)) break;
    seenPages.add(pageSignature);
    records.push(...pageRecords);

    const nextCursor = registryNextCursor(body.metadata);
    if (!nextCursor || seenCursors.has(nextCursor)) break;
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

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

async function fetchRegistryPage(pageUrl: URL, fetcher: typeof fetch, options: RegistryFetchOptions) {
  const maxRetries = options.maxRetries ?? 3;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs < 0) {
    throw new TypeError("requestTimeoutMs must be a finite, non-negative number");
  }

  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetchWithTimeout(pageUrl, fetcher, requestTimeoutMs, options);
    } catch (error) {
      if (attempt >= maxRetries) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Registry fetch failed after ${attempt + 1} attempts: ${detail}`);
      }
      await sleep(retryDelayMilliseconds(null, attempt));
      continue;
    }
    if (response.ok) return response;

    const detail = `${response.status} ${response.statusText}`.trim();
    if (!RETRYABLE_STATUSES.has(response.status)) {
      throw new Error(`Registry fetch failed: ${detail}`);
    }
    if (attempt >= maxRetries) {
      throw new Error(`Registry fetch failed after ${attempt + 1} attempts: ${detail}`);
    }

    await sleep(retryDelayMilliseconds(response.headers.get("retry-after"), attempt));
  }
}

async function fetchWithTimeout(
  pageUrl: URL,
  fetcher: typeof fetch,
  requestTimeoutMs: number,
  options: RegistryFetchOptions
) {
  const controller = new AbortController();
  const scheduleTimeout = options.setTimeout ?? setTimeout;
  const cancelTimeout = options.clearTimeout ?? clearTimeout;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timedOut = new Promise<never>((_resolve, reject) => {
    timeout = scheduleTimeout(() => {
      controller.abort();
      reject(new Error(`request timed out after ${requestTimeoutMs}ms`));
    }, requestTimeoutMs);
  });

  try {
    return await Promise.race([
      fetcher(pageUrl, {
        headers: { accept: "application/json", "user-agent": "mcpchangefeed/0.1" },
        signal: controller.signal
      }),
      timedOut
    ]);
  } finally {
    if (timeout !== undefined) cancelTimeout(timeout);
  }
}

function retryDelayMilliseconds(retryAfter: string | null, attempt: number) {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;

    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 250 * 2 ** attempt;
}

function registryNextCursor(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return undefined;
  return stringValue((metadata as Record<string, unknown>).nextCursor);
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
  const packageName = stringValue(packageInfo?.identifier) ?? stringValue(packageInfo?.packageName);
  const packageRegistry = registryNameFromPackage(
    stringValue(packageInfo?.registryType) ?? stringValue(packageInfo?.registry)
  );

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
    install: installCommand(packageRegistry, packageName, packageInfo),
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

function firstPackage(value: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(value)) return undefined;
  const first = value.find((entry) => entry && typeof entry === "object") as Record<string, unknown> | undefined;
  return first;
}

function registryNameFromPackage(value: string | undefined): McpServer["packageRegistry"] | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes("npm")) return "npm";
  if (normalized.includes("pypi")) return "pypi";
  if (normalized.includes("docker")) return "docker";
  return "other";
}

function installCommand(
  registry: McpServer["packageRegistry"] | undefined,
  packageName: string | undefined,
  packageInfo: Record<string, unknown> | undefined
) {
  if (!packageName) return undefined;
  const runtime = stringValue(packageInfo?.runtimeHint);
  const command = runtime ? [runtime] : defaultRuntime(registry);
  if (!command) return undefined;
  return [
    ...command,
    ...argumentTokens(packageInfo?.runtimeArguments),
    packageName,
    ...argumentTokens(packageInfo?.packageArguments)
  ].join(" ");
}

function defaultRuntime(registry: McpServer["packageRegistry"] | undefined) {
  if (registry === "npm") return ["npx"];
  if (registry === "pypi") return ["uvx"];
  if (registry === "docker") return ["docker", "run"];
  return undefined;
}

function argumentTokens(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const argument = entry as Record<string, unknown>;
    const type = stringValue(argument.type);
    const argumentValue = stringValue(argument.value) ?? stringValue(argument.default);
    if (type === "positional") {
      const valueHint = stringValue(argument.valueHint);
      if (argumentValue) return [argumentValue];
      return valueHint ? [`{${valueHint}}`] : [];
    }
    if (type === "named") {
      const name = stringValue(argument.name);
      if (!name) return [];
      return argumentValue ? [name, argumentValue] : [name];
    }
    return [];
  });
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
