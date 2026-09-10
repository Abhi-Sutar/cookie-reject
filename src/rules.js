// Selector-based rules for well-known consent management platforms (CMPs).
// Tried in order before the generic text-matching fallback in engine.js.
//
// Each rule:
//   name           - label used in status/logging
//   detect         - selector that confirms this CMP's banner is present
//   rejectAll      - selectors tried, in order, for a direct one-click "reject
//                    everything" action (covers cases where the CMP's own
//                    reject-all already clears legitimate-interest opt-outs)
//   openSettings   - selectors that open a preferences/settings panel, used
//                    only when no rejectAll button was found or worked
//   panelContainer - selector scoping toggle-off + save-button search once a
//                    settings panel is open (falls back to whole document)
"use strict";

window.__CR_RULES = [
  {
    name: "OneTrust",
    detect: "#onetrust-banner-sdk, #onetrust-consent-sdk, #onetrust-pc-sdk",
    rejectAll: [
      "#onetrust-reject-all-handler",
      ".ot-pc-refuse-all-handler",
      "button.ot-pc-refuse-all-handler",
    ],
    openSettings: ["#onetrust-pc-btn-handler", ".ot-sdk-show-settings"],
    panelContainer: "#onetrust-pc-sdk, .otPcPanel",
    save: [".save-preference-btn-handler.onetrust-close-btn-handler"],
  },
  {
    name: "Cookiebot",
    detect: "#CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay",
    rejectAll: [
      "#CybotCookiebotDialogBodyButtonDecline",
      "#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll",
      "#CybotCookiebotDialogBodyButtonDeclineAll",
    ],
    openSettings: [
      "#CybotCookiebotDialogBodyLevelButtonCustomize",
      "#CybotCookiebotDialogBodyLevelButtonLevelOptinCustomize",
    ],
    panelContainer: "#CybotCookiebotDialogBodyLevelWrapper, #CybotCookiebotDialogBody",
  },
  {
    name: "Didomi",
    detect: "#didomi-host, .didomi-popup-container, #didomi-notice",
    rejectAll: [
      "#didomi-notice-disagree-button",
      ".didomi-continue-without-agreeing",
      'button[aria-label="Disagree"]',
      'button[aria-label*="Disagree"]',
    ],
    openSettings: ["#didomi-notice-learn-more-button", ".didomi-notice-learn-more-button"],
    panelContainer: "#didomi-popup, .didomi-consent-popup-body",
  },
  {
    name: "Quantcast Choice",
    detect: ".qc-cmp2-container, #qc-cmp2-container",
    rejectAll: [
      '.qc-cmp2-summary-buttons button[mode="reject"]',
      '.qc-cmp2-buttons-desktop button[mode="reject"]',
    ],
    openSettings: ['.qc-cmp2-summary-buttons button[mode="secondary"]'],
    panelContainer: ".qc-cmp2-container",
  },
  {
    name: "TrustArc",
    detect: "#truste-consent-track, #trustarc-banner-overlay, #consent-modal",
    rejectAll: [
      "#truste-consent-required",
      ".trustarc-agree-reject",
      "#consent_prompt_reject",
    ],
    openSettings: ["#truste-show-consent", ".truste-manage-preference"],
    panelContainer: "#truste-consent-content, #consent-modal",
  },
  {
    name: "Usercentrics",
    detect: "#usercentrics-root, uc-app-container, #uc-central-modal",
    rejectAll: [
      'button[data-testid="uc-deny-all-button"]',
      "#uc-btn-deny-banner",
      ".uc-deny-button",
    ],
    openSettings: [
      'button[data-testid="uc-more-info-button"]',
      "#uc-btn-more-info",
    ],
    panelContainer: "#uc-central-modal, #usercentrics-root",
  },
  {
    name: "Osano",
    detect: ".osano-cm-window, .osano-cm-dialog",
    rejectAll: [".osano-cm-denyAll", ".osano-cm-button--type_denyAll"],
    openSettings: [".osano-cm-manage"],
    panelContainer: ".osano-cm-drawer, .osano-cm-dialog",
  },
  {
    name: "Sourcepoint",
    detect: "#sp_message_container, .message-container, [class*='sp_choice_type']",
    rejectAll: [
      ".sp_choice_type_REJECT_ALL",
      'button[title="Reject All"]',
      'button[aria-label="Reject All"]',
    ],
    openSettings: [".sp_choice_type_12", 'button[title="Options"]'],
    panelContainer: "#sp_message_container",
  },
  {
    name: "CookieYes",
    detect: "#cookieyes-consent, .cky-consent-container, .cky-consent-bar",
    rejectAll: [".cky-btn-reject"],
    openSettings: [".cky-btn-customize"],
    panelContainer: ".cky-preference-center",
  },
  {
    name: "Complianz",
    detect: ".cmplz-cookiebanner, #cmplz-cookiebanner-container, .cc-cp-container",
    rejectAll: [".cmplz-deny", ".cmplz-btn.cmplz-deny", ".cc-deny"],
    openSettings: [".cmplz-manage-options", ".cmplz-btn.cmplz-manage-consent"],
    panelContainer: ".cmplz-manage-consent-container",
  },
  {
    name: "Iubenda",
    detect: "#iubenda-cs-banner, .iubenda-cs-container",
    rejectAll: [".iubenda-cs-reject-btn", ".iub-cs-reject-btn"],
    openSettings: [".iubenda-cs-customize-btn"],
    panelContainer: "#iubenda-cs-container",
  },
  {
    name: "Klaro",
    detect: ".klaro, #klaro",
    rejectAll: [".cm-btn-decline", ".cn-decline", "button.cm-btn.cm-btn-decline"],
    openSettings: [".cn-manage", ".cm-btn-manage"],
    panelContainer: ".cm-modal, .cookie-modal",
  },
  {
    name: "Borlabs Cookie",
    detect: "#BorlabsCookieBox, ._brlbs-box-wrap",
    rejectAll: ["._brlbs-btn-refuse-cookie", ".brlbs-btn-refuse"],
    openSettings: ["._brlbs-btn-individual", ".brlbs-btn-individual"],
    panelContainer: "#BorlabsCookieBox",
  },
  {
    name: "Axeptio",
    detect: "#axeptio_overlay, .axeptio_widget",
    rejectAll: [
      "#axeptio_btn_dismiss",
      "#axeptio_btn_declineAll",
      'button[data-test="declineAll"]',
    ],
    openSettings: ["#axeptio_btn_configure"],
    panelContainer: "#axeptio_overlay",
  },
  {
    name: "Civic Cookie Control",
    detect: "#ccc, #ccc-module, .ccc-module",
    rejectAll: ["#ccc-reject-settings", "#ccc-dismiss-button", ".ccc-notify-reject"],
    openSettings: ["#ccc-settings-button", "#ccc-open"],
    panelContainer: "#ccc-module",
  },
  {
    name: "Google Funding Choices",
    detect: ".fc-consent-root, .fc-dialog-container",
    rejectAll: [".fc-button.fc-cta-do-not-consent"],
    openSettings: [".fc-cta-manage-options", "button.fc-cta-manage-options"],
    panelContainer: ".fc-dialog-container",
  },
];
