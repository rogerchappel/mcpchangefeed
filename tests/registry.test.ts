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

test("fetchOfficialRegistry retries a rate-limited page and honors Retry-After", async () => {
  let calls = 0;
  const delays: number[] = [];
  const fetcher = async () => {
    calls += 1;
    if (calls === 1) return new Response(null, { status: 429, statusText: "Too Many Requests", headers: { "retry-after": "2" } });
    return new Response(JSON.stringify({ servers: [record("alpha", "1.0.0")] }));
  };

  const servers = await fetchOfficialRegistry("https://registry.example/v0/servers", fetcher as typeof fetch, {
    sleep: async (milliseconds) => { delays.push(milliseconds); }
  });

  assert.deepEqual(servers.map(({ id }) => id), ["alpha"]);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [2_000]);
});

test("fetchOfficialRegistry retries a rejected fetch and recovers", async () => {
  let calls = 0;
  const delays: number[] = [];
  const fetcher = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("fetch failed");
    return new Response(JSON.stringify({ servers: [record("alpha", "1.0.0")] }));
  };

  const servers = await fetchOfficialRegistry("https://registry.example/v0/servers", fetcher as typeof fetch, {
    sleep: async (milliseconds) => { delays.push(milliseconds); }
  });

  assert.deepEqual(servers.map(({ id }) => id), ["alpha"]);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [250]);
});

test("fetchOfficialRegistry aborts timed-out requests and stops after the configured retry limit", async () => {
  let calls = 0;
  const signals: AbortSignal[] = [];
  const delays: number[] = [];
  const cleared: number[] = [];
  let nextTimer = 0;
  const callbacks = new Map<number, () => void>();
  const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
    calls += 1;
    signals.push(init?.signal as AbortSignal);
    return await new Promise<Response>(() => undefined);
  };
  const schedule = ((callback: () => void) => {
    const timer = ++nextTimer;
    callbacks.set(timer, callback);
    queueMicrotask(() => callbacks.get(timer)?.());
    return timer;
  }) as unknown as typeof setTimeout;
  const cancel = ((timer: number) => {
    cleared.push(timer);
    callbacks.delete(timer);
  }) as unknown as typeof clearTimeout;

  await assert.rejects(
    fetchOfficialRegistry("https://registry.example/v0/servers", fetcher as typeof fetch, {
      maxRetries: 2,
      requestTimeoutMs: 125,
      sleep: async (milliseconds) => { delays.push(milliseconds); },
      setTimeout: schedule,
      clearTimeout: cancel
    }),
    /Registry fetch failed after 3 attempts: request timed out after 125ms/
  );

  assert.equal(calls, 3);
  assert.deepEqual(delays, [250, 500]);
  assert.equal(signals.length, 3);
  assert.ok(signals.every((signal) => signal.aborted));
  assert.deepEqual(cleared, [1, 2, 3]);
});

test("fetchOfficialRegistry clears request timeouts after successful responses", async () => {
  const cleared: unknown[] = [];
  let receivedSignal: AbortSignal | undefined;
  const timer = { id: "request-timeout" };
  const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
    receivedSignal = init?.signal as AbortSignal;
    return new Response(JSON.stringify({ servers: [record("alpha", "1.0.0")] }));
  };

  const servers = await fetchOfficialRegistry("https://registry.example/v0/servers", fetcher as typeof fetch, {
    maxRetries: 0,
    requestTimeoutMs: 987,
    setTimeout: ((callback: () => void, milliseconds: number) => {
      assert.equal(typeof callback, "function");
      assert.equal(milliseconds, 987);
      return timer;
    }) as unknown as typeof setTimeout,
    clearTimeout: ((value: unknown) => { cleared.push(value); }) as typeof clearTimeout
  });

  assert.deepEqual(servers.map(({ id }) => id), ["alpha"]);
  assert.equal(receivedSignal?.aborted, false);
  assert.deepEqual(cleared, [timer]);
});

test("fetchOfficialRegistry reports the final network error after exhausting retries", async () => {
  let calls = 0;
  const delays: number[] = [];
  const fetcher = async () => {
    calls += 1;
    throw new TypeError("fetch failed");
  };

  await assert.rejects(
    fetchOfficialRegistry("https://registry.example/v0/servers", fetcher as typeof fetch, {
      maxRetries: 2,
      sleep: async (milliseconds) => { delays.push(milliseconds); }
    }),
    /Registry fetch failed after 3 attempts: fetch failed/
  );
  assert.equal(calls, 3);
  assert.deepEqual(delays, [250, 500]);
});

test("fetchOfficialRegistry reports the final response after exhausting retries", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return new Response(null, { status: 503, statusText: "Service Unavailable" });
  };

  await assert.rejects(
    fetchOfficialRegistry("https://registry.example/v0/servers", fetcher as typeof fetch, {
      maxRetries: 2,
      sleep: async () => undefined
    }),
    /Registry fetch failed after 3 attempts: 503 Service Unavailable/
  );
  assert.equal(calls, 3);
});

test("fetchOfficialRegistry fails non-retryable client errors immediately", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return new Response(null, { status: 404, statusText: "Not Found" });
  };

  await assert.rejects(
    fetchOfficialRegistry("https://registry.example/v0/servers", fetcher as typeof fetch, {
      sleep: async () => assert.fail("non-retryable responses must not sleep")
    }),
    /Registry fetch failed: 404 Not Found/
  );
  assert.equal(calls, 1);
});
