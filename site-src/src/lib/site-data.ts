import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { rankServers } from "../../../src/lib/score";
import { slugify } from "../../../src/lib/slug";
import type { McpServer, ScoredServer, ServerDiff } from "../../../src/lib/types";

export type Sponsor = {
  name: string;
  label: string;
  href: string;
  copy: string;
};

const root = process.cwd();
const dataPath = join(root, "data/latest/servers.json");
const changesPath = join(root, "site-src/public/data/changes.json");
const sponsorPath = join(root, "site-src/public/sponsors/sponsors.example.json");

export async function getServers(): Promise<ScoredServer[]> {
  const raw = await readFile(dataPath, "utf8");
  return rankServers(JSON.parse(raw) as McpServer[]);
}

export async function getChanges(): Promise<ServerDiff> {
  const raw = await readFile(changesPath, "utf8");
  return JSON.parse(raw) as ServerDiff;
}

export async function getSponsors(): Promise<Sponsor[]> {
  const raw = await readFile(sponsorPath, "utf8");
  return JSON.parse(raw) as Sponsor[];
}

export function categorySlug(category: string) {
  return slugify(category);
}

export function serverSlug(server: Pick<ScoredServer, "id">) {
  return slugify(server.id);
}

export function formatCategory(category: string) {
  return category
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDate(value?: string) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export function formatNumber(value?: number) {
  if (!value) return "0";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function freshnessLabel(value?: string) {
  if (!value) return "Unknown";
  const then = new Date(value).getTime();
  const now = Date.now();
  const days = Math.max(0, Math.round((now - then) / 86_400_000));
  if (days <= 14) return "Fresh";
  if (days <= 60) return "Active";
  return "Watch";
}
