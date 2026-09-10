"use strict";

const globalToggle = document.getElementById("global-toggle");
const siteToggle = document.getElementById("site-toggle");
const siteLabel = document.getElementById("site-label");
const statusBox = document.getElementById("status-box");
const statusText = document.getElementById("status-text");
const rejectNowBtn = document.getElementById("reject-now");
const totalCountEl = document.getElementById("total-count");

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

refresh();
