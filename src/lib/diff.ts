import type { McpServer, ServerDiff } from "./types.js";

const IGNORED_FIELDS = new Set(["signals"]);

export function diffServers(before: McpServer[], after: McpServer[]): ServerDiff {
  const beforeById = new Map(before.map((server) => [server.id, server]));
  const afterById = new Map(after.map((server) => [server.id, server]));

  const added = after.filter((server) => !beforeById.has(server.id));
  const removed = before.filter((server) => !afterById.has(server.id));
  const changed = after
    .filter((server) => beforeById.has(server.id))
    .map((server) => {
      const old = beforeById.get(server.id)!;
      const fields = changedFields(old, server);
      return { before: old, after: server, fields };
    })
    .filter((entry) => entry.fields.length > 0);

  return { added, removed, changed };
}

function changedFields(before: McpServer, after: McpServer): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => {
    if (IGNORED_FIELDS.has(key)) return false;
    return JSON.stringify(before[key as keyof McpServer]) !== JSON.stringify(after[key as keyof McpServer]);
  });
}
