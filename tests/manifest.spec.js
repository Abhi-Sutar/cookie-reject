// Static sanity checks on manifest.json — no browser needed. Catches the
// kind of mistake that only surfaces as "extension fails to load" in
// chrome://extensions, which is worth failing fast on before submission.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function readManifest() {
  const raw = fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8");
  return JSON.parse(raw);
}

test("manifest.json is valid JSON", () => {
  expect(() => readManifest()).not.toThrow();
});

test("every file manifest.json references actually exists", () => {
  const manifest = readManifest();
  const referenced = [];

  for (const size of Object.values(manifest.icons || {})) referenced.push(size);
  for (const size of Object.values(manifest.action?.default_icon || {})) referenced.push(size);
  if (manifest.action?.default_popup) referenced.push(manifest.action.default_popup);
  if (manifest.background?.service_worker) referenced.push(manifest.background.service_worker);
  for (const entry of manifest.content_scripts || []) {
    for (const js of entry.js || []) referenced.push(js);
    for (const css of entry.css || []) referenced.push(css);
  }

  expect(referenced.length).toBeGreaterThan(0);
  for (const relPath of referenced) {
    const abs = path.join(ROOT, relPath);
    expect(fs.existsSync(abs), `missing file referenced by manifest.json: ${relPath}`).toBe(true);
  }
});

test("popup.html only references scripts that exist", () => {
  const html = fs.readFileSync(path.join(ROOT, "popup.html"), "utf8");
  const matches = [...html.matchAll(/<script\s+src="([^"]+)"/g)];
  expect(matches.length).toBeGreaterThan(0);
  for (const [, src] of matches) {
    expect(fs.existsSync(path.join(ROOT, src)), `missing script referenced by popup.html: ${src}`).toBe(
      true
    );
  }
});

test("manifest declares manifest_version 3", () => {
  const manifest = readManifest();
  expect(manifest.manifest_version).toBe(3);
});
