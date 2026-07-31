import assert from "node:assert/strict";
import test from "node:test";
import { fetchOfficialRegistry } from "../src/lib/registry.js";

function record(name: string, version: string) {
  return { server: { name, title: name, description: `${name} description`, version } };
}

function mockFetch(pages: Record<string, unknown>) {
  const urls: string[] = [];
  const fetcher = async (input: string | URL | Request) => {
    const url = new URL(String(input));
    urls.push(url.href);
    const cursor = url.searchParams.get("cursor") ?? "first";
    return new Response(JSON.stringify(pages[cursor]));
  };
  return { fetcher: fetcher as typeof fetch, urls };
}

test("fetchOfficialRegistry follows cursors and deduplicates versions across pages", async () => {
  const { fetcher, urls } = mockFetch({
    first: { servers: [record("alpha", "1.0.0"), record("shared", "1.2.0")], metadata: { nextCursor: "page-2" } },
    "page-2": { servers: [record("beta", "1.0.0"), record("shared", "1.10.0")] }
  });
  const servers = await fetchOfficialRegistry("https://registry.example/v0/servers?limit=50", fetcher);
  assert.deepEqual(servers.map(({ id, version }) => [id, version]), [
    ["alpha", "1.0.0"], ["shared", "1.10.0"], ["beta", "1.0.0"]
  ]);
  assert.equal(new URL(urls[0]).searchParams.get("limit"), "50");
  assert.equal(new URL(urls[1]).searchParams.get("cursor"), "page-2");
});

test("fetchOfficialRegistry stops cursor loops without requesting a page twice", async () => {
  const { fetcher, urls } = mockFetch({
    first: { servers: [record("alpha", "1.0.0")], metadata: { nextCursor: "loop" } },
    loop: { servers: [record("beta", "1.0.0")], metadata: { nextCursor: "loop" } }
  });
  const servers = await fetchOfficialRegistry("https://registry.example/v0/servers", fetcher);
  assert.deepEqual(servers.map(({ id }) => id), ["alpha", "beta"]);
  assert.equal(urls.length, 2);
});

test("fetchOfficialRegistry stops repeated pages even when cursors change", async () => {
  const repeated = [record("alpha", "1.0.0")];
  const { fetcher, urls } = mockFetch({
    first: { servers: repeated, metadata: { nextCursor: "page-2" } },
    "page-2": { servers: repeated, metadata: { nextCursor: "page-3" } }
  });
  const servers = await fetchOfficialRegistry("https://registry.example/v0/servers", fetcher);
  assert.deepEqual(servers.map(({ id }) => id), ["alpha"]);
  assert.equal(urls.length, 2);
});

test("fetchOfficialRegistry treats absent or malformed metadata as a single page", async () => {
  for (const metadata of [undefined, null, "next", { nextCursor: 42 }]) {
    const { fetcher, urls } = mockFetch({ first: { servers: [record("alpha", "1.0.0")], metadata } });
    const servers = await fetchOfficialRegistry("https://registry.example/v0/servers", fetcher);
    assert.deepEqual(servers.map(({ id }) => id), ["alpha"]);
    assert.equal(urls.length, 1);
  }
});
