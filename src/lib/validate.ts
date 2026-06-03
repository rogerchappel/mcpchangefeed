import type { McpServer } from "./types.js";

export function validateServers(input: unknown): McpServer[] {
  if (!Array.isArray(input)) {
    throw new Error("Expected an array of MCP server records");
  }

  const seen = new Set<string>();
  return input.map((record, index) => {
    if (!record || typeof record !== "object") {
      throw new Error(`Record ${index} must be an object`);
    }

    const server = record as Partial<McpServer>;
    for (const field of ["id", "name", "description", "category"] as const) {
      if (typeof server[field] !== "string" || server[field]?.trim() === "") {
        throw new Error(`Record ${index} is missing ${field}`);
      }
    }

    if (!Array.isArray(server.tags)) {
      throw new Error(`Record ${index} must include tags`);
    }

    if (!server.signals || typeof server.signals !== "object") {
      throw new Error(`Record ${index} must include signals`);
    }

    if (seen.has(server.id!)) {
      throw new Error(`Duplicate server id: ${server.id}`);
    }
    seen.add(server.id!);

    return server as McpServer;
  });
}
