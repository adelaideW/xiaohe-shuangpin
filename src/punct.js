/**
 * Shared punctuation typing helpers for EN / JP / ZH practice keyboards.
 * Fullwidth article marks map to Western keys users actually press.
 */

/** @type {Record<string, string>} */
export const PUNCT_TO_KEY = {
  '，': ',',
  '。': '.',
  '？': '?',
  '！': '!',
  '：': ':',
  '；': ';',
  '、': '/',
  '「': '[',
  '」': ']',
  '『': '[',
  '』': ']',
  '（': '(',
  '）': ')',
  '《': '<',
  '》': '>',
  '\u201c': '"',
  '\u201d': '"',
  '\u2018': "'",
  '\u2019': "'",
  '…': '.',
  '—': '-',
  '－': '-',
}

/** Punctuation keys shown on practice keyboards (no number row / brackets clutter). */
export const PUNCT_KEYS = [',', '.', '?', '!', "'", '"', ';', ':', '-', '/']

/**
 * @param {string} ch
 */
export function isTypablePunct(ch) {
  if (!ch || [...ch].length !== 1) return false
  if (PUNCT_TO_KEY[ch]) return true
  return /[.,!?;:'"()\-/]/.test(ch)
}

/**
 * Key the learner should press for this surface character.
 * @param {string} ch
 */
export function punctTypingKey(ch) {
  if (PUNCT_TO_KEY[ch]) return PUNCT_TO_KEY[ch]
  if (/[.,!?;:'"()\-/]/.test(ch)) return ch
  return ''
}

/**
 * English: letters, digits, and punctuation (spaces still skipped).
 * @param {string} ch
 */
export function isEnglishTypeChar(ch) {
  return /[A-Za-z0-9]/.test(ch) || isTypablePunct(ch)
}
