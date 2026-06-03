import { readFile } from "node:fs/promises";
import { validateServers } from "./validate.js";

export async function readServers(path: string) {
  const raw = await readFile(path, "utf8");
  return validateServers(JSON.parse(raw));
}
