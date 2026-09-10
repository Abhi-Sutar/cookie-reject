# Reject All Cookies

A Chrome extension that automatically dismisses cookie consent popups by
rejecting everything — including "legitimate interest" purposes that many
sites pre-opt you into and bury inside a settings panel instead of putting
on a one-click "Reject All" button.

## How it works

For each page (and each same-page iframe, since some consent UIs render in
one), the extension:

1. Checks a built-in list of ~17 known consent platforms (OneTrust, Cookiebot,
   Didomi, Quantcast Choice, TrustArc, Usercentrics, Osano, Sourcepoint,
   CookieYes, Complianz, Iubenda, Klaro, Borlabs, Axeptio, Civic Cookie
   Control, Google Funding Choices) and clicks that platform's direct
   "Reject All" button if one is showing.
2. If there's no direct reject button, it opens the site's
   "Manage preferences / Settings / Customize" panel instead.
3. Inside that panel it switches **every** enabled toggle off — consent
   toggles and legitimate-interest toggles alike — skipping only switches
   marked "necessary / essential / required" (which sites aren't allowed to
   let you turn off anyway), then clicks Save/Confirm.
4. If the site uses some other/unknown consent platform, a generic pass does
   the same three steps using multilingual text matching ("reject all",
   "tout refuser", "alle ablehnen", etc.) instead of platform-specific
   selectors.

It only acts inside what looks like an actual consent dialog (checked via
ARIA roles and nearby cookie/consent/gdpr wording), and only once per page
load, so it won't go clicking random buttons elsewhere on a page.

## Install (unpacked, for personal use)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder:
   `C:\Users\Abhijeet\ClassRoomPrograms\cookie-reject`
4. Pin the extension (puzzle-piece icon in the toolbar → pin) so you can see
   its status at a glance.

## Using it

- It runs automatically on every page — no action needed most of the time.
- Click the toolbar icon to see what happened on the current page (which
  platform was detected and how it was rejected), toggle it off globally,
  disable it just for the current site, or hit **Reject now** to re-run it
  manually (useful if a banner appeared after the page finished loading, or
  you navigated within a single-page app).
- A green ✓ badge on the icon means it successfully rejected something on
  that page.

## Known limitations

- **Closed shadow DOM**: a handful of sites render their consent widget
  inside a *closed* shadow root, which is intentionally inaccessible to any
  extension (including this one) by browser design. Rare in practice.
- **Custom/unbranded CMPs with no recognizable text or structure**: the
  generic fallback relies on button text and nearby "cookie/consent/gdpr"
  wording; a banner with neither (very unusual) may be missed.
- It targets browser-rendered consent dialogs, not server-side/cookie-based
  consent gates that block page content until you submit a choice via a
  full page reload — those still need a click, but the extension will make
  that one click reject everything rather than requiring you to hunt down
  every legitimate-interest toggle by hand.

## Privacy

Everything runs locally in the browser. No network requests are made by the
extension itself, no data leaves your machine, and the only thing stored
(via `chrome.storage`) is your on/off preference, your per-site disable
list, and a small counter of how many dialogs it has handled.
