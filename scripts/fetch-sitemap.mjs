import fs from "node:fs/promises";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

const OUTPUT_DIR = path.resolve("scripts/output");
const DEFAULT_SITEMAP = "https://j-aic.com/sitemap.xml";

const EXCLUDED_PATTERNS = [
  /\?.+/, // query params
  /\/tag\//,
  /\/search\//,
  /\/wp-admin\//,
  /\/feed\/?$/,
  /\/#/,
  /\/?s=/
];

async function fetchXml(url) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function parseSitemap(xmlText) {
  const parser = new XMLParser({ ignoreAttributes: false });
  return parser.parse(xmlText);
}

async function collectUrlsFromSitemap(url) {
  const xmlText = await fetchXml(url);
  const parsed = parseSitemap(xmlText);

  if (parsed.sitemapindex?.sitemap) {
    const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
      ? parsed.sitemapindex.sitemap
      : [parsed.sitemapindex.sitemap];

    const nestedUrls = await Promise.all(
      sitemaps.map(async (entry) => {
        const loc = entry.loc;
        return collectUrlsFromSitemap(loc);
      })
    );
    return nestedUrls.flat();
  }

  const urlEntries = Array.isArray(parsed.urlset?.url) ? parsed.urlset.url : [parsed.urlset?.url];
  return urlEntries
    .filter(Boolean)
    .map((entry) => entry.loc)
    .filter(Boolean);
}

function filterUrls(urls) {
  const normalized = urls
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    .map((url) => url.replace(/\/$/, ""));

  const unique = Array.from(new Set(normalized));
  return unique.filter((url) => !EXCLUDED_PATTERNS.some((pattern) => pattern.test(url)));
}

async function main() {
  const sitemapUrl = process.argv[2] ?? DEFAULT_SITEMAP;
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const urls = await collectUrlsFromSitemap(sitemapUrl);
  const filtered = filterUrls(urls);

  const outputPath = path.join(OUTPUT_DIR, "urls.json");
  await fs.writeFile(outputPath, JSON.stringify(filtered, null, 2));

  console.log(`Collected ${filtered.length} URLs from ${sitemapUrl}`);
  console.log(`Saved to ${outputPath}`);
}

await main();
