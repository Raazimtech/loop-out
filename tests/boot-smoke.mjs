import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({ headless: true });
try {
  for (const device of [
    { name: "desktop", viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
    { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  ]) {
    const context = await browser.newContext(device);
    const page = await context.newPage();

    // The startup flow must remain usable even when optional third-party game
    // libraries are unavailable. This test isolates the first-party entry UI.
    await page.route("**/supabase-js@2*", route => route.fulfill({
      contentType: "application/javascript",
      body: "window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:null,error:{message:'not used'}})})})})})};",
    }));
    await page.route("**/game.js", route => route.fulfill({
      contentType: "application/javascript",
      body: "window.startLoopOutGame=()=>{};window.stopLoopOutGame=()=>{};",
    }));

    await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
    const enter = page.locator("#boot-enter");
    await enter.waitFor({ state: "visible" });
    if (device.hasTouch) await enter.tap();
    else await enter.click();

    await page.waitForFunction(() =>
      document.querySelector("#raazim-splash")?.classList.contains("leaving") &&
      !document.querySelector("#auth-view")?.classList.contains("hidden")
    );
    assert.equal(await page.locator("#auth-view").isVisible(), true, `${device.name}: auth screen did not appear`);
    await context.close();
    console.log(`PASS: ${device.name} startup entry`);
  }
} finally {
  await browser.close();
}
