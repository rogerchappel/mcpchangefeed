import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";

export async function previousHistorySnapshot(historyDir: string, input: string): Promise<string | undefined> {
  const snapshotName = basename(input);
  let entries;

  try {
    entries = await readdir(historyDir, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }

  const snapshots: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = join(historyDir, entry.name, snapshotName);
    try {
      const files = await readdir(join(historyDir, entry.name));
      if (files.includes(snapshotName)) snapshots.push(candidate);
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }

  snapshots.sort();
  return snapshots.at(-2);
}

function isMissing(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
