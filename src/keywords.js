// Shared text/selector vocabulary used by the generic (non-CMP-specific) matcher.
// Kept as plain data so it's easy to extend without touching engine logic.
"use strict";

window.__CR_KEYWORDS = {
  // Phrases that identify a one-click "reject everything" action.
  // Longer/more specific phrases first so context checks stay cheap.
  reject: [
    "reject all", "decline all", "deny all", "refuse all",
    "reject non-essential", "reject unnecessary", "reject optional",
    "necessary only", "only necessary", "essential only", "only essential",
    "use necessary cookies only", "continue without accepting",
    "i do not accept", "do not accept", "disagree and close", "disagree",
    "refuse cookies", "reject cookies", "decline cookies",
    "reject", "decline", "refuse",
    // German
    "alle ablehnen", "alles ablehnen", "nur notwendige", "nur erforderliche", "ablehnen",
    // French
    "tout refuser", "refuser tout", "continuer sans accepter", "refuser",
    // Spanish
    "rechazar todo", "rechazar todas", "solo necesarias", "rechazar",
    // Italian
    "rifiuta tutto", "rifiuta tutti", "solo necessari", "rifiuta",
    // Dutch
    "alles weigeren", "weigeren",
    // Portuguese
    "rejeitar tudo", "recusar tudo", "recusar todos", "rejeitar",
    // Polish
    "odrzuć wszystkie", "odrzuć",
    // Swedish/Norwegian/Danish
    "avvis alle", "avslå alle", "afvis alle",
  ],

  // Phrases that mean "accept everything" — never click these, and use the
  // list to disambiguate buttons whose visible text is ambiguous.
  accept: [
    "accept all", "allow all", "agree", "i accept", "i agree",
    "alle akzeptieren", "akzeptiere alle", "tout accepter", "aceptar todo", "accetta tutto",
    "alles accepteren", "aceitar tudo", "zaakceptuj wszystkie",
  ],

  // If matched text also contains one of these, skip it — avoids acting on
  // links like "read our cookie policy" or "manage reject preferences".
  excludeIfContains: [
    "policy", "settings", "preferences", "learn more", "more information",
    "cookie policy", "privacy policy", "manage",
  ],

  // Buttons/links that open a preferences panel rather than rejecting directly.
  openSettings: [
    "manage cookies", "cookie settings", "manage preferences",
    "manage options", "more options", "customi", "preferences",
    "settings", "options", "show purposes", "let me choose",
    "einstellungen", "anpassen", "auswahl", "paramètres", "personnaliser",
    "configurar", "personalizar", "preferenze", "personalizza",
    "voorkeuren", "aanpassen", "instellingen", "configurações",
    "personalizar", "ustawienia",
  ],

  // Buttons that save/confirm choices made inside an open settings panel.
  save: [
    "save settings", "save preferences", "save & exit", "save and exit",
    "save choices", "confirm choices", "confirm my choices", "confirm",
    "apply", "submit preferences", "save", "done", "close", "safe exit",
    "bestätigen", "speichern", "auswahl bestätigen", "sicherer ausgang",
    "confirmer", "enregistrer", "valider",
    "confirmar", "guardar", "conferma", "salva", "opslaan", "bevestigen",
    "zapisz",
  ],

  // Phrases that only ever appear on informational/expand controls (a
  // per-item "View details" link, a tooltip trigger), never on a genuine
  // action button — excluded from every search category, unlike
  // excludeIfContains below. Needed because real IAB TCF purpose names can
  // legitimately contain words like "save" (e.g. "Save and communicate
  // privacy choices"), so a per-purpose "View details, Save and..." link's
  // accessible name can otherwise false-match the save-button search.
  decoy: [
    "view details", "more info", "more information", "learn more",
    "how does", "how this works", "what is this", "tooltip",
    "en savoir plus", "mehr erfahren", "más información", "meer informatie",
  ],

  // Skip toggles whose nearby label text marks them as always-on/required —
  // these can't legally be switched off and clicking them is a no-op or error.
  necessary: [
    "necessary", "essential", "required", "strictly necessary",
    "always active", "always on", "cannot be switched off",
    "notwendig", "erforderlich", "nécessaire", "essentiel",
    "necesario", "necessarie", "noodzakelijk", "necessário", "niezbędne",
  ],
};
