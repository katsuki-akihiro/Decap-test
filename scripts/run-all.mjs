import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function run(command, args) {
  const { stdout, stderr } = await execFileAsync(command, args, { stdio: "pipe" });
  if (stdout) {
    console.log(stdout.trim());
  }
  if (stderr) {
    console.error(stderr.trim());
  }
}

await run("node", ["scripts/fetch-sitemap.mjs"]);
await run("node", ["scripts/scrape-pages.mjs"]);
