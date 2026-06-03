import { readServers } from "../src/lib/io.js";

const path = process.argv[2];
if (!path) {
  throw new Error("Usage: validate-data <servers.json>");
}

const servers = await readServers(path);
console.log(`validated ${servers.length} server records`);
