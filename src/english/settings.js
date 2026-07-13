/**
 * English practice settings — separate key from 双拼 (`xiaohe-settings`).
 */

const STORAGE_KEY = 'english-settings'

/** @typedef {'auto' | 'manual'} TimerMode */

/**
 * @typedef {object} EnglishSettings
 * @property {boolean} smartPractice
 * @property {TimerMode} timerMode
 * @property {boolean} keyboardCovered
 * @property {boolean} speakOnCorrect
 * @property {boolean} autoAdvancePerfect
 * @property {boolean} autoAdvanceWithMistakes
 * @property {boolean} caseSensitive
 * @property {number} durationMinutes
 * @property {number} minArticleChars
 * @property {number} charsPerPage
 */

/** @type {EnglishSettings} */
export const DEFAULT_ENGLISH_SETTINGS = {
  smartPractice: false,
  timerMode: 'auto',
  keyboardCovered: false,
  speakOnCorrect: false,
  autoAdvancePerfect: true,
  autoAdvanceWithMistakes: true,
  caseSensitive: true,
  durationMinutes: 5,
  minArticleChars: 40,
  charsPerPage: 220,
}

/** @returns {EnglishSettings} */
export function loadEnglishSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    /** @type {EnglishSettings} */
    let base = { ...DEFAULT_ENGLISH_SETTINGS }
    if (raw) base = { ...DEFAULT_ENGLISH_SETTINGS, ...JSON.parse(raw) }
    base.minArticleChars = Math.max(1, Math.min(2000, Number(base.minArticleChars) || 40))
    base.charsPerPage = Math.max(40, Math.min(600, Number(base.charsPerPage) || 220))
    base.durationMinutes = Math.max(1, Math.min(60, Number(base.durationMinutes) || 5))
    return base
  } catch {
    return { ...DEFAULT_ENGLISH_SETTINGS }
  }
}

/** @param {Partial<EnglishSettings>} patch */
export function saveEnglishSettings(patch) {
  const next = { ...loadEnglishSettings(), ...patch }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
