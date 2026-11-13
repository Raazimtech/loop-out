import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({ headless: true, args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"] });
try {
  for (const device of [
    { name: "desktop", viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
    { name: "mobile", viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
  ]) {
    const context = await browser.newContext({ ...device, serviceWorkers: "allow" });
    const page = await context.newPage();
    const pageErrors = [];
    const supabaseRequests = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("request", request => {
      if (/supabase/i.test(request.url())) supabaseRequests.push(request.url());
    });

    await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.startLoopOutGame === "function", null, { timeout: 30000 });
    await page.waitForFunction(() =>
      document.querySelector("#raazim-splash")?.classList.contains("leaving") &&
      document.querySelector("#game-view")?.classList.contains("hidden") === false
    , null, { timeout: 10000 });
    assert.equal(await page.locator("#auth-view").count(), 0, "account UI must not exist");
    assert.equal(await page.locator("#nickname").count(), 0, "account fields must not exist");
    assert.equal(await page.locator("#game-view").isVisible(), true, "game should open directly after splash");
    assert.equal(await page.locator("#game-player-label").inputValue(), "SURVIVOR");
    await page.locator("#game-player-label").fill("TESTPLAYER");
    assert.equal(await page.evaluate(() => localStorage.getItem("loopout-player-name")), "TESTPLAYER");
    await page.waitForFunction(() => Number(document.querySelector("#game-enemy-count")?.textContent || 0) > 0, null, { timeout: 10000 });
    assert.deepEqual(supabaseRequests, [], "game must not contact Supabase");
    assert.deepEqual(pageErrors, [], `${device.name}: browser runtime error`);
    const cachedAssets = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      return {
        engine: Boolean(await caches.match("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js")),
        map: Boolean(await caches.match(new URL("./assets/blackout/building-type-a.glb", location.href).href))
      };
    });
    assert.equal(cachedAssets.engine, true, "Three.js must be cached for offline use");
    assert.equal(cachedAssets.map, true, "map assets must be cached for offline use");
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.startLoopOutGame === "function", null, { timeout: 15000 });
    await page.waitForFunction(() => Number(document.querySelector("#game-enemy-count")?.textContent || 0) > 0, null, { timeout: 15000 });
    assert.equal(await page.locator("#game-view").isVisible(), true, `${device.name}: game did not launch offline`);
    assert.deepEqual(pageErrors, [], `${device.name}: offline browser runtime error`);
    await context.close();
    console.log(`PASS: ${device.name} offline solo entry`);
  }
} finally {
  await browser.close();
}
