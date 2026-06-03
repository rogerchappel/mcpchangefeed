import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readServers } from "../src/lib/io.js";
import { rankServers } from "../src/lib/score.js";
import { slugify } from "../src/lib/slug.js";
import type { ScoredServer } from "../src/lib/types.js";

const args = parseArgs(process.argv.slice(2));
const input = args.input ?? "data/latest/servers.json";
const out = args.out ?? "site";

const ranked = rankServers(await readServers(input));
await mkdir(out, { recursive: true });
await writePage(join(out, "index.html"), renderIndex(ranked));
await writePage(join(out, "servers.json"), `${JSON.stringify(ranked, null, 2)}\n`);
await writePage(join(out, "sitemap.xml"), renderSitemap(ranked));
await writePage(join(out, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n");

for (const server of ranked) {
  await writePage(join(out, "tools", slugify(server.id), "index.html"), renderServer(server));
}

const categories = new Map<string, ScoredServer[]>();
for (const server of ranked) {
  const existing = categories.get(server.category) ?? [];
  existing.push(server);
  categories.set(server.category, existing);
}

for (const [category, servers] of categories) {
  await writePage(join(out, "categories", slugify(category), "index.html"), renderCategory(category, servers));
}

console.log(`built ${ranked.length} server pages into ${out}`);

function renderIndex(servers: ScoredServer[]) {
  const rows = servers
    .map(
      (server) => `<tr><td>${escapeHtml(String(server.score))}</td><td><a href="/tools/${slugify(server.id)}/">${escapeHtml(server.name)}</a></td><td><a href="/categories/${slugify(server.category)}/">${escapeHtml(server.category)}</a></td><td>${escapeHtml(server.description)}</td></tr>`
    )
    .join("\n");

  return page(
    "MCPWatch - MCP Server Leaderboard",
    "A public leaderboard and directory for Model Context Protocol servers and agent tools.",
    `<main>
      <section class="hero">
        <p class="eyebrow">MCP server directory</p>
        <h1>MCPWatch tracks maintained, useful Model Context Protocol servers.</h1>
        <p>Search install commands, package metadata, maintenance signals, warnings, and category leaderboards from public registry data.</p>
      </section>
      <section>
        <h2>Top MCP servers</h2>
        <table>
          <thead><tr><th>Score</th><th>Server</th><th>Category</th><th>Description</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    </main>`
  );
}

function renderServer(server: ScoredServer) {
  const warnings = server.warnings.length > 0 ? `<h2>Warnings</h2><ul>${server.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : "";
  const links = [
    server.homepage ? `<a href="${escapeHtml(server.homepage)}">Homepage</a>` : "",
    server.repository ? `<a href="${escapeHtml(server.repository)}">Repository</a>` : ""
  ]
    .filter(Boolean)
    .join(" ");

  return page(
    `${server.name} MCP Server - MCPWatch`,
    server.description,
    `<main>
      <p><a href="/">MCPWatch</a></p>
      <h1>${escapeHtml(server.name)}</h1>
      <p class="score">Score ${server.score}</p>
      <p>${escapeHtml(server.description)}</p>
      <dl>
        <dt>Category</dt><dd>${escapeHtml(server.category)}</dd>
        <dt>Install</dt><dd><code>${escapeHtml(server.install ?? "Unknown")}</code></dd>
        <dt>Package</dt><dd>${escapeHtml(server.packageName ?? "Unknown")}</dd>
        <dt>Version</dt><dd>${escapeHtml(server.version ?? "Unknown")}</dd>
      </dl>
      <p>${links}</p>
      ${warnings}
    </main>`
  );
}

function renderCategory(category: string, servers: ScoredServer[]) {
  return page(
    `${category} MCP Servers - MCPWatch`,
    `Ranked ${category} MCP servers and agent tools.`,
    `<main>
      <p><a href="/">MCPWatch</a></p>
      <h1>${escapeHtml(category)} MCP servers</h1>
      <ol>${servers.map((server) => `<li><a href="/tools/${slugify(server.id)}/">${escapeHtml(server.name)}</a> <span>${server.score}</span></li>`).join("")}</ol>
    </main>`
  );
}

function page(title: string, description: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172026; background: #f7f4ed; }
    main { max-width: 1120px; margin: 0 auto; padding: 48px 20px; }
    .hero { padding: 48px 0 36px; border-bottom: 1px solid #d8d1c3; }
    .eyebrow { color: #386c5f; font-weight: 700; text-transform: uppercase; font-size: 13px; }
    h1 { max-width: 840px; font-size: clamp(34px, 6vw, 72px); line-height: 1; margin: 0 0 18px; letter-spacing: 0; }
    h2 { margin-top: 36px; }
    a { color: #245f9f; }
    table { width: 100%; border-collapse: collapse; background: #fffdf8; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e2daca; vertical-align: top; }
    code { background: #fffdf8; border: 1px solid #e2daca; padding: 2px 5px; border-radius: 4px; }
    .score { font-weight: 800; color: #386c5f; }
    dl { display: grid; grid-template-columns: 120px 1fr; gap: 10px 18px; }
    dt { font-weight: 700; }
  </style>
</head>
<body>${body}</body>
</html>
`;
}

function renderSitemap(servers: ScoredServer[]) {
  const urls = ["/", ...servers.map((server) => `/tools/${slugify(server.id)}/`), ...new Set(servers.map((server) => `/categories/${slugify(server.category)}/`))];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join("\n")}
</urlset>
`;
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

async function writePage(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
