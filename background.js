// Service worker: tracks per-tab results for the popup and keeps a small
// running total in storage. No network access, nothing leaves the browser.
"use strict";

const BADGE_COLOR = "#16a34a";

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
