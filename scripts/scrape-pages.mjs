import fs from "node:fs/promises";
import path from "node:path";
import slugify from "slugify";
import { chromium } from "playwright";
import { htmlToMarkdown } from "./transform-to-md.mjs";

const OUTPUT_DIR = path.resolve("scripts/output");
const LOG_DIR = path.join(OUTPUT_DIR, "logs");
const HTML_DIR = path.join(OUTPUT_DIR, "html");
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "screenshots");
const PROCESSED_PATH = path.join(OUTPUT_DIR, "processed.json");
const URLS_PATH = path.join(OUTPUT_DIR, "urls.json");

const WAIT_SELECTORS = ["main", "article", ".content", "#content"];

function slugFromUrl(url) {
  const { pathname } = new URL(url);
  const sanitized = pathname.replace(/\/$/, "");
  if (!sanitized || sanitized === "/") {
    return "index";
  }
  return slugify(sanitized.split("/").filter(Boolean).join("-"), {
    lower: true,
    strict: true
  });
}

function resolveCollection(url) {
  return /\/(blog|column|columns|post|news)\//.test(url) ? "posts" : "pages";
}

async function ensureDirs() {
  await Promise.all([
    fs.mkdir(LOG_DIR, { recursive: true }),
    fs.mkdir(HTML_DIR, { recursive: true }),
    fs.mkdir(SCREENSHOT_DIR, { recursive: true }),
    fs.mkdir(path.resolve("content/pages"), { recursive: true }),
    fs.mkdir(path.resolve("content/posts"), { recursive: true })
  ]);
}

async function readProcessed() {
  try {
    const raw = await fs.readFile(PROCESSED_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

async function writeProcessed(processed) {
  await fs.writeFile(PROCESSED_PATH, JSON.stringify(processed, null, 2));
}

async function appendLog(filename, payload) {
  const logPath = path.join(LOG_DIR, filename);
  await fs.appendFile(logPath, `${JSON.stringify(payload)}\n`);
}

async function main() {
  await ensureDirs();

  const urlsRaw = await fs.readFile(URLS_PATH, "utf-8");
  const urls = JSON.parse(urlsRaw);
  const processed = await readProcessed();

  const browser = await chromium.launch();
  const context = await browser.newContext();

  for (const url of urls) {
    if (processed[url]?.status === "success") {
      continue;
    }

    const slug = slugFromUrl(url);
    const collection = resolveCollection(url);
    const startTime = new Date().toISOString();

    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForLoadState("networkidle", { timeout: 45000 });
      await page.waitForTimeout(1500);

      let found = false;
      for (const selector of WAIT_SELECTORS) {
        const element = await page.$(selector);
        if (element) {
          found = true;
          break;
        }
      }

      if (!found) {
        throw new Error("Main content selector not found");
      }

      const extracted = await page.evaluate((selectors) => {
        const pick = selectors
          .map((sel) => document.querySelector(sel))
          .find((node) => node);

        if (!pick) {
          return null;
        }

        const clone = pick.cloneNode(true);
        clone
          .querySelectorAll("nav, footer, aside, script, style, .breadcrumb, .sidebar")
          .forEach((node) => node.remove());

        const h1 = clone.querySelector("h1");
        if (h1) {
          h1.remove();
        }

        return {
          title: document.querySelector("h1")?.textContent?.trim() || document.title,
          html: clone.innerHTML
        };
      }, WAIT_SELECTORS);

      if (!extracted) {
        throw new Error("Unable to extract main content");
      }

      const markdown = htmlToMarkdown(extracted.html);
      const frontmatter = [
        "---",
        `title: "${extracted.title?.replace(/\"/g, "\\\"")}"`,
        `slug: "${slug}"`,
        `source_url: "${url}"`,
        `imported_at: "${startTime}"`,
        "---",
        ""
      ].join("\n");

      const outputPath = path.resolve(`content/${collection}/${slug}.md`);
      await fs.writeFile(outputPath, `${frontmatter}${markdown}\n`);

      processed[url] = { status: "success", slug, title: extracted.title, time: startTime };
      await appendLog("success.jsonl", processed[url]);
    } catch (error) {
      const htmlPath = path.join(HTML_DIR, `${slug}.html`);
      const screenshotPath = path.join(SCREENSHOT_DIR, `${slug}.png`);

      try {
        const html = await page.content();
        await fs.writeFile(htmlPath, html);
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch (innerError) {
        console.warn("Failed to save HTML/screenshot", innerError);
      }

      const reason = error instanceof Error ? error.message : "Unknown error";
      processed[url] = { status: "failed", slug, reason, time: startTime };
      await appendLog("failed.jsonl", {
        url,
        reason,
        htmlPath,
        screenshotPath
      });
    } finally {
      await page.close();
      await writeProcessed(processed);
    }
  }

  await browser.close();
}

await main();
