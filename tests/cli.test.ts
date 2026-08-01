import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function cli(...args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

test("search accepts its query before or after options", () => {
  for (const args of [
    ["search", "filesystem", "--input", "fixtures/servers.json"],
    ["search", "--input", "fixtures/servers.json", "filesystem"]
  ]) {
    const result = cli(...args);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Filesystem MCP Server/);
  }
});

test("search requires exactly one positional query", () => {
  for (const args of [["search"], ["search", "file", "system"]]) {
    const result = cli(...args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /search requires exactly one query/);
  }
});

test("top rejects non-integer, non-finite, and out-of-range limits", () => {
  for (const value of ["nope", "NaN", "Infinity", "1.5", "0", "101"]) {
    const result = cli("top", "--input", "fixtures/servers.json", "--limit", value);
    assert.equal(result.status, 1, value);
    assert.match(result.stderr, /--limit must be an integer from 1 to 100/);
  }
});

test("commands reject unknown, inapplicable, and missing-value options before file access", () => {
  for (const args of [
    ["top", "--input", "fixtures/servers.json", "--bogus", "value"],
    ["search", "filesystem", "--limit", "2"],
    ["diff", "--before", "fixtures/servers-before.json", "--after"]
  ]) {
    const result = cli(...args);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /ENOENT/);
    assert.match(result.stderr, /Unknown option|requires a value/);
  }
});
