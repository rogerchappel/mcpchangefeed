import { categorySlug, getServers, serverSlug } from "../lib/site-data";

export async function GET() {
  const servers = await getServers();
  const categories = [...new Set(servers.map((server) => server.category))];
  const urls = [
    "/",
    "/changes/",
    "/blog/",
    ...servers.map((server) => `/servers/${serverSlug(server)}/`),
    ...categories.map((category) => `/categories/${categorySlug(category)}/`)
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${new URL(url, "https://mcpchangefeed.com").href}</loc></url>`).join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml"
    }
  });
}
