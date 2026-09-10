// Core content-script engine: detects consent dialogs and rejects everything,
// including legitimate-interest toggles that only appear inside a settings
// panel rather than on a top-level "reject all" button.
"use strict";

(function () {
  if (window.__cookieRejectLoaded) {
    if (window.__cookieRejectRescan) window.__cookieRejectRescan();
    return;
  }
  window.__cookieRejectLoaded = true;

  const KW = window.__CR_KEYWORDS;
  const RULES = window.__CR_RULES;

  let handledThisPage = false;
  let observer = null;
  let stopTimer = null;

  // ---------- small utils ----------

  function debounce(fn, wait) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), wait);
    };
  }

  function normalizeText(s) {
    return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    return true;
  }

  function isDisabled(el) {
    return !!(
      el.disabled ||
      el.getAttribute("aria-disabled") === "true" ||
      el.classList.contains("disabled")
    );
  }

  function matchesAny(text, list) {
    for (const phrase of list) {
      if (text.includes(phrase)) return phrase;
    }
    return null;
  }

  // Open shadow roots found under `document`, cached for the duration of a
  // single scan() call so repeated selector checks (17 CMP rules, generic
  // fallback, panel scans) don't each re-walk the whole page from scratch.
  let shadowRootsCache = null;
  function invalidateShadowCache() {
    shadowRootsCache = null;
  }
  function getDocumentShadowRoots() {
    if (shadowRootsCache) return shadowRootsCache;
    const roots = [];
    for (const el of document.querySelectorAll("*")) {
      if (el.shadowRoot) {
        roots.push(el.shadowRoot);
        for (const inner of el.shadowRoot.querySelectorAll("*")) {
          if (inner.shadowRoot) roots.push(inner.shadowRoot);
        }
      }
    }
    shadowRootsCache = roots;
    return roots;
  }

  // Collect elements matching `selector`, piercing open shadow roots.
  // When `root` is an explicit sub-tree (e.g. a settings panel container)
  // it's walked directly since that subtree is small; the document-wide
  // case uses the per-scan shadow root cache above.
  function deepQueryAll(selector, root) {
    if (root && root !== document) {
      const out = Array.from(root.querySelectorAll(selector));
      for (const el of root.querySelectorAll("*")) {
        if (el.shadowRoot) out.push(...el.shadowRoot.querySelectorAll(selector));
      }
      return out;
    }
    const out = Array.from(document.querySelectorAll(selector));
    for (const sr of getDocumentShadowRoots()) {
      out.push(...sr.querySelectorAll(selector));
    }
    return out;
  }

  function deepQuery(selector, root) {
    const all = deepQueryAll(selector, root);
    return all.length ? all[0] : null;
  }

  function elementText(el) {
    return normalizeText(
      el.getAttribute("aria-label") || el.innerText || el.textContent || el.value || ""
    );
  }

  function fireClick(el) {
    try {
      el.scrollIntoView({ block: "center", inline: "center" });
    } catch (e) {
      /* ignore */
    }
    el.click();
  }

  function pageLooksCookieRelated(root) {
    const text = normalizeText((root.body && root.body.innerText) || "").slice(0, 20000);
    return /cookie|consent|datenschutz|confidentialit|privacidad|privacy|gdpr|dsgvo/.test(text);
  }

  function ancestorLooksLikeConsentContext(el, maxDepth) {
    let node = el;
    let depth = 0;
    while (node && depth < (maxDepth || 6)) {
      const id = (node.id || "").toLowerCase();
      const cls = typeof node.className === "string" ? node.className.toLowerCase() : "";
      const role = (node.getAttribute && node.getAttribute("role")) || "";
      if (/cookie|consent|gdpr|privacy|cmp|didomi|onetrust|trustarc|osano/.test(id + " " + cls)) {
        return true;
      }
      if (role === "dialog" || role === "alertdialog") return true;
      node = node.parentElement;
      depth++;
    }
    return false;
  }

  // ---------- clicking helpers ----------

  function clickFirstMatch(selectors, root) {
    root = root || document;
    for (const sel of selectors) {
      const candidates = deepQueryAll(sel, root);
      for (const el of candidates) {
        if (isVisible(el) && !isDisabled(el)) {
          fireClick(el);
          return el;
        }
      }
    }
    return null;
  }

  function findButtonsAndLinks(root) {
    return deepQueryAll(
      'button, a[role="button"], input[type="button"], input[type="submit"], [role="button"], [role="menuitem"]',
      root
    );
  }

  // Generic text-based search for a control within `root` whose visible text
  // matches `keywordList`. `requireContext` guards against clicking unrelated
  // buttons when scanning the whole document; not needed once root is
  // already a confirmed dialog/panel.
  //
  // `excludeIfContains` (things like "settings"/"preferences"/"manage") only
  // makes sense when hunting for a *reject* button — it exists to skip decoy
  // links like "manage reject preferences" that don't actually reject
  // anything. Those same words are the actual target vocabulary for
  // openSettings/save searches, so the filter must not apply there.
  function genericFind(root, keywordList, requireContext) {
    const isRejectSearch = keywordList === KW.reject;
    const candidates = findButtonsAndLinks(root);
    for (const el of candidates) {
      if (!isVisible(el) || isDisabled(el)) continue;
      const text = elementText(el);
      if (!text || text.length > 60) continue;
      if (matchesAny(text, KW.accept)) continue;
      if (matchesAny(text, KW.decoy)) continue;
      if (!matchesAny(text, keywordList)) continue;
      if (isRejectSearch && matchesAny(text, KW.excludeIfContains)) continue;
      if (requireContext && !ancestorLooksLikeConsentContext(el)) continue;
      return el;
    }
    return null;
  }

  function waitFor(predicate, timeoutMs, intervalMs) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const result = predicate();
        if (result || Date.now() - start > timeoutMs) {
          resolve(result || null);
          return;
        }
        setTimeout(tick, intervalMs);
      };
      tick();
    });
  }

  // ---------- toggle-off logic (handles legitimate-interest switches) ----------

  function toggleIsOn(el) {
    if (el.tagName === "INPUT" && el.type === "checkbox") return el.checked;
    const ariaChecked = el.getAttribute("aria-checked");
    if (ariaChecked != null) return ariaChecked === "true";
    return false;
  }

  // Some CMPs (Google Funding Choices among them) render a custom slider via
  // a <label> and visually hide the real <input> that actually carries the
  // state — zero size, opacity 0, etc. isVisible() alone would skip these
  // forever even though clicking them (or their label) works perfectly
  // fine. Treat a toggle as reachable if it's directly visible, or if the
  // <label> that controls it is.
  function toggleIsReachable(el) {
    if (isVisible(el)) return true;
    const associatedLabel =
      (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest("label");
    return !!(associatedLabel && isVisible(associatedLabel));
  }

  function nearbyText(el) {
    let node = el;
    for (let i = 0; i < 4 && node; i++) {
      const t = elementText(node);
      if (t) return t;
      node = node.parentElement;
    }
    return "";
  }

  function turnOffToggle(el) {
    // A native click toggles checkboxes/switches and fires input/change in
    // the order frameworks (React included) expect. Setting `.checked`
    // directly and then dispatching a click would flip it back on, since
    // the browser's default click action toggles from the current state.
    fireClick(el);
  }

  // Switches off every enabled, non-"necessary" toggle inside `root`. This is
  // what covers CMPs that pre-opt users into "legitimate interest" purposes
  // with no top-level reject-all button — those are just additional switches
  // in the settings panel, same as any other purpose toggle.
  function toggleAllOffInPanel(root) {
    const toggles = deepQueryAll('input[type="checkbox"], [role="switch"]', root);
    let toggledCount = 0;
    for (const el of toggles) {
      if (isDisabled(el) || !toggleIsReachable(el)) continue;
      if (!toggleIsOn(el)) continue;
      const label = nearbyText(el);
      if (matchesAny(label, KW.necessary)) continue;
      turnOffToggle(el);
      toggledCount++;
    }
    return toggledCount;
  }

  // ---------- per-CMP rule execution ----------

  async function trySettingsPanelFlow(rule, root) {
    const openBtn = rule.openSettings
      ? clickFirstMatch(rule.openSettings, root)
      : genericFind(root, KW.openSettings, false);
    if (!openBtn) return null;

    // Panel content often renders/animates in asynchronously. New shadow
    // roots can attach during that animation, so keep the cache fresh.
    await waitFor(() => {
      invalidateShadowCache();
      const panelRoot = rule.panelContainer ? deepQuery(rule.panelContainer, document) : document;
      if (!panelRoot) return false;
      return (
        deepQueryAll('input[type="checkbox"], [role="switch"]', panelRoot).length > 0 ||
        clickableRejectPresent(rule, panelRoot)
      );
    }, 2000, 150);

    invalidateShadowCache();
    const panelRoot = rule.panelContainer
      ? deepQuery(rule.panelContainer, document) || document
      : document;

    // The panel may reveal its own direct reject-all button once opened.
    // clickFirstMatch already clicks; genericFind only finds, so its match
    // needs an explicit click too.
    let rejectInPanel = null;
    if (rule.rejectAll) {
      rejectInPanel = clickFirstMatch(rule.rejectAll, panelRoot);
    }
    if (!rejectInPanel) {
      rejectInPanel = genericFind(panelRoot, KW.reject, false);
      if (rejectInPanel) fireClick(rejectInPanel);
    }
    if (rejectInPanel) {
      return { method: "settings-reject-all" };
    }

    const toggledCount = toggleAllOffInPanel(panelRoot);

    let saveBtn = rule.save ? clickFirstMatch(rule.save, panelRoot) : null;
    if (!saveBtn) {
      saveBtn = genericFind(panelRoot, KW.save, false);
      if (saveBtn) fireClick(saveBtn);
    }
    if (saveBtn) {
      return { method: toggledCount ? "toggled-off+saved" : "saved" };
    }
    if (toggledCount) {
      // Toggled things off but found no explicit save button; best effort.
      return { method: "toggled-off" };
    }
    return null;
  }

  function clickableRejectPresent(rule, root) {
    if (rule.rejectAll) {
      for (const sel of rule.rejectAll) {
        const el = deepQuery(sel, root);
        if (el && isVisible(el)) return true;
      }
    }
    return !!genericFind(root, KW.reject, false);
  }

  async function tryKnownRules() {
    for (const rule of RULES) {
      const present = deepQuery(rule.detect, document);
      if (!present) continue;

      const directBtn = clickFirstMatch(rule.rejectAll, document);
      if (directBtn) {
        return { cmp: rule.name, method: "reject-all" };
      }

      const result = await trySettingsPanelFlow(rule, document);
      if (result) {
        return { cmp: rule.name, method: result.method };
      }
    }
    return null;
  }

  // ---------- generic fallback (unknown CMPs) ----------

  async function tryGenericFlow() {
    if (!pageLooksCookieRelated(document)) return null;

    const directBtn = genericFind(document, KW.reject, true);
    if (directBtn) {
      fireClick(directBtn);
      return { cmp: "Generic", method: "reject-all" };
    }

    const openBtn = genericFind(document, KW.openSettings, true);
    if (!openBtn) return null;
    fireClick(openBtn);

    await waitFor(() => {
      invalidateShadowCache();
      return deepQueryAll('input[type="checkbox"], [role="switch"]', document).length > 0;
    }, 2000, 150);
    invalidateShadowCache();

    const rejectAfterOpen = genericFind(document, KW.reject, false);
    if (rejectAfterOpen) {
      fireClick(rejectAfterOpen);
      return { cmp: "Generic", method: "settings-reject-all" };
    }

    const toggledCount = toggleAllOffInPanel(document);
    const saveBtn = genericFind(document, KW.save, false);
    if (saveBtn) {
      fireClick(saveBtn);
      return { cmp: "Generic", method: toggledCount ? "toggled-off+saved" : "saved" };
    }
    if (toggledCount) {
      return { cmp: "Generic", method: "toggled-off" };
    }
    return null;
  }

  // ---------- orchestration ----------

  function report(result) {
    try {
      chrome.runtime.sendMessage({
        type: "cookie-reject:handled",
        cmp: result.cmp,
        method: result.method,
        host: location.hostname,
      });
    } catch (e) {
      /* extension context may be gone during navigation; ignore */
    }
  }

  let scanInFlight = false;

  async function scan() {
    if (handledThisPage || scanInFlight) return;
    scanInFlight = true;
    invalidateShadowCache();
    try {
      const result = (await tryKnownRules()) || (await tryGenericFlow());
      if (result) {
        handledThisPage = true;
        report(result);
        if (observer) observer.disconnect();
        if (stopTimer) clearTimeout(stopTimer);
      }
    } finally {
      scanInFlight = false;
    }
  }

  async function init() {
    let settings;
    try {
      settings = await chrome.storage.local.get({ enabled: true, disabledSites: [] });
    } catch (e) {
      return; // extension context not available (e.g. during reload)
    }
    if (!settings.enabled) return;
    if (settings.disabledSites.includes(location.hostname)) return;

    scan();

    const debouncedScan = debounce(scan, 400);
    observer = new MutationObserver(debouncedScan);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    stopTimer = setTimeout(() => {
      if (observer) observer.disconnect();
    }, 20000);

    window.__cookieRejectRescan = () => {
      handledThisPage = false;
      scan();
    };
  }

  init();
})();
