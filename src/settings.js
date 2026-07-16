/**
 * Settings persisted in localStorage.
 */

import { DEFAULT_SPEAK_LIMIT, normalizeSpeakLimitSettings } from './speaking/length.js'

const STORAGE_KEY = 'xiaohe-settings'

/** @typedef {'xiaohe' | 'ziranma' | 'sogou' | 'quanpin'} SchemeId */
/** @typedef {'auto' | 'manual' | 'off'} TimerMode */
/** @typedef {'time' | 'count'} SpeakLimitMode */

/**
 * @typedef {object} Settings
 * @property {SchemeId} scheme
 * @property {boolean} smartPractice
 * @property {TimerMode} timerMode
 * @property {boolean} showHints
 * @property {boolean} keyboardCovered
 * @property {boolean} speakOnCorrect
 * @property {boolean} speakOnSentenceClick
 * @property {SpeakLimitMode} speakLimitMode
 * @property {number} speakMaxMinutes
 * @property {number} speakMaxCount
 * @property {boolean} autoAdvancePerfect
 * @property {boolean} autoAdvanceWithMistakes
 * @property {number} durationMinutes
 * @property {number} minArticleChars
 * @property {number} charsPerPage
 */

/** @type {Settings} */
export const DEFAULT_SETTINGS = {
  scheme: 'xiaohe',
  smartPractice: false,
  timerMode: 'auto',
  showHints: true,
  keyboardCovered: false,
  speakOnCorrect: false,
  speakOnSentenceClick: true,
  ...DEFAULT_SPEAK_LIMIT,
  speakMaxCount: 200,
  autoAdvancePerfect: true,
  autoAdvanceWithMistakes: true,
  durationMinutes: 5,
  minArticleChars: 20,
  charsPerPage: 80,
}

/** @returns {Settings} */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    /** @type {Settings} */
    let base = { ...DEFAULT_SETTINGS }
    if (raw) {
      const parsed = JSON.parse(raw)
      base = { ...DEFAULT_SETTINGS, ...parsed }
      // Product default flipped on for auto-advance with mistakes
      if (!Object.prototype.hasOwnProperty.call(parsed, 'autoAdvanceWithMistakes')) {
        base.autoAdvanceWithMistakes = true
      }
    } else {
      const oldDur = Number(localStorage.getItem('xiaohe-practice-duration'))
      if (Number.isFinite(oldDur) && oldDur > 0) base.durationMinutes = oldDur
      if (localStorage.getItem('xiaohe-keyboard-covered') === '1') {
        base.keyboardCovered = true
      }
    }
    base.minArticleChars = Math.max(1, Math.min(500, Number(base.minArticleChars) || 20))
    base.charsPerPage = Math.max(20, Math.min(300, Number(base.charsPerPage) || 80))
    if (!['auto', 'manual', 'off'].includes(base.timerMode)) base.timerMode = 'auto'
    if (!['xiaohe', 'ziranma', 'sogou', 'quanpin'].includes(base.scheme)) base.scheme = 'xiaohe'
    Object.assign(base, normalizeSpeakLimitSettings(base, 'zh'))
    // One-time: product default for “有错字时也自动下一篇” flipped on
    if (!localStorage.getItem('xiaohe-mig-autoAdvMistakes-on')) {
      base.autoAdvanceWithMistakes = true
      localStorage.setItem('xiaohe-mig-autoAdvMistakes-on', '1')
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(base))
      } catch {
        /* ignore */
      }
    }
    return base
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** @param {Partial<Settings>} patch */
export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch }
  Object.assign(next, normalizeSpeakLimitSettings(next, 'zh'))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export const SCHEME_OPTIONS = [
  { id: 'xiaohe', label: '小鹤双拼' },
  { id: 'ziranma', label: '自然码' },
  { id: 'sogou', label: '搜狗双拼' },
  { id: 'quanpin', label: '全拼' },
]
