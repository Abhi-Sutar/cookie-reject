// Service worker: tracks per-tab results for the popup and keeps a small
// running total in storage. No network access, nothing leaves the browser.
"use strict";

const BADGE_COLOR = "#16a34a";

// ---------- local-testing debug log (off by default, see popup) ----------

const DEBUG_LOG_KEY = "__debugToggleLog";
const DEBUG_LOG_MAX_ROWS = 5000;
const DEBUG_CSV_FILENAME = "cookie-reject-toggle-log.csv";
const DEBUG_CSV_COLUMNS = [
  "timestamp",
  "host",
  "cmp",
  "tag",
  "id",
  "classes",
  "label",
  "wasOn",
  "domDisabled",
  "reachable",
  "keywordMatch",
  "matchedKeyword",
  "finalAction",
];

async function appendDebugRows(newRows) {
  const { [DEBUG_LOG_KEY]: existing = [] } = await chrome.storage.local.get({
    [DEBUG_LOG_KEY]: [],
  });
  const combined = existing.concat(newRows).slice(-DEBUG_LOG_MAX_ROWS);
  await chrome.storage.local.set({ [DEBUG_LOG_KEY]: combined });
  return combined;
}

function rowsToCsv(rows) {
  const escape = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const lines = [DEBUG_CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(DEBUG_CSV_COLUMNS.map((col) => escape(row[col])).join(","));
  }
  return lines.join("\r\n");
}

// Writes/overwrites a real CSV file on disk, immune to any in-browser data
// clearing (downloaded files aren't "browsing data"). Only runs once the
// user has explicitly granted the optional "downloads" permission from the
// popup's debug section — never requested or used otherwise.
async function writeDebugCsvIfPermitted(allRows) {
  const granted = await chrome.permissions.contains({ permissions: ["downloads"] });
  if (!granted) return;
  const csv = rowsToCsv(allRows);
  const dataUrl = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  try {
    await chrome.downloads.download({
      url: dataUrl,
      filename: DEBUG_CSV_FILENAME,
      conflictAction: "overwrite",
      saveAs: false,
    });
  } catch (e) {
    /* e.g. permission revoked between the check and the call; ignore */
  }
}

async function setSessionRecord(tabId, record) {
  const key = `tab-${tabId}`;
  await chrome.storage.session.set({ [key]: record });
}

async function getSessionRecord(tabId) {
  const key = `tab-${tabId}`;
  const data = await chrome.storage.session.get(key);
  return data[key] || null;
}

async function clearSessionRecord(tabId) {
  const key = `tab-${tabId}`;
  await chrome.storage.session.remove(key);
  chrome.action.setBadgeText({ tabId, text: "" });
}

async function bumpTotal() {
  const { totalHandled = 0 } = await chrome.storage.local.get("totalHandled");
  await chrome.storage.local.set({ totalHandled: totalHandled + 1 });
  return totalHandled + 1;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "cookie-reject:handled" && sender.tab) {
    const tabId = sender.tab.id;
    const record = {
      cmp: message.cmp,
      method: message.method,
      host: message.host,
      handledAt: Date.now(),
    };
    setSessionRecord(tabId, record);
    chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
    chrome.action.setBadgeText({ tabId, text: "✓" });
    bumpTotal();
    return false;
  }

  if (message && message.type === "cookie-reject:debug-rows" && Array.isArray(message.rows)) {
    (async () => {
      const combined = await appendDebugRows(message.rows);
      await writeDebugCsvIfPermitted(combined);
    })();
    return false;
  }

  if (message && message.type === "cookie-reject:get-status") {
    (async () => {
      const tabId = message.tabId;
      const [record, settings] = await Promise.all([
        getSessionRecord(tabId),
        chrome.storage.local.get({ enabled: true, disabledSites: [], totalHandled: 0 }),
      ]);
      sendResponse({ record, settings });
    })();
    return true; // keep the message channel open for the async response
  }

  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    clearSessionRecord(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearSessionRecord(tabId);
});
