// End-to-end checks in a phone-sized Chrome. Run with: npm run e2e
// Set BASE_URL to test a deployed copy; otherwise a local server is used.
// Set CHROME_PATH if Chrome is not at /usr/bin/google-chrome.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const ROOT = new URL("..", import.meta.url).pathname;
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".svg": "image/svg+xml",
};

function serve() {
  // Serve the repo under /rabbit-onboarding-prototypes/ to match Pages.
  const prefix = "/rabbit-onboarding-prototypes/";
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (!url.pathname.startsWith(prefix)) {
      res.writeHead(404).end();
      return;
    }
    let path = normalize(url.pathname.slice(prefix.length)).replace(/^(\.\.[/\\])+/, "");
    if (path === "." || path.endsWith("/")) path = join(path, "index.html");
    try {
      const body = await readFile(join(ROOT, path));
      res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const server = process.env.BASE_URL ? null : await serve();
const BASE = process.env.BASE_URL || `http://127.0.0.1:${server.address().port}/rabbit-onboarding-prototypes/`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome" });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
});
const page = await context.newPage();
const problems = [];
page.on("pageerror", (error) => problems.push(error.message));
page.on("console", (message) => { if (message.type() === "error") problems.push(message.text()); });

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(`ok   ${name}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message.split("\n")[0]}`);
  }
}

async function noHorizontalScroll() {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `page is ${overflow}px wider than the phone screen`);
}

async function resetDemo() {
  await page.goto(BASE);
  page.once("dialog", (dialog) => dialog.accept());
  await page.click("#reset-demo");
  await page.waitForSelector("#reset-status:has-text('reset')");
}

await check("index loads with links and demo herd", async () => {
  await resetDemo();
  await noHorizontalScroll();
  assert.ok(await page.locator("#herd-list li").count() >= 4);
});

const flows = (process.env.FLOWS || "a").split(",");

if (flows.includes("a")) {
  await check("A: stepper adds a crossbred rabbit with relatives and pedigree", async () => {
    await page.goto(BASE + "a/");
    await noHorizontalScroll();
    await page.fill("#f-name", "Hazel A");
    await page.check("#f-sex-0");
    assert.equal(await page.getAttribute("#f-birthDate", "type"), "date");
    await page.fill("#f-birthDate", "2024-05-01");
    await page.fill("#f-color", "Black otter");
    await page.click("button[type=submit]");
    await page.waitForSelector("text=Step 2 of 5");

    await page.reload();
    await page.waitForSelector("text=Step 2 of 5");

    await page.check("#f-breedType-1");
    await page.selectOption("#f-cross-0-breed", "Rex");
    await page.fill("#f-cross-0-percent", "60");
    await page.selectOption("#f-cross-1-breed", "Dutch");
    await page.fill("#f-cross-1-percent", "30");
    await page.waitForSelector("[data-cross-total]:has-text('10% to go')");
    await page.click("button[type=submit]");
    await page.waitForSelector("[data-error-summary]:has-text('must total 100%')");
    await page.fill("#f-cross-1-percent", "40");
    await page.waitForSelector("[data-cross-total]:has-text('Ready')");
    await page.click("button[type=submit]");
    await page.waitForSelector("text=Step 3 of 5");

    await page.click("[data-action=add-relative]");
    await page.selectOption("#f-relatives-0-relationship", "dam");
    await page.selectOption("#f-relatives-0-ref", "h:1");
    await page.click("button[type=submit]");
    await page.waitForSelector("text=Step 4 of 5");

    assert.equal(await page.inputValue("#f-pedigree-d-ref"), "h:1");
    await page.selectOption("#f-pedigree-s-ref", "h:2");
    await page.fill("#f-pedigree-sd-newName", "Old Rosie");
    await noHorizontalScroll();
    await page.click("button[type=submit]");
    await page.waitForSelector("text=Step 5 of 5");
    await page.waitForSelector("text=Cross: 60% Rex, 40% Dutch");
    await page.click("button[type=submit]");
    await page.waitForSelector("#done-heading:has-text('Hazel A was added')");

    await page.goto(BASE);
    await page.waitForSelector("#herd-list:has-text('Hazel A')");
    await page.waitForSelector("#herd-list:has-text('Pedigree: 3 of 14')");
  });
}

for (const line of results) console.log(line);
if (problems.length) console.log("Browser errors:\n  " + problems.join("\n  "));
await browser.close();
server?.close();
if (results.some((line) => line.startsWith("FAIL")) || problems.length) process.exit(1);
