// Login input normalization.
//
// Mobile keyboards (Gboard, ColorOS/OPPO, Samsung) can inject invisible
// Unicode characters into typed text — zero-width space (U+200B), zero-width
// joiner (U+200C/D), left/right directional marks (U+200E/F), word joiner
// (U+2060), bidi isolates (U+2066-U+2069), bidi embeds (U+202A-U+202E), soft
// hyphen (U+00AD), and in RTL contexts LRM/RLM around latin substrings.
// A plain trim()/toLowerCase() does NOT see them, so the same visually-correct
// credentials fail bcrypt.compare/email lookup intermittently on mobile.

// Everything a normal email can never legitimately contain:
//   \s covers regular whitespace, NBSP, FEFF/BOM, line/paragraph separators
//   plus the explicit invisible formatting codepoints above.
const EMAIL_JUNK = /[\s\u200b\u200c\u200d\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\u00ad]/g;

// For passwords we must NOT strip internal ordinary spaces (they may be a
// real part of the password), so only remove invisible formatting codepoints
// and then trim() the edges.
const PASSWORD_INVISIBLE = /[\u200b\u200c\u200d\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\u00ad\ufeff]/g;

export function normalizeEmail(input) {
  return String(input || "").replace(EMAIL_JUNK, "").toLowerCase();
}

export function normalizePassword(input) {
  return String(input || "").replace(PASSWORD_INVISIBLE, "").trim();
}

// Debug helper: array of hex code points so invisible characters in a raw
// request value become visible in the logs (e.g. 200b = zero-width space).
export function hexCodes(input) {
  return Array.from(String(input || "")).map(c => c.codePointAt(0).toString(16));
}