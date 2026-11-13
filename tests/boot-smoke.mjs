import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({ headless: true });
try {
  for (const device of [
    { name: "desktop", viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
    { name: "mobile", viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
  ]) {
    const context = await browser.newContext(device);
    const page = await context.newPage();
    const pageErrors = [];
    const failedRequests = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("requestfailed", request => failedRequests.push(`${request.url()}: ${request.failure()?.errorText || "request failed"}`));

    // Isolate Supabase: this smoke test checks startup navigation, not live credentials.
    await page.route("**/supabase-js@2*", route => route.fulfill({
      contentType: "application/javascript",
      body: "window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({}),signInWithPassword:async()=>({data:{session:{access_token:'test'},user:{id:'test-player'}},error:null})},functions:{invoke:async()=>({data:{ok:true},error:null})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{id:'test-player',username:'SmokeTest',character_id:'recon'},error:null})})}),update:()=>({eq:async()=>({error:null})})})})};",
    }));

    await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
    try {
      await page.waitForFunction(() => typeof window.startLoopOutGame === "function", null, { timeout: 30000 });
    } catch {
      throw new Error(
        `${device.name}: game module did not initialize. Browser errors: ${pageErrors.join(" | ") || "none"}; failed requests: ${failedRequests.join(" | ") || "none"}`
      );
    }
    assert.deepEqual(pageErrors, [], `${device.name}: browser runtime error`);

    await page.waitForFunction(() =>
      document.querySelector("#raazim-splash")?.classList.contains("leaving") &&
      !document.querySelector("#auth-view")?.classList.contains("hidden")
    , null, { timeout: 10000 });
    assert.equal(await page.locator("#auth-view").isVisible(), true, `${device.name}: automatic splash did not reveal account screen`);
    assert.equal(await page.locator("#raazim-splash").locator(".boot-wordmark").textContent(), "LOOP OUT");
    assert.equal(await page.locator("#raazim-splash").locator(".boot-sub").textContent(), "RAAZIM");
    assert.equal(await page.locator("#rotate-gate").isVisible(), false, `${device.name}: rotate gate blocked landscape app`);
    assert.equal(await page.locator("#boot-enter").count(), 0, "tap-to-enter control must not exist");
    await page.locator("#nickname").fill("SmokeTest");
    await page.locator("#password").fill("ValidPass123");
    await page.locator("#auth-submit").click();
    await page.waitForFunction(() => !document.querySelector("#character-view")?.classList.contains("hidden"), null, { timeout: 5000 });
    assert.equal(await page.locator("#character-view").isVisible(), true, "callsign signup did not advance after successful auth");
    await context.close();
    console.log(`PASS: ${device.name} startup entry`);
  }
} finally {
  await browser.close();
}
