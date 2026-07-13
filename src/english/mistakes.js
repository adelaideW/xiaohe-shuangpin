/**
 * English mistake log — separate from 双拼 (`xiaohe-mistakes`).
 * Errors are stored by word (not individual characters).
 */

const STORAGE_KEY = 'english-mistakes'
const MAX_EVENTS = 500

/**
 * @typedef {object} EnglishMistake
 * @property {string} word
 * @property {string} char
 * @property {string} expected
 * @property {string} typed
 * @property {string} mode
 * @property {number} at
 */

/** @returns {EnglishMistake[]} */
export function loadEnglishMistakes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** @param {EnglishMistake[]} list */
function save(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_EVENTS)))
}

/**
 * Extract the word (letters/digits/apostrophes) around a character index.
 * Falls back to the single character for spaces/punctuation.
 * @param {string} text
 * @param {number} charIndex
 */
export function wordAroundIndex(text, charIndex) {
  const chars = [...String(text || '')]
  if (!chars.length || charIndex < 0 || charIndex >= chars.length) return ''
  const ch = chars[charIndex]
  if (!/[A-Za-z0-9']/.test(ch)) {
    return ch === ' ' ? '␣' : ch
  }
  let start = charIndex
  let end = charIndex
  while (start > 0 && /[A-Za-z0-9']/.test(chars[start - 1])) start -= 1
  while (end < chars.length - 1 && /[A-Za-z0-9']/.test(chars[end + 1])) end += 1
  return chars.slice(start, end + 1).join('')
}

/** @param {Omit<EnglishMistake, 'at'> & { word?: string }} event */
export function recordEnglishMistake(event) {
  const word = String(event.word || event.expected || event.char || '?').trim() || '?'
  const list = loadEnglishMistakes()
  list.push({
    word,
    char: event.char || word,
    expected: event.expected || word,
    typed: event.typed || '',
    mode: event.mode || 'article',
    at: Date.now(),
  })
  save(list)
  return list
}

export function clearEnglishMistakes() {
  localStorage.removeItem(STORAGE_KEY)
}

export function summarizeEnglishMistakes() {
  const list = loadEnglishMistakes()
  /** @type {Map<string, { word: string, count: number }>} */
  const byWord = new Map()
  for (const m of list) {
    const key = String(m.word || m.expected || m.char || '?').trim() || '?'
    const prev = byWord.get(key) || { word: key, count: 0 }
    prev.count += 1
    byWord.set(key, prev)
  }
  const topWords = [...byWord.values()].sort((a, b) => b.count - a.count).slice(0, 12)
  const recent = [...list].reverse().slice(0, 20)
  return { total: list.length, topWords, recent }
}

/**
 * Prefer words that were mistyped, then base words containing those.
 * @returns {string[]}
 */
export function smartEnglishWordPool(baseWords, mistakes = loadEnglishMistakes()) {
  if (!mistakes.length) return baseWords
  const counts = new Map()
  for (const m of mistakes) {
    const w = String(m.word || m.expected || '')
      .toLowerCase()
      .replace(/[^a-z0-9']/g, '')
    if (!w) continue
    counts.set(w, (counts.get(w) || 0) + 3)
    for (const ch of w) counts.set(ch, (counts.get(ch) || 0) + 1)
  }
  const scored = baseWords.map((w) => {
    const lower = w.toLowerCase()
    let score = counts.get(lower) || 1
    for (const ch of lower) score += counts.get(ch) || 0
    return { w, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, Math.max(20, Math.ceil(scored.length * 0.4))).map((x) => x.w)
  return top.length ? top : baseWords
}
