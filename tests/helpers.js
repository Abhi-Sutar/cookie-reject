// Shared setup for engine tests: stubs the chrome.* APIs the content script
// depends on, and instruments HTMLElement.prototype.click so tests can
// assert exactly what the engine clicked (and didn't click).
const path = require("path");
const fs = require("fs");

const SRC_DIR = path.join(__dirname, "..", "src");

// Installs the click logger + chrome.* stub before any page script runs.
// storageThrows simulates an invalidated extension context, per case 8.
async function installTestHooks(page, { storageThrows = false } = {}) {
  await page.addInitScript((opts) => {
    window.__clickLog = [];
    const origClick = HTMLElement.prototype.click;
    HTMLElement.prototype.click = function () {
      window.__clickLog.push({
        id: this.id || null,
        classes: this.className || "",
        text: (this.textContent || "").trim().slice(0, 60),
      });
      return origClick.call(this);
    };

    window.__reports = [];
    window.chrome = {
      storage: {
        local: {
          get: (defaults) => {
            if (opts.storageThrows) {
              return Promise.reject(new Error("simulated extension context invalidated"));
            }
            return Promise.resolve(Object.assign({}, defaults));
          },
        },
        session: { set: () => Promise.resolve() },
      },
      runtime: {
        sendMessage: (msg) => {
          window.__reports.push(msg);
          return Promise.resolve();
        },
      },
    };
  }, { storageThrows });
}

// Injects the real shipped content-script files, in the same order
// manifest.json loads them, so tests exercise the actual code that ships.
//
// Uses page.evaluate(source) rather than addScriptTag: addScriptTag (with
// either `path` or `content`) was observed to execute the script twice in
// this environment — its <script>-element "did it load" detection appears
// to race with inline-script execution and falls back to re-injecting.
// page.evaluate runs the source exactly once, directly in the page's main
// world, with no such ambiguity.
async function injectEngine(page) {
  const keywords = fs.readFileSync(path.join(SRC_DIR, "keywords.js"), "utf8");
  const rules = fs.readFileSync(path.join(SRC_DIR, "rules.js"), "utf8");
  const engine = fs.readFileSync(path.join(SRC_DIR, "engine.js"), "utf8");
  await page.evaluate(keywords);
  await page.evaluate(rules);
  await page.evaluate(engine);
}

module.exports = { installTestHooks, injectEngine, SRC_DIR };
