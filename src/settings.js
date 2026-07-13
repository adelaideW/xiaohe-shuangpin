/**
 * Settings persisted in localStorage.
 */

const STORAGE_KEY = 'xiaohe-settings'

/** @typedef {'xiaohe' | 'ziranma' | 'sogou'} SchemeId */
/** @typedef {'auto' | 'manual'} TimerMode */

/**
 * @typedef {object} Settings
 * @property {SchemeId} scheme
 * @property {boolean} smartPractice
 * @property {TimerMode} timerMode
 * @property {boolean} showHints
 * @property {boolean} keyboardCovered
 * @property {boolean} speakOnCorrect
 * @property {boolean} autoAdvancePerfect
 * @property {boolean} autoAdvanceWithMistakes
 * @property {number} durationMinutes
 */

/** @type {Settings} */
export const DEFAULT_SETTINGS = {
  scheme: 'xiaohe',
  smartPractice: false,
  timerMode: 'auto',
  showHints: true,
  keyboardCovered: false,
  speakOnCorrect: false,
  autoAdvancePerfect: true,
  autoAdvanceWithMistakes: false,
  durationMinutes: 5,
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
    } else {
      // Migrate older keys once
      const oldDur = Number(localStorage.getItem('xiaohe-practice-duration'))
      if (Number.isFinite(oldDur) && oldDur > 0) base.durationMinutes = oldDur
      if (localStorage.getItem('xiaohe-keyboard-covered') === '1') {
        base.keyboardCovered = true
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export const SCHEME_OPTIONS = [
  { id: 'xiaohe', label: '小鹤双拼' },
  { id: 'ziranma', label: '自然码' },
  { id: 'sogou', label: '搜狗双拼' },
]
