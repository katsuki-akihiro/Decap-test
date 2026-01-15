import TurndownService from "turndown";

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-"
});

turndownService.addRule("removeEmptyParagraphs", {
  filter: (node) => node.nodeName === "P" && node.textContent.trim() === "",
  replacement: () => ""
});

export function htmlToMarkdown(html) {
  return turndownService.turndown(html).trim();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node scripts/transform-to-md.mjs '<html>'");
    process.exit(1);
  }
  console.log(htmlToMarkdown(input));
}
