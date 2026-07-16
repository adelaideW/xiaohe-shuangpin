/**
 * Japanese practice settings — isolated from 双拼 / English.
 */

import { DEFAULT_SPEAK_LIMIT, normalizeSpeakLimitSettings } from '../speaking/length.js'
import { markKeyboardPreferenceExplicit, resolveKeyboardCovered } from '../viewport.js'

const STORAGE_KEY = 'japanese-settings'
export const JA_KEYBOARD_EXPLICIT_KEY = 'japanese-kb-explicit'

/** @typedef {'auto' | 'manual' | 'off'} TimerMode */
/** @typedef {'time' | 'count'} SpeakLimitMode */

/**
 * @typedef {object} JapaneseSettings
 * @property {boolean} smartPractice
 * @property {TimerMode} timerMode
 * @property {boolean} keyboardCovered
 * @property {boolean} speakOnCorrect
 * @property {boolean} speakOnSentenceClick
 * @property {boolean} speakShowHiragana
 * @property {SpeakLimitMode} speakLimitMode
 * @property {number} speakMaxMinutes
 * @property {number} speakMaxCount
 * @property {boolean} autoAdvancePerfect
 * @property {boolean} autoAdvanceWithMistakes
 * @property {number} durationMinutes
 * @property {number} minArticleChars
 * @property {number} charsPerPage
 */

/** @type {JapaneseSettings} */
export const DEFAULT_JAPANESE_SETTINGS = {
  smartPractice: false,
  timerMode: 'auto',
  keyboardCovered: false,
  speakOnCorrect: false,
  speakOnSentenceClick: true,
  speakShowHiragana: true,
  ...DEFAULT_SPEAK_LIMIT,
  speakMaxCount: 200,
  autoAdvancePerfect: true,
  autoAdvanceWithMistakes: true,
  durationMinutes: 5,
  minArticleChars: 20,
  charsPerPage: 40,
}

/** @returns {JapaneseSettings} */
export function loadJapaneseSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    /** @type {JapaneseSettings} */
    let base = { ...DEFAULT_JAPANESE_SETTINGS }
    if (raw) base = { ...DEFAULT_JAPANESE_SETTINGS, ...JSON.parse(raw) }
    base.minArticleChars = Math.max(1, Math.min(500, Number(base.minArticleChars) || 20))
    base.charsPerPage = Math.max(10, Math.min(120, Number(base.charsPerPage) || 40))
    base.durationMinutes = Math.max(1, Math.min(60, Number(base.durationMinutes) || 5))
    if (!['auto', 'manual', 'off'].includes(base.timerMode)) base.timerMode = 'auto'
    Object.assign(base, normalizeSpeakLimitSettings(base, 'ja'))
    base.speakShowHiragana = Boolean(base.speakShowHiragana)
    // Legacy flag: previously forced keyboard visible. Compact screens now hide by default.
    if (!localStorage.getItem('japanese-mig-kb-shown')) {
      localStorage.setItem('japanese-mig-kb-shown', '1')
    }
    // One-time: furigana / hiragana-over-kanji on by default for first visit
    if (!localStorage.getItem('japanese-mig-furi-default-on')) {
      base.speakShowHiragana = true
      localStorage.setItem('japanese-mig-furi-default-on', '1')
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(base))
      } catch {
        /* ignore */
      }
    }
    base.keyboardCovered = resolveKeyboardCovered(base.keyboardCovered, JA_KEYBOARD_EXPLICIT_KEY)
    return base
  } catch {
    return {
      ...DEFAULT_JAPANESE_SETTINGS,
      keyboardCovered: resolveKeyboardCovered(false, JA_KEYBOARD_EXPLICIT_KEY),
    }
  }
}

/** @param {Partial<JapaneseSettings>} patch */
export function saveJapaneseSettings(patch) {
  if (Object.prototype.hasOwnProperty.call(patch, 'keyboardCovered')) {
    markKeyboardPreferenceExplicit(JA_KEYBOARD_EXPLICIT_KEY)
  }
  const next = { ...loadJapaneseSettings(), ...patch }
  Object.assign(next, normalizeSpeakLimitSettings(next, 'ja'))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
