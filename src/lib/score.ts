import type { McpServer, ScoredServer } from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RAW_SCORE = 116;

export function scoreServer(server: McpServer, now = new Date()): ScoredServer {
  const warnings: string[] = [];
  let rawScore = 20;

  rawScore += Math.min(25, Math.log10((server.signals.stars ?? 0) + 1) * 8);
  rawScore += Math.min(15, Math.log10((server.signals.downloads ?? 0) + 1) * 3);

  if (server.repository) rawScore += 8;
  if (server.homepage) rawScore += 4;
  if (server.install) rawScore += 8;
  if (server.license || server.signals.hasLicense) rawScore += 6;
  if (server.signals.hasReadme) rawScore += 8;
  if (server.signals.hasExamples) rawScore += 6;
  if (server.version) rawScore += 4;

  const freshnessDate = server.signals.lastPublishedAt ?? server.signals.lastCommitAt;
  if (freshnessDate) {
    const ageDays = Math.max(0, Math.floor((now.getTime() - Date.parse(freshnessDate)) / DAY_MS));
    if (ageDays <= 30) rawScore += 12;
    else if (ageDays <= 120) rawScore += 6;
    else if (ageDays > 365) warnings.push("No recent activity signal");
  } else {
    warnings.push("Missing freshness signal");
  }

  if (!server.install) warnings.push("Missing install command");
  if (!server.license && !server.signals.hasLicense) warnings.push("Missing license signal");

  return {
    ...server,
    score: Math.min(100, Math.round((rawScore / MAX_RAW_SCORE) * 100)),
    warnings
  };
}

export function rankServers(servers: McpServer[]): ScoredServer[] {
  return servers.map((server) => scoreServer(server)).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
