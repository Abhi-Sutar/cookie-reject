// Tests for src/engine.js — the actual shipped content-script logic,
// injected as-is into fixture pages that mimic real consent-dialog shapes.
// Each case traces back to either a real bug found and fixed this session,
// or a basic "must not misbehave" safety guarantee.
const { test, expect } = require("@playwright/test");
const path = require("path");
const { installTestHooks, injectEngine } = require("./helpers");

function fixture(name) {
  return "file://" + path.join(__dirname, "fixtures", name).replace(/\\/g, "/");
}

async function waitForReport(page, timeout = 5000) {
  await page.waitForFunction(() => window.__reports && window.__reports.length > 0, null, {
    timeout,
  });
  return page.evaluate(() => window.__reports);
}

test("direct reject-all button is clicked, accept-all never is", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e));
  await installTestHooks(page);
  await page.goto(fixture("direct-reject.html"));
  await injectEngine(page);

  const reports = await waitForReport(page);
  expect(reports).toEqual([
    { type: "cookie-reject:handled", cmp: "Generic", method: "reject-all", host: "" },
  ]);

  const clickLog = await page.evaluate(() => window.__clickLog);
  expect(clickLog.map((c) => c.id)).toEqual(["reject-all"]);
  expect(errors).toEqual([]);
});

test("settings panel: legitimate-interest toggles (checkbox + switch) are switched off, necessary is left alone, save is clicked", async ({
  page,
}) => {
  await installTestHooks(page);
  await page.goto(fixture("settings-panel-li.html"));
  await injectEngine(page);

  const reports = await waitForReport(page);
  expect(reports[0].method).toBe("toggled-off+saved");

  const state = await page.evaluate(() => ({
    necessary: document.getElementById("necessary").checked,
    analytics: document.getElementById("analytics").checked,
    liMarketing: document.getElementById("li-marketing").checked,
    liSwitch: document.getElementById("li-switch").getAttribute("aria-checked"),
  }));
  expect(state).toEqual({
    necessary: true, // must never be touched
    analytics: false,
    liMarketing: false,
    liSwitch: "false",
  });

  const clickLog = await page.evaluate(() => window.__clickLog);
  expect(clickLog.some((c) => c.id === "accept-btn")).toBe(false);
  expect(clickLog.some((c) => c.id === "save-btn")).toBe(true);
});

test("a 'necessary' checkbox that ISN'T DOM-disabled is still protected by the keyword check", async ({
  page,
}) => {
  // Regression test: elementText() used to fall through to el.value for
  // any element, and an unvalued checkbox's .value defaults to the literal
  // string "on" per the HTML spec — so nearbyText() returned "on" instead
  // of walking up to the real label, silently breaking the KW.necessary
  // keyword match for every checkbox-style toggle not also DOM-disabled.
  await installTestHooks(page);
  await page.goto(fixture("necessary-not-disabled.html"));
  await injectEngine(page);

  await waitForReport(page);

  const state = await page.evaluate(() => ({
    necessary: document.getElementById("necessary").checked,
    analytics: document.getElementById("analytics").checked,
  }));
  expect(state).toEqual({
    necessary: true, // protected by the keyword match alone, not disabled=true
    analytics: false,
  });
});

test("toggle whose real <input> is visually hidden but whose <label> is visible still gets switched off", async ({
  page,
}) => {
  await installTestHooks(page);
  await page.goto(fixture("hidden-checkbox-label.html"));
  await injectEngine(page);

  const reports = await waitForReport(page);
  expect(reports[0].method).toBe("toggled-off+saved");

  const checked = await page.evaluate(() => document.getElementById("li-toggle").checked);
  expect(checked).toBe(false);

  const clickLog = await page.evaluate(() => window.__clickLog);
  expect(clickLog.some((c) => c.classes === "fc-confirm-choices")).toBe(true);
});

test("decoy 'View details' link containing a save keyword is never clicked; the real save button is", async ({
  page,
}) => {
  await installTestHooks(page);
  await page.goto(fixture("decoy-text.html"));
  await injectEngine(page);

  const reports = await waitForReport(page);
  expect(reports[0].method).toBe("toggled-off+saved");

  const decoyClicked = await page.evaluate(() => !!window.__decoyClicked);
  expect(decoyClicked).toBe(false);

  const clickLog = await page.evaluate(() => window.__clickLog);
  expect(clickLog.some((c) => c.id === "decoy")).toBe(false);
  expect(clickLog.some((c) => c.classes === "fc-confirm-choices")).toBe(true);
});

test("German inflected 'Alles ablehnen' (vs. uninflected 'alle ablehnen') is recognized as an in-panel reject-all", async ({
  page,
}) => {
  // Regression test for jsonformatter.org: real site's panel used "Alles
  // ablehnen" (grammatically inflected), which the pre-fix KW.reject list
  // (only "alle ablehnen") didn't match as a substring.
  await installTestHooks(page);
  await page.goto(fixture("localized-reject-in-panel.html"));
  await injectEngine(page);

  const reports = await waitForReport(page);
  expect(reports[0].method).toBe("settings-reject-all");

  const clickLog = await page.evaluate(() => window.__clickLog);
  expect(clickLog.some((c) => c.id === "panel-reject-all")).toBe(true);
  expect(clickLog.some((c) => c.id === "panel-accept-all")).toBe(false);
  expect(clickLog.some((c) => c.id === "accept-btn")).toBe(false);
});

test("German 'Sicherer Ausgang' (Sourcepoint's own save/close term) is recognized as the save button", async ({
  page,
}) => {
  // Regression test for jsonformatter.org: with no in-panel reject-all
  // shortcut, the engine correctly toggled everything off but — before this
  // fix — never found a save button ("Sicherer Ausgang" wasn't in KW.save),
  // leaving the panel open. "Zurück" (Back) must not be mistaken for save.
  await installTestHooks(page);
  await page.goto(fixture("localized-safe-exit-save.html"));
  await injectEngine(page);

  const reports = await waitForReport(page);
  expect(reports[0].method).toBe("toggled-off+saved");

  const state = await page.evaluate(() => ({
    necessary: document.getElementById("necessary").checked,
    analytics: document.getElementById("analytics").checked,
    backClicked: !!window.__backClicked,
  }));
  expect(state).toEqual({ necessary: true, analytics: false, backClicked: false });

  const clickLog = await page.evaluate(() => window.__clickLog);
  expect(clickLog.some((c) => c.id === "safe-exit-btn")).toBe(true);
  expect(clickLog.some((c) => c.id === "accept-all-btn")).toBe(false);
});

test("known CMP rule (mock OneTrust) uses its direct selector-based reject button over generic matching", async ({
  page,
}) => {
  await installTestHooks(page);
  await page.goto(fixture("known-cmp-onetrust.html"));
  await injectEngine(page);

  const reports = await waitForReport(page);
  expect(reports[0]).toMatchObject({ cmp: "OneTrust", method: "reject-all" });

  const clickLog = await page.evaluate(() => window.__clickLog);
  expect(clickLog.map((c) => c.id)).toEqual(["onetrust-reject-all-handler"]);
});

test("page with no consent dialog: engine clicks nothing and stays quiet", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e));
  await installTestHooks(page);
  await page.goto(fixture("no-dialog.html"));
  await injectEngine(page);

  await page.waitForTimeout(1500); // give the debounced scan a chance to (not) fire

  const clickLog = await page.evaluate(() => window.__clickLog);
  const reports = await page.evaluate(() => window.__reports);
  expect(clickLog).toEqual([]);
  expect(reports).toEqual([]);
  expect(errors).toEqual([]);
});

test("rapid double injection never re-runs init() a second time", async ({ page }) => {
  // window.__cookieRejectLoaded exists specifically to stop a second
  // injection from calling init() again. init() is the only place that
  // assigns window.__cookieRejectRescan, so if that reference stays
  // identical (===) across repeated re-injection, init() provably never
  // ran a second time. (An earlier version of this test counted
  // MutationObserver constructions instead — that turned out to also
  // count Playwright's own internal page instrumentation, which sets up
  // its own MutationObserver for unrelated reasons, making it useless as
  // a signal here.)
  const errors = [];
  page.on("pageerror", (e) => errors.push(e));
  await installTestHooks(page);
  await page.goto(fixture("direct-reject.html"));

  await injectEngine(page);
  await waitForReport(page);
  const gotRescanFn = await page.evaluate(() => {
    window.__rescanRef1 = window.__cookieRejectRescan;
    return typeof window.__rescanRef1;
  });
  expect(gotRescanFn).toBe("function");

  await injectEngine(page);
  await injectEngine(page);
  await page.waitForTimeout(300);

  const sameReference = await page.evaluate(
    () => window.__cookieRejectRescan === window.__rescanRef1
  );
  expect(sameReference).toBe(true);
  expect(errors).toEqual([]);
});

test("re-injecting after the page was already handled deliberately triggers a fresh scan (what 'Reject now' relies on)", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e));
  await installTestHooks(page);
  await page.goto(fixture("direct-reject.html"));
  await injectEngine(page);
  await waitForReport(page);

  // window.__cookieRejectRescan is exactly what popup.js's "Reject now"
  // button triggers via re-injecting the content script (see popup.js).
  await injectEngine(page);
  await page.waitForFunction(() => window.__reports.length >= 2, null, { timeout: 5000 });

  const reports = await page.evaluate(() => window.__reports);
  expect(reports.length).toBe(2);
  expect(reports.every((r) => r.method === "reject-all")).toBe(true);
  expect(errors).toEqual([]);
});

test("chrome.storage.local.get throwing (invalidated extension context) is caught, not a crash", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e));
  await installTestHooks(page, { storageThrows: true });
  await page.goto(fixture("direct-reject.html"));
  await injectEngine(page);

  await page.waitForTimeout(1000);

  const clickLog = await page.evaluate(() => window.__clickLog);
  const reports = await page.evaluate(() => window.__reports);
  expect(clickLog).toEqual([]);
  expect(reports).toEqual([]);
  expect(errors).toEqual([]);
});
