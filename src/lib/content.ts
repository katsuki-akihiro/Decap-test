import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

const CONTENT_ROOT = path.resolve("content");

export type ContentEntry = {
  title: string;
  slug: string;
  description?: string;
  source_url?: string;
  imported_at?: string;
  body: string;
};

async function readMarkdownFiles(directory: string) {
  const dirPath = path.join(CONTENT_ROOT, directory);
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name);

  const results = await Promise.all(
    files.map(async (file) => {
      const fullPath = path.join(dirPath, file);
      const raw = await fs.readFile(fullPath, "utf-8");
      const { data, content } = matter(raw);
      return {
        title: data.title ?? file.replace(/\.md$/, ""),
        slug: data.slug ?? file.replace(/\.md$/, ""),
        description: data.description,
        source_url: data.source_url,
        imported_at: data.imported_at,
        body: marked.parse(content)
      } satisfies ContentEntry;
    })
  );

  return results;
}

export async function getPages() {
  return readMarkdownFiles("pages");
}

export async function getPosts() {
  return readMarkdownFiles("posts");
}

export async function getPageBySlug(type: "pages" | "posts", slug: string) {
  const items = await readMarkdownFiles(type);
  return items.find((item) => item.slug === slug);
}
