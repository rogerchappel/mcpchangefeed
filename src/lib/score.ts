import type { McpServer, ScoredServer } from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function scoreServer(server: McpServer, now = new Date()): ScoredServer {
  const warnings: string[] = [];
  let score = 20;

  score += Math.min(25, Math.log10((server.signals.stars ?? 0) + 1) * 8);
  score += Math.min(15, Math.log10((server.signals.downloads ?? 0) + 1) * 3);

  if (server.repository) score += 8;
  if (server.homepage) score += 4;
  if (server.install) score += 8;
  if (server.license || server.signals.hasLicense) score += 6;
  if (server.signals.hasReadme) score += 8;
  if (server.signals.hasExamples) score += 6;
  if (server.version) score += 4;

  const freshnessDate = server.signals.lastPublishedAt ?? server.signals.lastCommitAt;
  if (freshnessDate) {
    const ageDays = Math.max(0, Math.floor((now.getTime() - Date.parse(freshnessDate)) / DAY_MS));
    if (ageDays <= 30) score += 12;
    else if (ageDays <= 120) score += 6;
    else if (ageDays > 365) warnings.push("No recent activity signal");
  } else {
    warnings.push("Missing freshness signal");
  }

  if (!server.install) warnings.push("Missing install command");
  if (!server.license && !server.signals.hasLicense) warnings.push("Missing license signal");

  return {
    ...server,
    score: Math.round(score),
    warnings
  };
}

export function rankServers(servers: McpServer[]): ScoredServer[] {
  return servers.map((server) => scoreServer(server)).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
