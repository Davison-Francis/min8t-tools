/**
 * Curated list of email subject-line spam triggers.
 * Distilled from mailmeteor/spam-words and SpamAssassin's URI/SUBJECT rule
 * set, then trimmed to the ~150 highest-impact entries you actually see in
 * marketing emails. Bigger lists drive false positives without improving
 * the user-facing signal.
 */
export const SPAM_TRIGGERS = [
  // Money / financial
  "free", "$$$", "money back", "make money", "earn extra cash", "earn $",
  "double your", "income", "pure profit", "cash bonus", "extra cash",
  "credit", "credit card", "no credit check", "loan", "refinance", "mortgage",
  "low rates", "lowest price", "best price", "best rates", "cheap", "discount",
  "save big", "save up to", "save $", "save 50", "save 100",

  // Urgency
  "urgent", "act now", "act fast", "don't delete", "don't hesitate", "limited time",
  "limited offer", "expires", "exp ires today", "now only", "while supplies last",
  "while stocks last", "last chance", "final notice", "this won't last", "today only",

  // Offers & guarantees
  "100% free", "100% satisfied", "guaranteed", "guarantee", "no obligation",
  "no risk", "no purchase necessary", "no strings attached", "no fees",
  "risk free", "satisfaction guaranteed", "money back guarantee",
  "no catch", "no investment", "no questions asked",

  // Hype
  "amazing", "incredible deal", "incredible offer", "miracle", "once in a lifetime",
  "miraculous", "you have been selected", "you are a winner", "winner",
  "congratulations", "selected", "you have won", "claim your", "claim now",

  // Buying & selling
  "buy now", "buy direct", "shop now", "click here", "click below", "click to",
  "click to remove", "subscribe", "subscribe now", "order now", "order today",

  // Health & dating spam
  "viagra", "cialis", "pharmacy", "weight loss", "lose weight", "diet",
  "fat burning", "anti-aging", "wrinkle", "hair loss", "online pharmacy",
  "meet singles", "lonely", "naked", "xxx", "porn",

  // Get-rich-quick
  "be your own boss", "work from home", "work at home", "extra income",
  "passive income", "easy money", "double your income", "investment opportunity",
  "millions", "millionaire", "earn millions",

  // Trust manipulation
  "this isn't spam", "not spam", "not junk", "as seen on tv", "as seen on",
  "all natural", "lifetime", "trusted",

  // Punctuation patterns (caught separately by the analyzer; listed here for completeness)
  "!!!", "???", "$$$",
];
