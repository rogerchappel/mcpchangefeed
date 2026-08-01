#!/usr/bin/env node
import { diffServers } from "./lib/diff.js";
import { readServers } from "./lib/io.js";
import { rankServers } from "./lib/score.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Args = Record<string, string>;

type ParsedArgs = {
  options: Args;
  positionals: string[];
};

const commandOptions: Record<string, Set<string>> = {
  top: new Set(["input", "limit"]),
  search: new Set(["input"]),
  diff: new Set(["before", "after"])
};

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { options: args, positionals } = parseArgs(command, rest);

  if (!command || command === "--help" || command === "-h") {
    help();
    return;
  }

  if (command === "--version" || command === "-v") {
    version();
    return;
  }

  if (command === "top") {
    rejectPositionals(command, positionals);
    const servers = await readServers(inputPath(args));
    const limit = parseLimit(args.limit);
    for (const server of rankServers(servers).slice(0, limit)) {
      console.log(`${server.score}\t${server.name}\t${server.category}\t${server.repository ?? server.homepage ?? ""}`);
    }
    return;
  }

  if (command === "search") {
    if (positionals.length !== 1) throw new Error("search requires exactly one query");
    const query = positionals[0].toLowerCase();
    const servers = await readServers(inputPath(args));
    for (const server of rankServers(servers).filter((candidate) => matches(candidate, query))) {
      console.log(`${server.score}\t${server.name}\t${server.description}`);
    }
    return;
  }

  if (command === "diff") {
    rejectPositionals(command, positionals);
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

function inputPath(args: Args) {
  return args.input
    ? String(args.input)
    : fileURLToPath(new URL("../data/latest/servers.json", import.meta.url));
}

function matches(server: { name: string; description: string; category: string; tags: string[] }, query: string) {
  return [server.name, server.description, server.category, ...server.tags].some((value) => value.toLowerCase().includes(query));
}

function parseArgs(command: string | undefined, args: string[]): ParsedArgs {
  const parsed: Args = {};
  const positionals: string[] = [];
  const allowed = command ? commandOptions[command] : undefined;
  if (command && !allowed) return { options: parsed, positionals: args };

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const key = value.slice(2);
    if (!key || !allowed?.has(key)) throw new Error(`Unknown option for ${command}: ${value}`);
    if (key in parsed) throw new Error(`Option may only be specified once: ${value}`);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Option requires a value: ${value}`);
    }
    parsed[key] = next;
    index += 1;
  }
  return { options: parsed, positionals };
}

function parseLimit(value: string | undefined) {
  if (value === undefined) return 10;
  const limit = Number(value);
  if (!Number.isInteger(limit) || !Number.isFinite(limit) || limit < 1 || limit > 100) {
    throw new Error("--limit must be an integer from 1 to 100");
  }
  return limit;
}

function rejectPositionals(command: string, positionals: string[]) {
  if (positionals.length > 0) throw new Error(`${command} does not accept positional arguments`);
}

function help() {
  console.log(`mcpfeed / mcpchangefeed

Commands:
  --help
  --version
  top [--input data/latest/servers.json] [--limit 1..100]
  search <query> [--input data/latest/servers.json]
  diff --before old.json --after new.json
`);
}

function version() {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  console.log(packageJson.version);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
