// Blocked words and patterns for adult content filtering
const BLOCKED_WORDS = [
  'fuck', 'fucking', 'fuckyou', 'motherfucker', 'motherfucking',
  'porn', 'pornhub', 'xvideos', 'xnxx', 'xhamster', 'redtube',
  'pussy', 'boobs', 'dick', 'cock', 'ass', 'asshole',
  'bitch', 'slut', 'whore', 'hentai', 'xxx',
  'onlyfans', 'chaturbate', 'brazzers', 'bangbros',
];

const BLOCKED_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com',
  'redtube.com', 'youporn.com', 'tube8.com', 'spankbang.com',
  'onlyfans.com', 'chaturbate.com', 'brazzers.com', 'bangbros.com',
  'livejasmin.com', 'stripchat.com',
];

/**
 * Check if a comment contains blocked adult content.
 * Returns true if the comment is clean, false if it violates the policy.
 */
export function isCommentClean(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z0-9.]/g, '');

  for (const word of BLOCKED_WORDS) {
    if (normalized.includes(word)) return false;
  }

  const withSpaces = text.toLowerCase();
  for (const domain of BLOCKED_DOMAINS) {
    if (withSpaces.includes(domain)) return false;
  }

  return true;
}
