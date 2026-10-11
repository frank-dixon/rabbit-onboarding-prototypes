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
    await page.click("#f-pedigree-sd-newName >> xpath=ancestor::details[1]/summary");
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

if (flows.includes("b")) {
  await check("B: accordion unlocks in order and adds a purebred rabbit", async () => {
    await page.goto(BASE + "b/");
    await noHorizontalScroll();
    assert.equal(await page.getAttribute("#section-breed > summary", "aria-disabled"), "true");
    await page.click("#section-breed > summary");
    assert.equal(await page.getAttribute("#section-breed", "open"), null);

    await page.click("[data-continue='0']");
    await page.waitForSelector("#section-basics [data-error-summary]:has-text('Enter a name')");
    await page.fill("#f-name", "Hazel B");
    await page.check("#f-sex-1");
    await page.fill("#f-birthDate", "2024-06-01");
    await page.fill("#f-color", "Chestnut");
    await page.waitForSelector("[data-summary]:has-text('Hazel B')");
    await page.click("[data-continue='0']");
    await page.waitForSelector("#section-breed[open]");

    await page.reload();
    await page.waitForSelector("#section-breed[open]");
    assert.equal(await page.inputValue("#f-name"), "Hazel B");

    await page.check("#f-breedType-0");
    await page.selectOption("#f-purebred", "Mini Californian");
    await page.click("[data-continue='1']");
    await page.waitForSelector("#section-relatives[open]");
    await page.click("[data-continue='2']");
    await page.waitForSelector("#section-pedigree[open]");
    await page.selectOption("#f-pedigree-d-ref", "h:3");
    assert.equal(await page.locator("#f-pedigree-s-ref option[value='h:1']").count(), 0, "a doe must not be offered as a sire");
    await page.selectOption("#f-pedigree-s-ref", "o:52");
    await page.click("[data-continue='3']");
    await page.waitForSelector("#section-review[open]");
    await page.waitForSelector("#section-review:has-text('Mini Californian')");
    await page.click("[data-save]");
    await page.waitForSelector("#done-heading:has-text('Hazel B was added')");
  });

  await check("B: two-column layout on a desktop screen", async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BASE + "b/");
    const aside = await page.locator("[data-summary]").boundingBox();
    const sections = await page.locator("[data-sections]").boundingBox();
    assert.ok(aside.x > sections.x + sections.width - 1, "summary should sit beside the sections");
    await page.setViewportSize({ width: 390, height: 844 });
  });
}

if (flows.includes("c")) {
  await check("C: one question per card with big targets adds a rabbit", async () => {
    await page.goto(BASE + "c/");
    await noHorizontalScroll();
    await page.fill("#f-name", "Hazel C");
    await page.press("#f-name", "Enter");
    await page.waitForSelector("#question:has-text('Is Hazel C a doe or a buck?')");
    const tile = await page.locator("label[for='f-sex-0']").boundingBox();
    assert.ok(tile.height >= 56, `tap target is ${tile.height}px tall`);
    const next = await page.locator("[data-next]").boundingBox();
    assert.ok(next.y + next.height <= 844 && next.height >= 56, "Next sits in the bottom bar");
    await page.check("#f-sex-0");
    await page.click("[data-next]");
    await page.fill("#f-birthDate", "2024-07-04");
    await page.click("[data-next]");
    await page.fill("#f-color", "Fawn");
    await page.click("[data-next]");
    await page.click("[data-next]");
    await page.check("#f-breedType-1");
    await page.click("[data-next]");
    await page.waitForSelector("#question:has-text('mix')");

    await page.reload();
    await page.waitForSelector("#question:has-text('Which breeds are in Hazel C')");
    await page.selectOption("#f-cross-0-breed", "Thuringer");
    await page.fill("#f-cross-0-percent", "75");
    await page.selectOption("#f-cross-1-breed", "Holland Lop");
    await page.fill("#f-cross-1-percent", "25");
    await page.waitForSelector("[data-cross-total]:has-text('Ready')");
    await page.click("[data-next]");

    await page.waitForSelector("[data-next]:has-text('Skip')");
    await page.click("[data-action=add-relative]");
    await page.selectOption("#f-relatives-0-relationship", "sibling");
    await page.click("#f-relatives-0-newName >> xpath=ancestor::details[1]/summary");
    await page.fill("#f-relatives-0-newName", "Lily");
    await page.click("[data-next]");
    await page.waitForSelector("#question:has-text('sire and dam')");
    await page.selectOption("#f-pedigree-d-ref", "h:3");
    await page.click("[data-next]");
    await page.waitForSelector("[data-next]:has-text('Skip')");
    await page.click("[data-next]");
    await page.click("[data-next]");
    await page.waitForSelector("#question:has-text('Does this look right?')");
    await page.waitForSelector("text=Cross: 75% Thuringer, 25% Holland Lop");
    await page.click("[data-next]");
    await page.waitForSelector("#done-heading:has-text('Hazel C was added')");
    await page.goto(BASE);
    await page.waitForSelector("#herd-list:has-text('Hazel C')");
    await page.waitForSelector("#herd-list:has-text('sibling: Lily')");
  });
}

await check("PWA: manifest, icons, and service worker cache the site for offline use", async () => {
  await page.goto(BASE);
  const manifestHref = await page.getAttribute("link[rel=manifest]", "href");
  const manifestUrl = new URL(manifestHref, page.url()).href;
  const manifest = await (await page.request.get(manifestUrl)).json();
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons) {
    const response = await page.request.get(new URL(icon.src, manifestUrl).href);
    assert.equal(response.status(), 200, icon.src);
  }
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null, null, { timeout: 15000 })
    .catch(async () => { await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 }); });
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  assert.ok(scope.endsWith("/rabbit-onboarding-prototypes/"), `scope is ${scope}`);
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    if (!keys.length) return false;
    const cache = await caches.open(keys[0]);
    return (await cache.keys()).length >= 20;
  }, null, { timeout: 15000 });

  await context.setOffline(true);
  try {
    for (const path of ["", "a/", "b/", "c/"]) {
      await page.goto(BASE + path);
      await page.waitForSelector(path ? "#app form, #app details" : "#herd-list li");
    }
  } finally {
    await context.setOffline(false);
  }
});

for (const line of results) console.log(line);
if (problems.length) console.log("Browser errors:\n  " + problems.join("\n  "));
await browser.close();
server?.close();
if (results.some((line) => line.startsWith("FAIL")) || problems.length) process.exit(1);
