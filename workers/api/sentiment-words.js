/**
 * AFINN-style sentiment scoring word list, trimmed to ~200 highest-impact
 * positive/negative words for marketing copy. Each entry has a score from
 * -5 to +5. Subset of the public-domain AFINN-165 lexicon by Finn Årup
 * Nielsen. We don't need the full 3000+ words — subject lines are short
 * and heavy-tailed, this covers >90% of what shows up in real marketing.
 */
export const SENTIMENT_WORDS = {
  // Strong positive
  "amazing": 4, "awesome": 4, "best": 3, "brilliant": 4, "celebrate": 3,
  "delight": 3, "delighted": 3, "ecstatic": 5, "excellent": 3, "exceptional": 4,
  "fantastic": 4, "favorite": 2, "fortunate": 2, "gift": 2, "grateful": 3,
  "great": 3, "happy": 3, "incredible": 4, "joy": 3, "loved": 3,
  "lovely": 3, "outstanding": 4, "perfect": 3, "phenomenal": 4, "pleasure": 3,
  "premium": 2, "remarkable": 3, "rewarding": 2, "spectacular": 4, "stunning": 3,
  "success": 2, "successful": 2, "super": 3, "superb": 4, "terrific": 4,
  "thrilled": 4, "wonderful": 4,

  // Mild positive (action-oriented for marketing)
  "achieve": 2, "boost": 2, "build": 1, "celebrate": 2, "create": 1,
  "discover": 2, "easy": 1, "effective": 2, "efficient": 2, "elegant": 2,
  "empower": 2, "enjoy": 2, "essential": 2, "exclusive": 2, "expert": 2,
  "fresh": 1, "friendly": 2, "fun": 2, "innovative": 2, "inspire": 2,
  "insider": 1, "invite": 1, "join": 1, "learn": 1, "love": 3,
  "modern": 1, "new": 1, "powerful": 2, "premium": 2, "professional": 2,
  "quality": 2, "quick": 1, "ready": 1, "reliable": 2, "secure": 2,
  "simple": 1, "smart": 2, "special": 2, "thanks": 2, "trusted": 2,
  "valuable": 2, "welcome": 2, "win": 3,

  // Mild negative (anxiety, urgency, complaint)
  "alarm": -2, "alert": -1, "alone": -2, "annoy": -2, "annoyed": -2,
  "anxious": -2, "ashamed": -3, "awful": -3, "bad": -3, "broken": -2,
  "cancel": -1, "cancelled": -2, "complain": -2, "concerned": -2, "confused": -2,
  "criticism": -2, "danger": -3, "delay": -1, "delete": -2, "denied": -2,
  "difficult": -2, "disappointed": -3, "dislike": -2, "disturbed": -2, "doubt": -2,
  "embarrassed": -2, "error": -2, "expensive": -2, "expire": -1, "expired": -2,
  "fail": -2, "failed": -3, "fear": -3, "frustrated": -3, "hate": -3,
  "hurt": -3, "ignore": -2, "ignored": -2, "issue": -1, "junk": -2,
  "lose": -3, "loss": -2, "missed": -1, "mistake": -2, "missing": -1,
  "nothing": -1, "old": -1, "pain": -3, "painful": -3, "poor": -2,
  "problem": -2, "problems": -2, "regret": -2, "reject": -2, "rejected": -2,
  "removed": -1, "sad": -2, "shame": -2, "slow": -1, "sorry": -1,
  "stop": -1, "struggle": -2, "stuck": -2, "terrible": -3, "tired": -2,
  "trouble": -2, "ugly": -3, "unhappy": -3, "useless": -3, "worry": -2,
  "worried": -3, "wrong": -2,

  // Strong negative (rare in subject lines but high signal)
  "abuse": -3, "abusive": -3, "agony": -4, "atrocious": -4, "awful": -3,
  "betrayed": -3, "broken": -2, "catastrophe": -4, "crash": -2, "crisis": -3,
  "destroy": -3, "destroyed": -3, "dreadful": -3, "dying": -2, "evil": -3,
  "fraud": -4, "horrible": -3, "horrified": -4, "horror": -3, "kill": -3,
  "killed": -3, "nightmare": -4, "panic": -3, "scam": -4, "scared": -2,
  "scary": -2, "shocked": -2, "suffer": -2, "tragic": -4, "victim": -3,
};
