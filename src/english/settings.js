/**
 * English practice settings — separate key from 双拼 (`xiaohe-settings`).
 */

import { DEFAULT_SPEAK_LIMIT, normalizeSpeakLimitSettings } from '../speaking/length.js'
import { markKeyboardPreferenceExplicit, resolveKeyboardCovered } from '../viewport.js'

const STORAGE_KEY = 'english-settings'
export const EN_KEYBOARD_EXPLICIT_KEY = 'english-kb-explicit'

/** @typedef {'auto' | 'manual' | 'off'} TimerMode */
/** @typedef {'time' | 'count'} SpeakLimitMode */

/**
 * @typedef {object} EnglishSettings
 * @property {boolean} smartPractice
 * @property {TimerMode} timerMode
 * @property {boolean} keyboardCovered
 * @property {boolean} speakOnCorrect
 * @property {boolean} speakOnSentenceClick
 * @property {SpeakLimitMode} speakLimitMode
 * @property {number} speakMinMinutes
 * @property {number} speakMaxMinutes
 * @property {number} speakMinCount
 * @property {number} speakMaxCount
 * @property {boolean} autoAdvancePerfect
 * @property {boolean} autoAdvanceWithMistakes
 * @property {boolean} caseSensitive
 * @property {number} durationMinutes
 * @property {number} minArticleChars English: minimum words for articles
 * @property {number} charsPerPage English: words per page
 */

/** @type {EnglishSettings} */
export const DEFAULT_ENGLISH_SETTINGS = {
  smartPractice: false,
  timerMode: 'auto',
  keyboardCovered: false,
  speakOnCorrect: false,
  speakOnSentenceClick: true,
  ...DEFAULT_SPEAK_LIMIT,
  speakMaxCount: 150,
  autoAdvancePerfect: true,
  autoAdvanceWithMistakes: true,
  caseSensitive: true,
  durationMinutes: 5,
  minArticleChars: 20,
  charsPerPage: 80,
}

/** @returns {EnglishSettings} */
export function loadEnglishSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    /** @type {EnglishSettings} */
    let base = { ...DEFAULT_ENGLISH_SETTINGS }
    if (raw) base = { ...DEFAULT_ENGLISH_SETTINGS, ...JSON.parse(raw) }
    base.minArticleChars = Math.max(1, Math.min(2000, Number(base.minArticleChars) || 20))
    base.charsPerPage = Math.max(5, Math.min(500, Number(base.charsPerPage) || 80))
    base.durationMinutes = Math.max(1, Math.min(60, Number(base.durationMinutes) || 5))
    if (!['auto', 'manual', 'off'].includes(base.timerMode)) base.timerMode = 'auto'
    Object.assign(base, normalizeSpeakLimitSettings(base, 'en'))
    // One-time: migrate older char-based article mins that were way too high as words
    if (!localStorage.getItem('english-mig-article-words') && base.minArticleChars > 200) {
      base.minArticleChars = 20
      base.charsPerPage = Math.min(80, base.charsPerPage)
      localStorage.setItem('english-mig-article-words', '1')
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(base))
      } catch {
        /* ignore */
      }
    }
    // Legacy flag: previously forced keyboard visible. Compact screens now hide by default.
    if (!localStorage.getItem('english-mig-kb-shown')) {
      localStorage.setItem('english-mig-kb-shown', '1')
    }
    base.keyboardCovered = resolveKeyboardCovered(base.keyboardCovered, EN_KEYBOARD_EXPLICIT_KEY)
    return base
  } catch {
    return {
      ...DEFAULT_ENGLISH_SETTINGS,
      keyboardCovered: resolveKeyboardCovered(false, EN_KEYBOARD_EXPLICIT_KEY),
    }
  }
}

/** @param {Partial<EnglishSettings>} patch */
export function saveEnglishSettings(patch) {
  if (Object.prototype.hasOwnProperty.call(patch, 'keyboardCovered')) {
    markKeyboardPreferenceExplicit(EN_KEYBOARD_EXPLICIT_KEY)
  }
  const next = { ...loadEnglishSettings(), ...patch }
  Object.assign(next, normalizeSpeakLimitSettings(next, 'en'))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
