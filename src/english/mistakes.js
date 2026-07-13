/**
 * English mistake log — separate from 双拼 (`xiaohe-mistakes`).
 */

const STORAGE_KEY = 'english-mistakes'
const MAX_EVENTS = 500

/**
 * @typedef {object} EnglishMistake
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

/** @param {Omit<EnglishMistake, 'at'>} event */
export function recordEnglishMistake(event) {
  const list = loadEnglishMistakes()
  list.push({ ...event, at: Date.now() })
  save(list)
  return list
}

export function clearEnglishMistakes() {
  localStorage.removeItem(STORAGE_KEY)
}

export function summarizeEnglishMistakes() {
  const list = loadEnglishMistakes()
  /** @type {Map<string, { char: string, count: number }>} */
  const byChar = new Map()
  for (const m of list) {
    const key = m.expected || m.char || '?'
    const prev = byChar.get(key) || { char: key, count: 0 }
    prev.count += 1
    byChar.set(key, prev)
  }
  const topChars = [...byChar.values()].sort((a, b) => b.count - a.count).slice(0, 12)
  const recent = [...list].reverse().slice(0, 20)
  return { total: list.length, topChars, recent }
}

/**
 * Prefer words that contain frequently missed characters.
 * @returns {string[]}
 */
export function smartEnglishWordPool(baseWords, mistakes = loadEnglishMistakes()) {
  if (!mistakes.length) return baseWords
  const counts = new Map()
  for (const m of mistakes) {
    const c = (m.expected || '').toLowerCase()
    if (!c || c === ' ') continue
    counts.set(c, (counts.get(c) || 0) + 1)
  }
  const scored = baseWords.map((w) => {
    let score = 1
    for (const ch of w.toLowerCase()) score += counts.get(ch) || 0
    return { w, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, Math.max(20, Math.ceil(scored.length * 0.4))).map((x) => x.w)
  return top.length ? top : baseWords
}
