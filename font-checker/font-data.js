/**
 * Email-client font support data.
 *
 * Two tables:
 *   FONTS    — keyed by lowercased font name, classifies the font as web-safe,
 *              webfont (requires @font-face), or system (OS-specific)
 *   CLIENTS  — major email clients with their @font-face support level
 *
 * Source: caniemail.com (CC BY 4.0, snapshot 2026-04). Web-safe list is the
 * MS/Apple universal-availability set. Updated occasionally; the matrix
 * doesn't move fast.
 */

export const CLIENTS = [
  // Desktop webmail
  { id: 'gmail-web',         name: 'Gmail Web',          family: 'Gmail',  fontFace: 'partial', note: 'Allows @font-face from same-origin only — usually breaks for hosted webfonts.' },
  { id: 'outlook-web',       name: 'Outlook on the web', family: 'Outlook', fontFace: 'yes',     note: 'Modern WebView — webfonts render.' },
  { id: 'yahoo-mail',        name: 'Yahoo Mail',         family: 'Yahoo',  fontFace: 'no',      note: 'Strips @font-face declarations.' },
  { id: 'aol-mail',          name: 'AOL Mail',           family: 'AOL',    fontFace: 'no',      note: 'Strips @font-face declarations.' },

  // Desktop Outlook (the hard ones)
  { id: 'outlook-2016',      name: 'Outlook 2016 (Win)', family: 'Outlook', fontFace: 'no',      note: 'Word rendering engine — strips @font-face. Falls back to platform fonts.' },
  { id: 'outlook-2019',      name: 'Outlook 2019 (Win)', family: 'Outlook', fontFace: 'no',      note: 'Same Word engine as 2016.' },
  { id: 'outlook-365-win',   name: 'Outlook 365 (Win)',  family: 'Outlook', fontFace: 'no',      note: 'Word engine variant — webfonts strip.' },
  { id: 'outlook-mac',       name: 'Outlook for Mac',    family: 'Outlook', fontFace: 'yes',     note: 'WebKit-based rendering — webfonts render.' },

  // Mobile webmail / native
  { id: 'gmail-android',     name: 'Gmail (Android)',    family: 'Gmail',  fontFace: 'no',      note: 'No @font-face — falls back to system fonts.' },
  { id: 'gmail-ios',         name: 'Gmail (iOS)',        family: 'Gmail',  fontFace: 'no',      note: 'No @font-face since 2020.' },
  { id: 'apple-mail-ios',    name: 'Apple Mail (iOS)',   family: 'Apple',  fontFace: 'yes',     note: 'Full @font-face support.' },
  { id: 'apple-mail-mac',    name: 'Apple Mail (macOS)', family: 'Apple',  fontFace: 'yes',     note: 'Full @font-face support.' },
  { id: 'outlook-android',   name: 'Outlook (Android)',  family: 'Outlook', fontFace: 'yes',     note: 'WebView-based — webfonts render.' },
  { id: 'outlook-ios',       name: 'Outlook (iOS)',      family: 'Outlook', fontFace: 'yes',     note: 'WebView-based — webfonts render.' },
  { id: 'samsung-mail',      name: 'Samsung Mail',       family: 'Samsung', fontFace: 'partial', note: 'Inconsistent @font-face support across versions.' },
];

// type: 'web-safe' | 'system' | 'webfont' | 'unknown'
// stack: recommended fallback CSS value
export const FONTS = {
  // Web-safe (universal: Arial, Helvetica, Verdana, Tahoma, Trebuchet, Times, Georgia, Courier)
  'arial':           { type: 'web-safe', stack: 'Arial, Helvetica, sans-serif' },
  'helvetica':       { type: 'web-safe', stack: 'Helvetica, Arial, sans-serif' },
  'verdana':         { type: 'web-safe', stack: 'Verdana, Geneva, sans-serif' },
  'tahoma':          { type: 'web-safe', stack: 'Tahoma, Geneva, sans-serif' },
  'trebuchet ms':    { type: 'web-safe', stack: '"Trebuchet MS", Helvetica, sans-serif' },
  'times new roman': { type: 'web-safe', stack: '"Times New Roman", Times, serif' },
  'times':           { type: 'web-safe', stack: 'Times, "Times New Roman", serif' },
  'georgia':         { type: 'web-safe', stack: 'Georgia, serif' },
  'courier new':     { type: 'web-safe', stack: '"Courier New", Courier, monospace' },
  'courier':         { type: 'web-safe', stack: 'Courier, "Courier New", monospace' },
  'palatino':        { type: 'web-safe', stack: '"Palatino Linotype", Palatino, serif' },
  'garamond':        { type: 'web-safe', stack: 'Garamond, Georgia, serif' },
  'arial black':     { type: 'web-safe', stack: '"Arial Black", Gadget, sans-serif' },
  'impact':          { type: 'web-safe', stack: 'Impact, Charcoal, sans-serif' },
  'comic sans ms':   { type: 'web-safe', stack: '"Comic Sans MS", cursive, sans-serif' },

  // System (rendered only on matching OS)
  'system-ui':       { type: 'system', stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  'segoe ui':        { type: 'system', os: 'windows', stack: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' },
  '-apple-system':   { type: 'system', os: 'apple',   stack: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'sf pro':          { type: 'system', os: 'apple',   stack: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif' },
  'sf pro display':  { type: 'system', os: 'apple',   stack: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif' },
  'helvetica neue':  { type: 'system', os: 'apple',   stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },

  // Popular Google / hosted webfonts (require @font-face)
  'roboto':          { type: 'webfont', stack: 'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'open sans':       { type: 'webfont', stack: '"Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'lato':            { type: 'webfont', stack: 'Lato, "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'montserrat':      { type: 'webfont', stack: 'Montserrat, "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'inter':           { type: 'webfont', stack: 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'poppins':         { type: 'webfont', stack: 'Poppins, "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'raleway':         { type: 'webfont', stack: 'Raleway, "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'oswald':          { type: 'webfont', stack: 'Oswald, "Arial Narrow", Arial, sans-serif' },
  'merriweather':    { type: 'webfont', stack: 'Merriweather, Georgia, serif' },
  'playfair display':{ type: 'webfont', stack: '"Playfair Display", Georgia, serif' },
  'source sans pro': { type: 'webfont', stack: '"Source Sans Pro", "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'source sans 3':   { type: 'webfont', stack: '"Source Sans 3", "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'work sans':       { type: 'webfont', stack: '"Work Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'nunito':          { type: 'webfont', stack: 'Nunito, "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'fira sans':       { type: 'webfont', stack: '"Fira Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'pt sans':         { type: 'webfont', stack: '"PT Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'pt serif':        { type: 'webfont', stack: '"PT Serif", Georgia, serif' },
  'noto sans':       { type: 'webfont', stack: '"Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'ubuntu':          { type: 'webfont', stack: 'Ubuntu, "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'rubik':           { type: 'webfont', stack: 'Rubik, "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'manrope':         { type: 'webfont', stack: 'Manrope, "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'space grotesk':   { type: 'webfont', stack: '"Space Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif' },
  'space mono':      { type: 'webfont', stack: '"Space Mono", "Courier New", monospace' },
  'jetbrains mono':  { type: 'webfont', stack: '"JetBrains Mono", "Courier New", monospace' },
  'fira code':       { type: 'webfont', stack: '"Fira Code", "Courier New", monospace' },
  'roboto mono':     { type: 'webfont', stack: '"Roboto Mono", "Courier New", monospace' },
};

/**
 * Resolve a font name to its data, with fuzzy match.
 * Returns null for empty input.
 */
export function lookupFont(input) {
  if (!input) return null;
  const key = input.toLowerCase().trim().replace(/^["']+|["']+$/g, '');
  if (FONTS[key]) return { name: input, ...FONTS[key], matched: 'exact' };
  // Try without spaces, with-spaces variants
  const noSpaces = key.replace(/\s+/g, '');
  for (const [k, v] of Object.entries(FONTS)) {
    if (k.replace(/\s+/g, '') === noSpaces) return { name: input, ...v, matched: 'fuzzy' };
  }
  // Unknown — assume webfont
  return {
    name: input,
    type: 'unknown',
    stack: `"${input}", "Helvetica Neue", Helvetica, Arial, sans-serif`,
    matched: 'unknown',
  };
}
