import { defineConfig } from "astro/config";

export default defineConfig({
  srcDir: "site-src/src",
  publicDir: "site-src/public",
  outDir: "site",
  site: "https://mcpchangefeed.com",
  build: {
    format: "directory"
  }
});
