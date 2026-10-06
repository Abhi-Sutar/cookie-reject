"use strict";

const globalToggle = document.getElementById("global-toggle");
const siteToggle = document.getElementById("site-toggle");
const siteLabel = document.getElementById("site-label");
const statusBox = document.getElementById("status-box");
const statusText = document.getElementById("status-text");
const rejectNowBtn = document.getElementById("reject-now");
const totalCountEl = document.getElementById("total-count");
const debugToggle = document.getElementById("debug-toggle");
const debugStatus = document.getElementById("debug-status");
const debugClearBtn = document.getElementById("debug-clear");

const DEBUG_LOG_KEY = "__debugToggleLog";

let activeTab = null;
let hostname = null;

function methodLabel(method) {
  switch (method) {
    case "reject-all":
      return "clicked its reject-all button";
    case "settings-reject-all":
      return "opened settings and found a reject-all option";
    case "toggled-off+saved":
      return "switched off every toggle (incl. legitimate interest) and saved";
    case "toggled-off":
      return "switched off every toggle (incl. legitimate interest)";
    case "saved":
      return "saved your preferences";
    default:
      return "handled it";
  }
}

function renderStatus(record, disabledHere, enabledGlobally) {
  if (!enabledGlobally) {
    statusBox.classList.remove("handled");
    statusText.textContent = "Auto-reject is turned off globally.";
    return;
  }
  if (disabledHere) {
    statusBox.classList.remove("handled");
    statusText.textContent = `Auto-reject is disabled on ${hostname}.`;
    return;
  }
  if (record) {
    statusBox.classList.add("handled");
    statusText.textContent = `${record.cmp}: ${methodLabel(record.method)}.`;
    return;
  }
  statusBox.classList.remove("handled");
  statusText.textContent = "No consent dialog detected on this page yet.";
}

async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;
  hostname = "";
  try {
    hostname = tab && tab.url ? new URL(tab.url).hostname : "";
  } catch (e) {
    hostname = "";
  }

  const { record, settings } = await chrome.runtime.sendMessage({
    type: "cookie-reject:get-status",
    tabId: tab ? tab.id : -1,
  });

  globalToggle.checked = settings.enabled;
  totalCountEl.textContent = settings.totalHandled;

  const disabledHere = hostname && settings.disabledSites.includes(hostname);
  siteToggle.checked = !!disabledHere;
  siteLabel.textContent = hostname ? `Disabled on ${hostname}` : "Disabled on this site";
  siteToggle.disabled = !hostname;

  renderStatus(record, disabledHere, settings.enabled);
  rejectNowBtn.disabled = !settings.enabled || disabledHere || !tab || !/^https?:/.test(tab.url || "");
}

globalToggle.addEventListener("change", async () => {
  await chrome.storage.local.set({ enabled: globalToggle.checked });
  refresh();
});

siteToggle.addEventListener("change", async () => {
  if (!hostname) return;
  const { disabledSites = [] } = await chrome.storage.local.get("disabledSites");
  const next = siteToggle.checked
    ? Array.from(new Set([...disabledSites, hostname]))
    : disabledSites.filter((h) => h !== hostname);
  await chrome.storage.local.set({ disabledSites: next });
  refresh();
});

rejectNowBtn.addEventListener("click", async () => {
  if (!activeTab) return;
  rejectNowBtn.disabled = true;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: true },
      files: ["src/keywords.js", "src/rules.js", "src/engine.js"],
    });
  } catch (e) {
    // page may not allow injection (chrome:// pages, web store, etc.)
  }
  setTimeout(refresh, 800);
});

// ---------- debug section (local testing only, see engine.js/background.js) ----------

async function refreshDebugSection() {
  const [{ debugToggleLog = false }, { [DEBUG_LOG_KEY]: rows = [] }, hasDownloads] =
    await Promise.all([
      chrome.storage.local.get({ debugToggleLog: false }),
      chrome.storage.local.get({ [DEBUG_LOG_KEY]: [] }),
      chrome.permissions.contains({ permissions: ["downloads"] }),
    ]);

  debugToggle.checked = debugToggleLog;
  debugClearBtn.hidden = rows.length === 0;

  if (!debugToggleLog) {
    debugStatus.textContent = "Off — no toggle data is recorded.";
  } else if (!hasDownloads) {
    debugStatus.textContent = `On, ${rows.length} row(s) buffered. Downloads permission not granted, so nothing is written to disk yet.`;
  } else {
    debugStatus.textContent = `On, ${rows.length} row(s) logged. Writing to "cookie-reject-toggle-log.csv" in your configured download location (chrome://settings/downloads — point it at this repo's folder to keep the file there).`;
  }
}

debugToggle.addEventListener("change", async () => {
  const enabling = debugToggle.checked;
  if (enabling) {
    // Must be called directly from this user-gesture handler, before any
    // other awaits, or Chrome may reject it as not gesture-initiated.
    let granted = false;
    try {
      granted = await chrome.permissions.request({ permissions: ["downloads"] });
    } catch (e) {
      granted = false;
    }
    if (!granted) {
      // Still enable logging to chrome.storage.local — just no CSV file
      // until the permission is granted (can retry by re-checking the box).
    }
  } else {
    try {
      await chrome.permissions.remove({ permissions: ["downloads"] });
    } catch (e) {
      /* ignore */
    }
  }
  await chrome.storage.local.set({ debugToggleLog: enabling });
  refreshDebugSection();
});

debugClearBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({ [DEBUG_LOG_KEY]: [] });
  debugStatus.textContent += " (Log cleared — delete the old CSV file yourself if you want a clean slate; the extension can't delete files it downloaded.)";
  refreshDebugSection();
});

refresh();
refreshDebugSection();
