import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("refresh workflow stages every tracked site build artifact", async () => {
  const workflow = await readFile(".github/workflows/refresh.yml", "utf8");
  const siteCommitStep = workflow.match(/- name: Commit site changes[\s\S]*?(?=\n      - name:)/)?.[0];

  assert.ok(siteCommitStep, "missing site artifact commit step");
  assert.match(
    siteCommitStep,
    /git add site-src\/public\/data site-src\/public\/robots\.txt site(?:\s|$)/,
    "site commit must stage generated Astro public inputs and output"
  );
});
