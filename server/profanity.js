// Basic EN + Hindi profanity filter — blocks worst terms, replaces with ***
const BAD_WORDS = [
  // English
  "fuck","shit","bitch","asshole","bastard","cunt","dick","cock","pussy","nigger","nigga",
  "faggot","fag","whore","slut","retard","motherfucker","motherfucking","fucker","fucking",
  "bullshit","jackass","douchebag","prick","twat","wanker","arse","arsehole","crap",
  // Hindi (romanised common spellings)
  "chutiya","madarchod","bhenchod","bsdk","behenchod","gaandu","gandu","randi","harami",
  "haraami","saala","saali","kamine","kamina","kutte","bakwaas","lodu","lavda","lauda",
  "chut","bhosdike","bhosdika","jhant","maderchod","sisterfucker","mc","bc","mf",
  "chudna","chudne","chodna","chod","chodo","lund","laude","gaand","gand","hijra",
  "machod","madar","bhadwa","bhadwe","rakhail","rand","sala","sali","ullu","ullua",
  // Common abbreviations
  "wtf","stfu","kys",
];

// build regex once at startup
const PATTERN = new RegExp(
  BAD_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'gi'
);

/**
 * Returns true if the text contains any blocked word.
 */
export function containsProfanity(text) {
  return PATTERN.test(text);
}

/**
 * Returns the text with profane words replaced by ***.
 */
export function filterProfanity(text) {
  return text.replace(PATTERN, m => '*'.repeat(m.length));
}
