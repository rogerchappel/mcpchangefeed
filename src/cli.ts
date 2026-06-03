#!/usr/bin/env node
import { diffServers } from "./lib/diff.js";
import { readServers } from "./lib/io.js";
import { rankServers } from "./lib/score.js";

type Args = Record<string, string | boolean>;

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (!command || args.help) {
    help();
    return;
  }

  if (command === "top") {
    const servers = await readServers(String(args.input ?? "data/latest/servers.json"));
    const limit = Number(args.limit ?? 10);
    for (const server of rankServers(servers).slice(0, limit)) {
      console.log(`${server.score}\t${server.name}\t${server.category}\t${server.repository ?? server.homepage ?? ""}`);
    }
    return;
  }

  if (command === "search") {
    const query = String(rest.find((item) => !item.startsWith("--")) ?? "").toLowerCase();
    if (!query) throw new Error("search requires a query");
    const servers = await readServers(String(args.input ?? "data/latest/servers.json"));
    for (const server of rankServers(servers).filter((candidate) => matches(candidate, query))) {
      console.log(`${server.score}\t${server.name}\t${server.description}`);
    }
    return;
  }

  if (command === "diff") {
    const beforePath = String(args.before ?? "");
    const afterPath = String(args.after ?? "");
    if (!beforePath || !afterPath) throw new Error("diff requires --before and --after");
    const diff = diffServers(await readServers(beforePath), await readServers(afterPath));
    console.log(`added=${diff.added.length} removed=${diff.removed.length} changed=${diff.changed.length}`);
    for (const server of diff.added) console.log(`+ ${server.name}`);
    for (const server of diff.removed) console.log(`- ${server.name}`);
    for (const entry of diff.changed) console.log(`~ ${entry.after.name}: ${entry.fields.join(", ")}`);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function matches(server: { name: string; description: string; category: string; tags: string[] }, query: string) {
  return [server.name, server.description, server.category, ...server.tags].some((value) => value.toLowerCase().includes(query));
}

function parseArgs(args: string[]): Args {
  const parsed: Args = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function help() {
  console.log(`mcpwatch

Commands:
  top --input data/latest/servers.json --limit 10
  search <query> --input data/latest/servers.json
  diff --before old.json --after new.json
`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
