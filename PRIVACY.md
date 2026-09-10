# Privacy Policy for Reject All Cookies

*Last updated: September 10, 2026*

## Summary

Reject All Cookies is a browser extension that automatically detects and
dismisses cookie-consent pop-ups on webpages you visit, including switching
off "legitimate interest" toggles that many sites leave on by default. This
extension does not collect, store, or transmit any personal data.

## What data this extension accesses

The extension's content script reads the DOM of the currently open webpage
to locate and interact with cookie-consent dialogs (buttons, toggles, and
settings panels). It does not read, copy, or transmit the content of the
page beyond what's needed to identify and click consent-related elements.

## What data this extension stores

The extension uses Chrome's local storage APIs (`chrome.storage.local` and
`chrome.storage.session`) to remember:
- Whether the extension is enabled or disabled
- A list of sites you've chosen to disable it on
- A count of how many consent dialogs it has handled, shown in the toolbar
  popup

All of this stays on your device. It is never uploaded to a server, shared
with any third party, or used for tracking or analytics.

## What data this extension transmits

None. This extension makes no network requests of its own and includes no
analytics, telemetry, or third-party SDKs.

## Permissions

- `storage`: to remember your on/off preference and per-site settings,
  locally.
- `activeTab` / `scripting`: so the toolbar popup's "Reject now" button can
  re-run detection on the page you're viewing.
- Host permissions (`<all_urls>`) and content scripts: required so the
  extension can detect and interact with cookie-consent dialogs on any site
  you visit. This access is used only to read and interact with
  consent-dialog elements on the current page — never to read unrelated
  page content, collect browsing history, or transmit anything off your
  device.

## Changes to this policy

Changes will be reflected in this document (version-controlled in the
project's GitHub repository), with the "Last updated" date revised.

## Contact

Questions or concerns: open an issue at
https://github.com/Abhi-Sutar/cookie-reject/issues
