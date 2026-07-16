import { encode, encodeOptions, getLayout, getSchemeLabel, isQuanpinScheme, selfTestScheme } from './schemes.js'
import { CHARACTERS, SENTENCES, ARTICLES, buildUnits } from './data.js'
import {
  loadSettings,
  saveSettings,
  SCHEME_OPTIONS,
  DEFAULT_SETTINGS,
} from './settings.js'
import {
  recordMistake,
  clearMistakes,
  summarizeMistakes,
  smartCharacterPool,
  smartPassagePool,
  loadMistakes,
} from './mistakes.js'
import { LIBRARY_TEXTS } from './library.js'
import {
  passageFromText,
  countHanzi,
  buildPages,
  pageIndexForUnit,
  fitChinesePassage,
} from './pinyinText.js'
import { extractFromFile } from './upload.js'
import { loadUserLibrary, addUserDoc, removeUserDoc } from './userLibrary.js'
import { punctTypingKey, isPracticeTypingKey } from './punct.js'
import { renderAnsiKeyboardRows, resolveHintKeys } from './keyboard.js'
import { scrollTypingFocusIntoView } from './scrollTypingFocus.js'
import { speakBudgetFromMinutes } from './speaking/length.js'
import { speakText } from './speaking/speech.js'

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const STORAGE_MODE = 'xiaohe-practice-mode'
const STORAGE_BEST = 'xiaohe-best-combo'

const MODES = [
  { id: 'character', label: '单字练习' },
  { id: 'sentence', label: '句子练习' },
  { id: 'article', label: '文章练习' },
]

const DURATION_PRESETS = [3, 5, 10, 15]

function loadMode() {
  const saved = localStorage.getItem(STORAGE_MODE)
  if (MODES.some((m) => m.id === saved)) return saved
  return 'character'
}

function saveMode(mode) {
  localStorage.setItem(STORAGE_MODE, mode)
}

let settings = loadSettings()

const state = {
  mode: loadMode(),
  buffer: '',
  correct: 0,
  wrong: 0,
  combo: 0,
  best: Number(localStorage.getItem(STORAGE_BEST) || 0),
  startedAt: null,
  keystrokes: 0,
  currentChar: null,
  passage: null,
  units: [],
  unitIndex: 0,
  completed: false,
  passageWrong: 0,
  passagesDone: 0,
  durationMinutes: settings.durationMinutes || DEFAULT_SETTINGS.durationMinutes,
  sessionEndsAt: null,
  sessionActive: false,
  sessionFinished: false,
  sessionPaused: false,
  remainingMs: 0,
  lastActivityAt: 0,
  pauseStartedAt: null,
  pausedAccumMs: 0,
  autoAdvanceNote: '',
  autoPaused: false, // paused due to inactivity
  // pagination
  pages: [{ start: 0, end: 0 }],
  pageIndex: 0,
  uploadBusy: false,
  uploadMessage: '',
  // navigation
  passageHistory: [],
  historyIndex: -1,
  // drawers
  drawer: null, // 'mistakes' | 'settings' | null
  drawerJustOpened: false,
}

let app = document.querySelector('#practice-root') || document.querySelector('#app')
let tickHandle = null
let advanceTimer = null

function shufflePick(list, avoid) {
  if (!list.length) return null
  if (list.length === 1) return list[0]
  let item
  let guard = 0
  do {
    item = list[Math.floor(Math.random() * list.length)]
    guard += 1
  } while (avoid && item === avoid && guard < 20)
  return item
}

function currentTarget() {
  if (state.mode === 'character') return state.currentChar
  return state.units[state.unitIndex] || null
}

function currentCode() {
  const t = currentTarget()
  if (!t) return ''
  if (t.kind === 'punct' || t.kind === 'space') return t.expected || punctTypingKey(t.char)
  return encode(settings.scheme, t.pinyin)
}

/** Accepted codes for the current syllable (e.g. jv + ju for 距). */
function currentCodes() {
  const t = currentTarget()
  if (!t) return []
  if (t.kind === 'punct' || t.kind === 'space') {
    const c = t.expected || punctTypingKey(t.char)
    return c ? [c] : []
  }
  return encodeOptions(settings.scheme, t.pinyin)
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const IDLE_PAUSE_MS = 60_000

function elapsedMinutes() {
  if (!state.startedAt) return 0
  let elapsed = performance.now() - state.startedAt - state.pausedAccumMs
  if (state.sessionPaused && state.pauseStartedAt) {
    elapsed -= performance.now() - state.pauseStartedAt
  }
  return Math.max(elapsed / 60000, 1 / 60)
}

function accuracy() {
  const total = state.correct + state.wrong
  if (!total) return 100
  return Math.round((state.correct / total) * 100)
}

function cpm() {
  return Math.round(state.correct / elapsedMinutes())
}

function kpm() {
  return Math.round(state.keystrokes / elapsedMinutes())
}

function clearAdvanceTimer() {
  if (advanceTimer) {
    clearTimeout(advanceTimer)
    advanceTimer = null
  }
}

function noteActivity() {
  state.lastActivityAt = performance.now()
  // Typing resumes an idle auto-pause
  if (state.sessionActive && state.sessionPaused && state.autoPaused && !state.sessionFinished) {
    resumeSession()
  }
}

function syncEndsAtFromRemaining() {
  state.sessionEndsAt = performance.now() + state.remainingMs
}

function startSession() {
  if (state.sessionFinished) return
  if (state.sessionActive && !state.sessionPaused) return
  if (state.sessionActive && state.sessionPaused) {
    resumeSession()
    return
  }
  state.sessionActive = true
  state.sessionFinished = false
  state.sessionPaused = false
  state.autoPaused = false
  state.startedAt = performance.now()
  state.pausedAccumMs = 0
  state.pauseStartedAt = null
  state.remainingMs = state.durationMinutes * 60 * 1000
  syncEndsAtFromRemaining()
  state.lastActivityAt = performance.now()
  updateTimerDisplay()
}

function pauseSession({ auto = false } = {}) {
  if (!state.sessionActive || state.sessionFinished || state.sessionPaused) return
  state.remainingMs = Math.max(0, state.sessionEndsAt - performance.now())
  state.sessionPaused = true
  state.autoPaused = auto
  state.pauseStartedAt = performance.now()
  renderTimerControls()
}

function resumeSession() {
  if (!state.sessionActive || state.sessionFinished || !state.sessionPaused) return
  if (state.pauseStartedAt) {
    state.pausedAccumMs += performance.now() - state.pauseStartedAt
  }
  state.pauseStartedAt = null
  state.sessionPaused = false
  state.autoPaused = false
  syncEndsAtFromRemaining()
  state.lastActivityAt = performance.now()
  renderTimerControls()
}

function resetTimerCountdown() {
  if (state.sessionFinished) return
  state.remainingMs = state.durationMinutes * 60 * 1000
  if (state.sessionActive && !state.sessionPaused) {
    syncEndsAtFromRemaining()
  }
  state.lastActivityAt = performance.now()
  if (state.sessionPaused) {
    renderTimerControls()
    return
  }
  const el = document.querySelector('#timer-value')
  if (el) {
    el.textContent = formatTime(state.remainingMs)
    el.classList.toggle('urgent', state.remainingMs < 30000)
    el.classList.remove('paused')
  }
}

function endSession() {
  if (state.sessionFinished) return
  state.sessionActive = false
  state.sessionFinished = true
  state.sessionPaused = false
  state.autoPaused = false
  state.pauseStartedAt = null
  state.remainingMs = 0
  state.completed = true
  clearAdvanceTimer()
  render()
}

function updateTimerDisplay() {
  if (!state.sessionActive || state.sessionFinished) return

  // Auto-pause after 1 minute without typing
  if (
    !state.sessionPaused &&
    state.lastActivityAt &&
    performance.now() - state.lastActivityAt >= IDLE_PAUSE_MS
  ) {
    pauseSession({ auto: true })
    return
  }

  if (state.sessionPaused) return

  const left = state.sessionEndsAt - performance.now()
  state.remainingMs = left
  if (left <= 0) {
    endSession()
    return
  }
  const el = document.querySelector('#timer-value')
  if (el) {
    el.textContent = formatTime(left)
    el.classList.toggle('urgent', left < 30000)
    el.classList.remove('paused')
  }
}

/** Soft-update timer buttons without full page rebuild when possible */
function renderTimerControls() {
  const bar = document.querySelector('.timer-bar')
  if (!bar) {
    render()
    return
  }
  const right = bar.querySelector('.timer-right')
  if (!right) {
    render()
    return
  }
  right.innerHTML = timerRightHtml()
  bindTimerButtons()
}

function timerRightHtml() {
  if (settings.timerMode === 'off') {
    return `
      <span class="timer-value idle" id="timer-value">不计时</span>
      <div class="timer-actions"><span class="timer-hint">自由练习</span></div>
    `
  }

  let status
  if (state.sessionFinished) {
    status = `<span class="timer-value done">结束</span>`
  } else if (state.sessionActive && state.sessionPaused) {
    status = `<span class="timer-value paused" id="timer-value">${formatTime(state.remainingMs)}${state.autoPaused ? ' · 闲置' : ' · 暂停'}</span>`
  } else if (state.sessionActive) {
    status = `<span class="timer-value ${state.remainingMs < 30000 ? 'urgent' : ''}" id="timer-value">${formatTime(state.remainingMs)}</span>`
  } else {
    status = `<span class="timer-value idle" id="timer-value">${formatTime(state.durationMinutes * 60 * 1000)}</span>`
  }

  const iconPause = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`
  const iconPlay = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7L8 5z"/></svg>`
  const iconReset = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.2"/><path d="M21 3v7h-7"/></svg>`
  const iconEnd = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`

  let actions = ''
  if (state.sessionFinished) {
    actions = `<button type="button" class="primary" id="btn-restart-timer">再练一轮</button>`
  } else if (state.sessionActive) {
    actions = `
      <button type="button" class="icon-btn" id="btn-pause-timer" title="${state.sessionPaused ? '继续' : '暂停'}" aria-label="${state.sessionPaused ? '继续' : '暂停'}">${state.sessionPaused ? iconPlay : iconPause}</button>
      <button type="button" class="icon-btn" id="btn-reset-timer" title="重置" aria-label="重置">${iconReset}</button>
      <button type="button" class="icon-btn icon-btn-danger" id="btn-end-timer" title="结束" aria-label="结束">${iconEnd}</button>
    `
  } else if (settings.timerMode === 'manual') {
    actions = `<button type="button" class="primary" id="btn-start-timer">开始计时</button>`
  } else {
    actions = `<span class="timer-hint">输入即开始计时</span>`
  }

  return `${status}<div class="timer-actions">${actions}</div>`
}

function bindTimerButtons() {
  document.querySelector('#btn-start-timer')?.addEventListener('click', () => {
    startSession()
    render()
    focusApp()
  })
  document.querySelector('#btn-end-timer')?.addEventListener('click', () => endSession())
  document.querySelector('#btn-pause-timer')?.addEventListener('click', () => {
    if (state.sessionPaused) resumeSession()
    else pauseSession({ auto: false })
  })
  document.querySelector('#btn-reset-timer')?.addEventListener('click', () => {
    resetTimerCountdown()
    focusApp()
  })
  document.querySelectorAll('#btn-restart-timer').forEach((btn) => {
    btn.addEventListener('click', restartRound)
  })
}

function nextCharacter() {
  const pool = settings.smartPractice ? smartCharacterPool() : CHARACTERS
  state.currentChar = shufflePick(pool, state.currentChar)
  state.buffer = ''
  state.completed = false
  state.autoAdvanceNote = ''
}

function safePassageFromText(title, text) {
  try {
    return passageFromText(title, text)
  } catch {
    return null
  }
}

function articleLengthBounds() {
  if (settings.speakLimitMode === 'count') {
    let min = Math.max(1, Number(settings.speakMinCount) || 60)
    let max = Math.max(1, Number(settings.speakMaxCount) || 200)
    if (min > max) min = max
    return { min, max }
  }
  const min = speakBudgetFromMinutes('zh', settings.speakMinMinutes || 1)
  const max = speakBudgetFromMinutes('zh', settings.speakMaxMinutes || 5)
  return { min: Math.min(min, max), max: Math.max(min, max) }
}

function allChineseArticleSources() {
  // Same built-in bank as speaking (poems + LIBRARY_TEXTS); user uploads on top.
  const poems = ARTICLES
  const lib = LIBRARY_TEXTS.map((t) => safePassageFromText(t.title, t.text)).filter(Boolean)
  const user = loadUserLibrary()
    .map((d) => safePassageFromText(d.title, d.text))
    .filter(Boolean)
  return [...poems, ...lib, ...user]
}

function pickFittedArticle(avoid) {
  const { min, max } = articleLengthBounds()
  const sources = allChineseArticleSources()
  if (!sources.length) return null
  const measured = sources
    .map((p) => ({ p, n: countHanzi(p.text) }))
    .filter((x) => x.n > 0)
  const inRange = measured.filter((x) => x.n >= min && x.n <= max)
  let base =
    shufflePick(
      inRange.length ? inRange.map((x) => x.p) : [],
      avoid,
    ) || null
  if (!base) {
    const aboveMin = measured.filter((x) => x.n >= min).sort((a, b) => a.n - b.n)
    base = shufflePick(aboveMin.map((x) => x.p), avoid)
  }
  if (!base) {
    const longest = [...measured].sort((a, b) => b.n - a.n)
    base = shufflePick(longest.slice(0, Math.min(5, longest.length)).map((x) => x.p), avoid)
  }
  if (!base) return null
  return fitChinesePassage(base, min, max)
}

function refitCurrentArticle() {
  if (state.mode !== 'article' || !state.passage) return false
  const { min, max } = articleLengthBounds()
  const sources = allChineseArticleSources()
  const base =
    sources.find((p) => p.title === state.passage.title) || sources[0]
  if (!base) return false
  const fitted = fitChinesePassage(base, min, max)
  if (state.historyIndex >= 0 && state.historyIndex < state.passageHistory.length) {
    state.passageHistory[state.historyIndex] = fitted
  }
  loadPassageAt(fitted)
  return true
}

function pickNewPassage(mode) {
  if (mode === 'article') {
    return pickFittedArticle(state.passage)
  }
  if (settings.smartPractice) {
    const pool = smartPassagePool('sentence')
    return shufflePick(pool, state.passage)
  }
  return shufflePick(SENTENCES, state.passage)
}

function loadPassageAt(passage) {
  state.passage = passage
  state.units = buildUnits(passage.text, passage.pinyin)
  state.pages = buildPages(state.units, settings.charsPerPage)
  state.pageIndex = 0
  state.unitIndex = 0
  state.buffer = ''
  state.completed = false
  state.passageWrong = 0
  state.autoAdvanceNote = ''
}

function startPassage(mode, { pushHistory = true } = {}) {
  const passage = pickNewPassage(mode)
  if (!passage) return
  if (pushHistory) {
    // Drop any forward history when branching
    if (state.historyIndex >= 0 && state.historyIndex < state.passageHistory.length - 1) {
      state.passageHistory = state.passageHistory.slice(0, state.historyIndex + 1)
    }
    state.passageHistory.push(passage)
    state.historyIndex = state.passageHistory.length - 1
  }
  loadPassageAt(passage)
}

function goHistory(delta) {
  const next = state.historyIndex + delta
  if (next < 0 || next >= state.passageHistory.length) return
  state.historyIndex = next
  loadPassageAt(state.passageHistory[next])
  clearAdvanceTimer()
  render()
  focusApp()
}

function goNextPassage() {
  if (state.historyIndex < state.passageHistory.length - 1) {
    goHistory(1)
    return
  }
  startPassage(state.mode, { pushHistory: true })
  render()
  focusApp()
}

function goPrevPassage() {
  goHistory(-1)
}

function resetSessionStats() {
  state.correct = 0
  state.wrong = 0
  state.combo = 0
  state.startedAt = null
  state.keystrokes = 0
  state.buffer = ''
  state.completed = false
  state.passageWrong = 0
  state.passagesDone = 0
  state.autoAdvanceNote = ''
  state.sessionActive = false
  state.sessionFinished = false
  state.sessionPaused = false
  state.autoPaused = false
  state.pauseStartedAt = null
  state.pausedAccumMs = 0
  state.lastActivityAt = 0
  state.sessionEndsAt = null
  state.remainingMs = state.durationMinutes * 60 * 1000
  clearAdvanceTimer()
}

function setMode(mode) {
  state.mode = mode
  saveMode(mode)
  resetSessionStats()
  state.passageHistory = []
  state.historyIndex = -1
  if (mode === 'character') nextCharacter()
  else startPassage(mode)
  render()
  focusApp()
}

function setDuration(mins) {
  const n = Math.min(60, Math.max(1, Math.round(Number(mins) || 5)))
  state.durationMinutes = n
  settings = saveSettings({ durationMinutes: n })
  if (!state.sessionActive) {
    state.remainingMs = n * 60 * 1000
  }
  render()
  focusApp()
}

function softApplySettingsVisuals(patch) {
  if (patch.scheme) {
    const badge = document.querySelector('.brand .scheme')
    if (badge) badge.textContent = getSchemeLabel(settings.scheme)
  }

  if (patch.durationMinutes != null && !state.sessionActive) {
    const timerVal = document.querySelector('#timer-value')
    if (timerVal) timerVal.textContent = formatTime(state.remainingMs)
    document.querySelectorAll('#custom-duration').forEach((el) => {
      el.value = String(state.durationMinutes)
    })
    document.querySelectorAll('.dur-btn').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.duration) === state.durationMinutes)
    })
  }

  if (
    patch.scheme != null ||
    patch.showHints != null ||
    patch.keyboardCovered != null
  ) {
    const wrap = document.querySelector('.keyboard-wrap')
    if (wrap) {
      const tmp = document.createElement('div')
      tmp.innerHTML = renderKeyboard()
      const next = tmp.firstElementChild
      wrap.replaceWith(next)
    }
    const kbToggle = document.querySelector('#kb-toggle')
    if (kbToggle && patch.keyboardCovered != null) {
      kbToggle.textContent = settings.keyboardCovered ? '显示键盘' : '遮盖键盘'
    }
    const hintsBtn = document.querySelector('#btn-hints')
    if (hintsBtn && patch.showHints != null) {
      hintsBtn.textContent = settings.showHints ? '隐藏键位提示' : '显示键位提示'
    }
    patchLive()
  }

  if (patch.timerMode != null && !state.sessionActive && !state.sessionFinished) {
    renderTimerControls()
  }
}

function applySettingsPatch(patch) {
  settings = saveSettings(patch)
  if (patch.durationMinutes != null) {
    state.durationMinutes = settings.durationMinutes
    if (!state.sessionActive) {
      state.remainingMs = state.durationMinutes * 60 * 1000
    }
  }
  if (patch.timerMode === 'off') {
    // Drop countdown without locking practice into "finished".
    state.sessionActive = false
    state.sessionFinished = false
    state.sessionPaused = false
    state.autoPaused = false
    state.pauseStartedAt = null
    state.completed = false
  }
  if (patch.scheme != null) {
    state.buffer = ''
  }
  if (patch.charsPerPage != null && state.units.length) {
    state.pages = buildPages(state.units, settings.charsPerPage)
    state.pageIndex = pageIndexForUnit(state.pages, state.unitIndex)
  }

  const lengthChanged =
    'speakLimitMode' in patch ||
    'speakMaxMinutes' in patch ||
    'speakMinMinutes' in patch ||
    'speakMaxCount' in patch ||
    'speakMinCount' in patch

  if (lengthChanged && state.mode === 'article') {
    refitCurrentArticle()
    render()
    return
  }

  if (patch.charsPerPage != null || patch.timerMode != null || patch.scheme != null) {
    render()
    return
  }

  // While settings drawer is open, avoid full-page rebuild (causes blink)
  if (state.drawer === 'settings') {
    if (lengthChanged) {
      render()
      return
    }
    softApplySettingsVisuals(patch)
    return
  }

  render()
  focusApp()
}

function goPage(delta) {
  const next = state.pageIndex + delta
  if (next < 0 || next >= state.pages.length) return
  state.pageIndex = next
  const page = state.pages[state.pageIndex]
  if (state.unitIndex < page.start || state.unitIndex >= page.end) {
    state.unitIndex = page.start
    state.buffer = ''
  }
  clearAdvanceTimer()
  render()
  focusApp()
  requestAnimationFrame(scrollCurrentIntoView)
}

async function handleUploadedFile(file) {
  if (!file || state.uploadBusy) return
  const keepDrawer = state.drawer
  state.uploadBusy = true
  state.uploadMessage = '正在解析文档…'
  render()
  try {
    const extracted = await extractFromFile(file)
    let text = extracted.text
    if (text.length > 120000) text = text.slice(0, 120000)
    const passage = passageFromText(extracted.title, text)
    addUserDoc({ title: passage.title, text: passage.text })
    state.mode = 'article'
    saveMode('article')
    if (state.historyIndex >= 0 && state.historyIndex < state.passageHistory.length - 1) {
      state.passageHistory = state.passageHistory.slice(0, state.historyIndex + 1)
    }
    state.passageHistory.push(passage)
    state.historyIndex = state.passageHistory.length - 1
    loadPassageAt(passage)
    state.uploadMessage = `已加入「${passage.title}」· ${countHanzi(passage.text)} 字${
      state.pages.length > 1 ? ` · ${state.pages.length} 页` : ''
    }`
    state.drawer = keepDrawer === 'settings' ? 'settings' : null
  } catch (err) {
    state.uploadMessage = err?.message || '上传失败'
    state.drawer = keepDrawer
  } finally {
    state.uploadBusy = false
    render()
    if (!state.drawer) focusApp()
  }
}

function ensureSession() {
  if (state.sessionFinished) return true
  if (state.sessionActive) {
    // Keep idle auto-pause until user types (noteActivity resumes)
    return true
  }
  if (settings.timerMode === 'off' || settings.timerMode === 'manual') {
    // Untimed (or waiting for Start): still track elapsed for 字/分.
    if (settings.timerMode === 'off' && !state.startedAt) {
      state.startedAt = performance.now()
      state.pausedAccumMs = 0
    }
    return true
  }
  startSession()
  renderTimerControls()
  document.querySelectorAll('[data-duration], #custom-duration').forEach((el) => {
    el.disabled = true
  })
  document.querySelectorAll('.dur-btn').forEach((el) => el.classList.remove('active'))
  return true
}

function redoCurrentPassage() {
  if (!state.passage) return
  clearAdvanceTimer()
  loadPassageAt(state.passage)
  render()
  focusApp()
}

function onPassageComplete() {
  state.passagesDone += 1
  const clean = state.passageWrong === 0
  const canAuto =
    !state.sessionFinished &&
    ((clean && settings.autoAdvancePerfect) ||
      (!clean && settings.autoAdvanceWithMistakes))

  if (canAuto) {
    clearAdvanceTimer()
    state.completed = false
    state.autoAdvanceNote = ''
    goNextPassage()
    return
  }

  state.completed = true
  state.autoAdvanceNote = clean ? '' : '有错字 · 可重练或继续下一篇'
  render()
}

function patchStats() {
  const values = document.querySelectorAll('.stat .value')
  if (values.length < 6) return
  values[0].textContent = String(state.correct)
  values[1].textContent = String(state.combo)
  values[2].textContent = String(state.best)
  values[3].textContent = `${accuracy()}%`
  values[4].textContent = String(state.startedAt ? cpm() : 0)
  values[5].textContent = String(state.startedAt ? kpm() : 0)
}

function patchCodeSlots() {
  const progress = document.querySelector('.code-progress')
  const code = currentCode()
  if (!progress || !code) return
  const slots = progress.querySelectorAll('.code-slot')
  if (slots.length !== code.length) {
    progress.innerHTML = [...code]
      .map((_, i) => {
        const filled = i < state.buffer.length
        return `<div class="code-slot ${filled ? 'filled' : ''}">${filled ? state.buffer[i] : ''}</div>`
      })
      .join('')
    return
  }
  slots.forEach((slot, i) => {
    const filled = i < state.buffer.length
    slot.classList.toggle('filled', filled)
    slot.textContent = filled ? state.buffer[i] : ''
  })
}

function patchPinyinLine() {
  const line = document.querySelector('.pinyin-line')
  if (!line) return
  const t = currentTarget()
  if (!t) {
    line.textContent = ''
    return
  }
  if (t.kind === 'punct' || t.kind === 'space') {
    line.textContent = t.kind === 'space' ? `space` : `${t.char} · ${currentCode()}`
    return
  }
  const codes = encodeOptions(settings.scheme, t.pinyin)
  line.textContent = `${t.pinyin} · ${codes.join(' / ')}`
}

function patchKeyboardHints() {
  const t = currentTarget()
  const code = currentCode()
  const codes = currentCodes()
  const punctKey =
    (t?.kind === 'punct' || t?.kind === 'space') && settings.showHints && !state.sessionFinished
      ? code
      : ''
  const typedLen = state.buffer.length
  const quanpin = isQuanpinScheme(settings.scheme)
  const nextKeys =
    !punctKey && settings.showHints && codes.length && !state.sessionFinished
      ? [...new Set(codes.map((c) => c[typedLen]).filter(Boolean))]
      : []
  const initKey =
    !punctKey && !quanpin && settings.showHints && code && !state.sessionFinished ? code[0] : ''
  const finalKeys =
    !punctKey && !quanpin && settings.showHints && codes.length && !state.sessionFinished
      ? [...new Set(codes.map((c) => c[1]).filter(Boolean))]
      : []
  const { keys: punctTargets, needShift } = resolveHintKeys(punctKey)
  const punctSet = new Set(punctTargets)
  document.querySelectorAll('.key[data-key]').forEach((el) => {
    const keyId = el.dataset.key
    el.classList.toggle('hint', Boolean(punctKey && punctSet.has(keyId)))
    el.classList.toggle('hint-shift', Boolean(punctKey && needShift && keyId === 'Shift'))
    el.classList.toggle(
      'hint-initial',
      Boolean(
        (quanpin && nextKeys.includes(keyId)) ||
          (!quanpin && initKey && keyId === initKey && typedLen === 0),
      ),
    )
    el.classList.toggle(
      'hint-final',
      Boolean(!quanpin && finalKeys.includes(keyId) && typedLen === 1),
    )
  })
}

function patchPassageCursor() {
  const passage = document.querySelector('.passage')
  if (!passage || !state.passage) return

  const currentUnit = state.units[state.unitIndex]
  const currentIndex = currentUnit?.index ?? -1
  const doneIndexes = new Set(
    state.units.slice(0, state.unitIndex).map((u) => u.index),
  )

  passage.querySelectorAll('.ch').forEach((el) => {
    const i = Number(el.dataset.i)
    el.classList.toggle('done', doneIndexes.has(i))
    el.classList.toggle('current', i === currentIndex)
  })

  const metaProg = document.querySelector('.passage-progress')
  if (metaProg) {
    metaProg.textContent = `${state.unitIndex}/${state.units.length}${
      state.passageWrong ? ` · 错 ${state.passageWrong}` : ''
    }`
  }

  const pageLabel = document.querySelector('.page-label')
  if (pageLabel && state.pages.length > 1) {
    pageLabel.textContent = `第 ${state.pageIndex + 1}/${state.pages.length} 页`
  }

  scrollCurrentIntoView()
}

function patchCharacterView() {
  const t = state.currentChar
  if (!t) return
  const hanzi = document.querySelector('.hanzi')
  if (hanzi) hanzi.textContent = t.char
  patchPinyinLine()
  patchCodeSlots()
  patchKeyboardHints()
  patchStats()
}

function patchLive() {
  if (state.mode === 'character') {
    patchCharacterView()
    return
  }
  patchPassageCursor()
  patchPinyinLine()
  patchCodeSlots()
  patchKeyboardHints()
  patchStats()
}

function onCorrectSyllable() {
  state.correct += 1
  state.combo += 1
  if (state.combo > state.best) {
    state.best = state.combo
    localStorage.setItem(STORAGE_BEST, String(state.best))
  }
  state.buffer = ''

  if (settings.speakOnCorrect) speakCurrent()

  if (state.mode === 'character') {
    nextCharacter()
    patchLive()
    return
  }

  state.unitIndex += 1
  if (state.unitIndex >= state.units.length) {
    onPassageComplete()
    return
  }

  const nextPage = pageIndexForUnit(state.pages, state.unitIndex)
  if (nextPage !== state.pageIndex) {
    state.pageIndex = nextPage
    render()
    focusApp()
    requestAnimationFrame(scrollCurrentIntoView)
    return
  }
  patchLive()
  requestAnimationFrame(scrollCurrentIntoView)
}

function scrollCurrentIntoView() {
  scrollTypingFocusIntoView({
    unitIndex: state.unitIndex,
    unitCount: state.units.length,
    selector: '.passage-scroll .ch.current',
  })
}

function onWrongKey(typed) {
  const target = currentTarget()
  const expectedCode = currentCode()
  // Punctuation / space errors still count for accuracy, but are not saved to 错字本.
  if (target && target.kind !== 'punct' && target.kind !== 'space') {
    recordMistake({
      char: target.char,
      pinyin: target.pinyin,
      expectedCode,
      typed: typed || state.buffer,
      scheme: settings.scheme,
      mode: state.mode,
    })
  }
  state.wrong += 1
  state.passageWrong += 1
  state.combo = 0
  state.buffer = ''
  patchLive()
}

function handleKey(key) {
  if (state.sessionFinished) return
  if (state.drawer) return
  if (state.completed && state.mode !== 'character') return
  if (settings.timerMode === 'manual' || settings.timerMode === 'off') {
    // Still allow practice without countdown; clock stays idle until Start (manual) or stays off
  }
  const target = currentTarget()
  if (!target) return

  ensureSession()
  const code = currentCode()
  if (!code) return

  if (target.kind === 'punct' || target.kind === 'space') {
    if (key.length !== 1 && !(code === ' ' && key === ' ')) return
    noteActivity()
    state.keystrokes += 1
    if (key === code) onCorrectSyllable()
    else onWrongKey(key === ' ' ? 'space' : key)
    return
  }

  const lower = key.toLowerCase()
  if (!/^[a-z;]$/.test(lower)) return

  noteActivity()
  state.keystrokes += 1
  const nextBuf = state.buffer + lower
  const options = currentCodes()
  const matchesPrefix = options.some((c) => c.slice(0, nextBuf.length) === nextBuf)

  if (!matchesPrefix) {
    onWrongKey(nextBuf)
    return
  }

  state.buffer = nextBuf
  if (options.includes(state.buffer)) onCorrectSyllable()
  else patchLive()
}

function speakCurrent() {
  const t = currentTarget()
  if (!t) return
  void speakText(t.char, 'zh', 0.9)
}

function focusApp() {
  if (state.drawer) return
  const mirror = document.querySelector('#key-mirror')
  if (mirror) mirror.focus({ preventScroll: true })
}

function openDrawer(name) {
  state.drawer = name
  state.drawerJustOpened = true
  render()
}

function closeDrawer() {
  state.drawer = null
  render()
  focusApp()
}

function formatAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return '刚刚'
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`
  return `${Math.floor(sec / 86400)} 天前`
}

function renderMistakesDrawer() {
  const summary = summarizeMistakes()
  const topChars = summary.topChars.length
    ? summary.topChars
        .map(
          (c) =>
            `<li><span class="m-char">${c.char}</span> <span class="m-meta">${c.pinyin} · ${c.expectedCode}</span> <span class="m-count">${c.count} 次</span></li>`,
        )
        .join('')
    : '<li class="empty">暂无常错字</li>'

  const topCodes = summary.topCodes.length
    ? summary.topCodes
        .map((c) => `<li><code>${c.code}</code> <span class="m-count">${c.count} 次</span></li>`)
        .join('')
    : '<li class="empty">暂无</li>'

  const recent = summary.recent.length
    ? summary.recent
        .map(
          (m) =>
            `<li>
              <span class="m-char">${m.char}</span>
              <span class="m-meta">应 ${m.expectedCode} · 打了 ${m.typed || '—'}</span>
              <span class="m-time">${formatAgo(m.at)}</span>
            </li>`,
        )
        .join('')
    : '<li class="empty">还没有记录错误</li>'

  return `
    <aside class="drawer ${state.drawerJustOpened ? 'drawer-enter' : ''}" role="dialog" aria-label="错字本">
      <div class="drawer-head">
        <h2>错字本</h2>
        <button type="button" class="drawer-close" id="btn-close-drawer" aria-label="关闭">×</button>
      </div>
      <div class="drawer-body">
        <p class="drawer-lead">共 ${summary.total} 次错误 · 本地保存</p>
        <section class="drawer-section">
          <h3>常错字</h3>
          <ul class="mistake-list">${topChars}</ul>
        </section>
        <section class="drawer-section">
          <h3>常错编码</h3>
          <ul class="mistake-list compact">${topCodes}</ul>
        </section>
        <section class="drawer-section">
          <h3>最近错误</h3>
          <ul class="mistake-list">${recent}</ul>
        </section>
      </div>
      <div class="drawer-foot">
        <button type="button" class="primary" id="btn-practice-mistakes">练习这些</button>
        <button type="button" id="btn-clear-mistakes">清空记录</button>
      </div>
    </aside>
  `
}

function renderSettingsDrawer() {
  const schemes = SCHEME_OPTIONS.map(
    (s) =>
      `<label class="opt-row">
        <input type="radio" name="scheme" value="${s.id}" ${settings.scheme === s.id ? 'checked' : ''} />
        <span>${s.label}</span>
      </label>`,
  ).join('')

  return `
    <aside class="drawer ${state.drawerJustOpened ? 'drawer-enter' : ''}" role="dialog" aria-label="设置">
      <div class="drawer-head">
        <h2>设置</h2>
        <button type="button" class="drawer-close" id="btn-close-drawer" aria-label="关闭">×</button>
      </div>
      <div class="drawer-body">
        <section class="drawer-section">
          <h3>智能练习</h3>
          <label class="opt-row">
            <input type="checkbox" id="set-smart" ${settings.smartPractice ? 'checked' : ''} />
            <span>根据错字本生成针对性练习</span>
          </label>
        </section>
        <section class="drawer-section">
          <h3>计时器</h3>
          <label class="opt-row">
            <input type="radio" name="timerMode" value="auto" ${settings.timerMode === 'auto' ? 'checked' : ''} />
            <span>开始打字时自动计时</span>
          </label>
          <label class="opt-row">
            <input type="radio" name="timerMode" value="manual" ${settings.timerMode === 'manual' ? 'checked' : ''} />
            <span>手动点击「开始计时」</span>
          </label>
          <label class="opt-row">
            <input type="radio" name="timerMode" value="off" ${settings.timerMode === 'off' ? 'checked' : ''} />
            <span>不使用计时器</span>
          </label>
          <label class="opt-row stacked">
            <span>默认时长（分钟）</span>
            <input type="number" id="set-duration" min="1" max="60" value="${settings.durationMinutes}" ${settings.timerMode === 'off' ? 'disabled' : ''} />
          </label>
        </section>
        <section class="drawer-section">
          <h3>输入方案</h3>
          ${schemes}
        </section>
        <section class="drawer-section">
          <h3>文章练习</h3>
          <label class="opt-row">
            <span class="ghost-chip upload-chip">
              ${state.uploadBusy ? '解析中…' : '上传文章（txt / pdf / epub / 图片）'}
              <input type="file" id="file-upload-settings" accept=".txt,.md,.pdf,.epub,.png,.jpg,.jpeg,.webp,.gif,text/plain,application/pdf,application/epub+zip,image/*" hidden ${state.uploadBusy ? 'disabled' : ''} />
            </span>
          </label>
          ${
            loadUserLibrary().length
              ? `<ul class="mistake-list compact user-lib">${loadUserLibrary()
                  .map(
                    (d) =>
                      `<li><span class="m-meta">${d.title}</span> <span class="m-count">${countHanzi(d.text)} 字</span> <button type="button" class="linkish" data-remove-doc="${d.id}">删除</button></li>`,
                  )
                  .join('')}</ul>`
              : '<p class="drawer-lead">还没有上传文章 · 内置含唐诗、名著节选、名言等</p>'
          }
        </section>
        <section class="drawer-section">
          <h3>练习体验</h3>
          <label class="opt-row">
            <input type="checkbox" id="set-hints" ${settings.showHints ? 'checked' : ''} />
            <span>显示键位提示</span>
          </label>
          <label class="opt-row">
            <input type="checkbox" id="set-cover" ${settings.keyboardCovered ? 'checked' : ''} />
            <span>默认遮盖键盘</span>
          </label>
          <label class="opt-row">
            <input type="checkbox" id="set-speak" ${settings.speakOnCorrect ? 'checked' : ''} />
            <span>正确时朗读</span>
          </label>
          <label class="opt-row">
            <input type="checkbox" id="set-speak-sentence" ${settings.speakOnSentenceClick ? 'checked' : ''} />
            <span>点击句子时朗读（口语）</span>
          </label>
          <div class="opt-block">
            <h3 class="opt-block-title">文章长度</h3>
            <p class="drawer-lead">时间与字数二选一，同时只生效一种。可设置最少和最多。</p>
            <label class="opt-row">
              <input type="radio" name="speak-limit-mode" value="time" ${settings.speakLimitMode !== 'count' ? 'checked' : ''} />
              <span>时间</span>
            </label>
            <label class="field-row field-row-unit">
              <span class="unit-prefix">最少</span>
              <input type="number" id="set-speak-min-minutes" min="1" max="${settings.speakMaxMinutes}" value="${settings.speakMinMinutes}" ${settings.speakLimitMode === 'count' ? 'disabled' : ''} />
              <span class="unit">分钟</span>
            </label>
            <label class="field-row field-row-unit">
              <span class="unit-prefix">最多</span>
              <input type="number" id="set-speak-minutes" min="${settings.speakMinMinutes}" max="30" value="${settings.speakMaxMinutes}" ${settings.speakLimitMode === 'count' ? 'disabled' : ''} />
              <span class="unit">分钟</span>
            </label>
            <label class="opt-row">
              <input type="radio" name="speak-limit-mode" value="count" ${settings.speakLimitMode === 'count' ? 'checked' : ''} />
              <span>字数</span>
            </label>
            <label class="field-row field-row-unit">
              <span class="unit-prefix">最少</span>
              <input type="number" id="set-speak-min-count" min="10" max="${settings.speakMaxCount}" value="${settings.speakMinCount}" ${settings.speakLimitMode !== 'count' ? 'disabled' : ''} />
              <span class="unit">字</span>
            </label>
            <label class="field-row field-row-unit">
              <span class="unit-prefix">最多</span>
              <input type="number" id="set-speak-count" min="${settings.speakMinCount}" max="2000" value="${settings.speakMaxCount}" ${settings.speakLimitMode !== 'count' ? 'disabled' : ''} />
              <span class="unit">字</span>
            </label>
            <label class="opt-row stacked page-size-row">
              <span>长文每页字数</span>
              <input type="number" id="set-page-chars" min="20" max="300" value="${settings.charsPerPage}" />
            </label>
          </div>
          <label class="opt-row">
            <input type="checkbox" id="set-auto-advance" ${settings.autoAdvancePerfect ? 'checked' : ''} />
            <span>全对时自动下一篇</span>
          </label>
          <label class="opt-row">
            <input type="checkbox" id="set-auto-advance-mistakes" ${settings.autoAdvanceWithMistakes ? 'checked' : ''} />
            <span>有错字时也自动下一篇</span>
          </label>
        </section>
      </div>
      <div class="drawer-foot">
        <button type="button" class="primary" id="btn-close-drawer">完成</button>
      </div>
    </aside>
  `
}

function renderTimerBar() {
  if (settings.timerMode === 'off') {
    return `
      <div class="timer-bar timer-bar-off">
        <div class="timer-bar-inner">
          <div class="timer-left">
            <span class="timer-label">练习时长</span>
            <span class="timer-hint">已关闭计时</span>
          </div>
          <div class="timer-right">
            ${timerRightHtml()}
          </div>
        </div>
      </div>
    `
  }

  const presets = DURATION_PRESETS.map(
    (m) =>
      `<button type="button" class="dur-btn ${state.durationMinutes === m && !state.sessionActive ? 'active' : ''}" data-duration="${m}" ${state.sessionActive ? 'disabled' : ''}>${m} 分</button>`,
  ).join('')

  return `
    <div class="timer-bar">
      <div class="timer-bar-inner">
        <div class="timer-left">
          <span class="timer-label">练习时长</span>
          <div class="dur-group">
            ${presets}
            <label class="custom-dur" title="自定义分钟">
              <input type="number" id="custom-duration" min="1" max="60" value="${state.durationMinutes}" ${state.sessionActive ? 'disabled' : ''} aria-label="自定义分钟" />
              <span>分</span>
            </label>
          </div>
        </div>
        <div class="timer-right">
          ${timerRightHtml()}
        </div>
      </div>
    </div>
  `
}

function renderStats() {
  return `
    <div class="stats">
      <div class="stat"><span class="label">已练</span><span class="value">${state.correct}</span></div>
      <div class="stat"><span class="label">连击</span><span class="value">${state.combo}</span></div>
      <div class="stat"><span class="label">最佳</span><span class="value">${state.best}</span></div>
      <div class="stat"><span class="label">准确率</span><span class="value">${accuracy()}%</span></div>
      <div class="stat"><span class="label">字/分</span><span class="value">${state.startedAt ? cpm() : 0}</span></div>
      <div class="stat"><span class="label">键/分</span><span class="value">${state.startedAt ? kpm() : 0}</span></div>
    </div>
  `
}

function renderKeyboard() {
  const layout = getLayout(settings.scheme)
  const quanpin = isQuanpinScheme(settings.scheme)
  const overlays = new Map()
  for (const row of layout) {
    for (const [display, initLabel, finalLabel] of row) {
      const keyId = display === ';' ? ';' : display.toLowerCase()
      overlays.set(keyId, { display, initLabel, finalLabel })
    }
  }

  const t = currentTarget()
  const code = currentCode()
  const codes = currentCodes()
  const punctKey =
    (t?.kind === 'punct' || t?.kind === 'space') && settings.showHints && !state.sessionFinished
      ? code
      : ''
  const typedLen = state.buffer.length
  const nextKeys =
    !punctKey && quanpin && settings.showHints && codes.length && !state.sessionFinished
      ? [...new Set(codes.map((c) => c[typedLen]).filter(Boolean))]
      : []
  const initKey =
    !punctKey && !quanpin && settings.showHints && code && !state.sessionFinished ? code[0] : ''
  const finalKeys =
    !punctKey && !quanpin && settings.showHints && codes.length && !state.sessionFinished
      ? [...new Set(codes.map((c) => c[1]).filter(Boolean))]
      : []
  const { keys: punctTargets, needShift } = resolveHintKeys(punctKey)
  const punctSet = new Set(punctTargets)

  const rows = renderAnsiKeyboardRows({
    lang: 'zh',
    tag: 'div',
    extraClasses: (key) => {
      const parts = []
      if (punctKey && punctSet.has(key.id)) parts.push('hint')
      if (punctKey && needShift && key.id === 'Shift') parts.push('hint-shift')
      if (quanpin && nextKeys.includes(key.id)) parts.push('hint-initial')
      if (!quanpin && initKey && key.id === initKey && typedLen === 0) parts.push('hint-initial')
      if (!quanpin && finalKeys.includes(key.id) && typedLen === 1) parts.push('hint-final')
      return parts.join(' ')
    },
    renderInner: (key) => {
      const ov = overlays.get(key.id)
      if (ov) {
        return `
              <span class="k-init">${ov.initLabel}</span>
              <span class="k-main">${ov.display}</span>
              <span class="k-final">${ov.finalLabel}</span>`
      }
      if (key.id === ' ') {
        return `
              <span class="k-init"></span>
              <span class="k-main">space</span>
              <span class="k-final"></span>`
      }
      return `
              <span class="k-init"></span>
              <span class="k-main">${key.label}</span>
              <span class="k-final"></span>`
    },
  })

  return `
    <div class="keyboard-wrap">
      <div class="legend">
        ${
          quanpin
            ? '<span class="init">字母</span><span class="final">全拼</span>'
            : '<span class="init">声母</span><span class="final">韵母</span>'
        }
      </div>
      <div class="keyboard keyboard-full ${settings.keyboardCovered ? 'covered' : ''}" id="keyboard">
        ${rows}
      </div>
    </div>
  `
}

function renderCodeSlots() {
  const code = currentCode()
  if (!code) return ''
  return `
    <div class="code-progress" aria-hidden="true">
      ${[...code]
        .map((_, i) => {
          const filled = i < state.buffer.length
          return `<div class="code-slot ${filled ? 'filled' : ''}">${filled ? state.buffer[i] : ''}</div>`
        })
        .join('')}
    </div>
  `
}

function renderCharacterStage() {
  if (state.sessionFinished) return renderSessionSummary()
  const t = state.currentChar
  if (!t) return ''
  const codes = encodeOptions(settings.scheme, t.pinyin)
  return `
    <div class="char-stage">
      <div class="hanzi">${t.char}</div>
      <div class="pinyin-line">${t.pinyin} · ${codes.join(' / ')}</div>
      ${renderCodeSlots()}
    </div>
  `
}

function renderSessionSummary() {
  return `
    <div class="complete-banner">
      <h2>时间到</h2>
      <p>
        练了 ${state.correct} 字 · 准确率 ${accuracy()}% · ${cpm()} 字/分
        ${state.mode !== 'character' ? ` · 完成 ${state.passagesDone} 篇` : ''}
      </p>
      <div class="toolbar">
        <button type="button" class="primary" id="btn-restart-timer">再练一轮</button>
      </div>
    </div>
  `
}

function renderPassageNav() {
  const canPrev = state.historyIndex > 0
  const canNext = true
  return `
    <div class="passage-nav">
      <button type="button" class="nav-icon" id="btn-prev-passage" ${canPrev ? '' : 'disabled'} aria-label="上一篇">‹</button>
      <button type="button" class="nav-icon" id="btn-next-passage-nav" ${canNext ? '' : 'disabled'} aria-label="下一篇">›</button>
    </div>
  `
}

function renderPassageStage() {
  if (!state.passage) return ''
  if (state.sessionFinished) return renderSessionSummary()

  if (state.completed) {
    const hasMistakes = state.passageWrong > 0
    return `
      <div class="complete-banner">
        <h2>${hasMistakes ? '本篇完成' : '全部正确！'}</h2>
        <p>${state.autoAdvanceNote || `准确率 ${accuracy()}% · ${cpm()} 字/分`}</p>
        <div class="toolbar">
          ${hasMistakes ? `<button type="button" id="btn-redo-passage">重练本篇 <kbd class="btn-kbd">⌥R</kbd></button>` : ''}
          <button type="button" class="primary" id="btn-next-passage">下一篇 <kbd class="btn-kbd">⌥N</kbd></button>
        </div>
      </div>
    `
  }

  const currentUnit = state.units[state.unitIndex]
  const currentIndex = currentUnit?.index ?? -1
  const doneIndexes = new Set(
    state.units.slice(0, state.unitIndex).map((u) => u.index),
  )

  const page = state.pages[state.pageIndex] || { start: 0, end: state.units.length }
  const pageUnits = state.units.slice(page.start, page.end)
  const startChar = pageUnits[0]?.index ?? 0
  const endChar = pageUnits[pageUnits.length - 1]?.index ?? 0

  const chars = [...state.passage.text]
    .map((ch, i) => {
      if (i < startChar || i > endChar) return ''
      const classes = ['ch']
      if (doneIndexes.has(i)) classes.push('done')
      if (i === currentIndex) classes.push('current')
      if (ch === ' ' || ch === '\u3000') classes.push('ch-space')
      const show = ch === ' ' || ch === '\u3000' ? '&nbsp;' : escapeHtml(ch)
      return `<span class="${classes.join(' ')}" data-i="${i}">${show}</span>`
    })
    .join('')

  const codes = currentCodes()
  const multiPage = state.pages.length > 1
  const progress = `${state.unitIndex}/${state.units.length}${state.passageWrong ? ` · 错 ${state.passageWrong}` : ''}`

  return `
    <div class="char-stage passage-stage">
      <div class="passage-meta">
        <div class="passage-title-row">
          ${renderPassageNav()}
          <span class="title">${state.passage.title}${settings.smartPractice ? ' · 智能' : ''}</span>
          <span class="passage-progress">${progress}</span>
        </div>
        <div class="passage-actions">
          <label class="ghost-chip upload-chip" title="上传文本 / PDF / EPUB / 图片">
            ${state.uploadBusy ? '解析中…' : '上传文章'}
            <input type="file" id="file-upload" accept=".txt,.md,.pdf,.epub,.png,.jpg,.jpeg,.webp,.gif,text/plain,application/pdf,application/epub+zip,image/*" hidden ${state.uploadBusy ? 'disabled' : ''} />
          </label>
        </div>
      </div>
      ${
        multiPage
          ? `<div class="page-bar">
              <button type="button" class="nav-icon" id="btn-prev-page" ${state.pageIndex > 0 ? '' : 'disabled'} aria-label="上一页">‹</button>
              <span class="page-label">第 ${state.pageIndex + 1}/${state.pages.length} 页</span>
              <button type="button" class="nav-icon" id="btn-next-page" ${state.pageIndex < state.pages.length - 1 ? '' : 'disabled'} aria-label="下一页">›</button>
            </div>`
          : ''
      }
      <div class="passage-scroll">
        <div class="passage poem">${chars}</div>
      </div>
      <div class="typing-chrome">
        <div class="pinyin-line">${currentUnit ? `${currentUnit.pinyin} · ${codes.join(' / ')}` : ''}</div>
        ${renderCodeSlots()}
      </div>
      ${state.uploadMessage ? `<p class="upload-msg">${state.uploadMessage}</p>` : ''}
    </div>
  `
}

function render() {
  const modeButtons = MODES.map(
    (m) =>
      `<button type="button" data-mode="${m.id}" class="${state.mode === m.id ? 'active' : ''}">${m.label}</button>`,
  ).join('')

  const stage =
    state.mode === 'character' ? renderCharacterStage() : renderPassageStage()

  const drawer =
    state.drawer === 'mistakes'
      ? renderMistakesDrawer()
      : state.drawer === 'settings'
        ? renderSettingsDrawer()
        : ''

  const mistakeCount = loadMistakes().length
  const speakLabel = state.mode === 'character' ? '读音' : '朗读'
  const speakHint =
    state.mode === 'character'
      ? '<span><kbd>读音</kbd> 按钮听当前字</span>'
      : '<span><kbd>朗读</kbd> 按钮读当前字</span>'

  app.innerHTML = `
    <header class="topbar">
      <div class="brand brand-modes">
        <nav class="mode-tabs" aria-label="练习模式">${modeButtons}</nav>
        <button type="button" class="scheme scheme-btn" id="btn-cycle-scheme" title="点击切换输入方案">${getSchemeLabel(settings.scheme)}</button>
      </div>
      <div class="top-actions top-actions-meta">
        <button type="button" class="ghost-chip" id="btn-open-mistakes">错字本${mistakeCount ? ` · ${mistakeCount}` : ''}</button>
        <button type="button" class="ghost-chip" id="btn-open-settings">设置</button>
      </div>
    </header>
    ${renderTimerBar()}
    ${renderStats()}
    <main class="main">
      <section class="practice-card enter" id="practice-card" tabindex="0">
        ${stage}
        <div class="hints-row hints-row-bottom">
          ${speakHint}
          <span><kbd>Esc</kbd> 清空当前输入</span>
          <span><kbd>⌥R</kbd> 重练 · <kbd>⌥N</kbd> 下一篇</span>
        </div>
        <input id="key-mirror" class="input-mirror" autocomplete="off" autocapitalize="off" spellcheck="false" />
      </section>
      <div class="toolbar">
        <button type="button" id="btn-skip">跳过</button>
        <button type="button" id="btn-speak">${speakLabel}</button>
        <button type="button" id="btn-reset">重置统计</button>
        <button type="button" id="btn-hints">${settings.showHints ? '隐藏键位提示' : '显示键位提示'}</button>
        <button type="button" id="kb-toggle">${settings.keyboardCovered ? '显示键盘' : '遮盖键盘'}</button>
      </div>
      ${renderKeyboard()}
    </main>
    <p class="footer-note">本地练习 · 偏好与错字本已自动保存</p>
    ${state.drawer ? `<div class="drawer-backdrop" id="drawer-backdrop"></div>${drawer}` : ''}
  `

  bindEvents()
  state.drawerJustOpened = false
  requestAnimationFrame(() => {
    document.querySelector('.practice-card')?.classList.remove('enter')
  })
}

function restartRound() {
  resetSessionStats()
  if (state.mode === 'character') nextCharacter()
  else {
    state.passageHistory = []
    state.historyIndex = -1
    startPassage(state.mode)
  }
  if (settings.timerMode !== 'off') startSession()
  render()
  focusApp()
}

function cycleScheme() {
  const ids = SCHEME_OPTIONS.map((s) => s.id)
  const i = Math.max(0, ids.indexOf(settings.scheme))
  const next = ids[(i + 1) % ids.length]
  applySettingsPatch({ scheme: next })
  focusApp()
}

function handleCompletionShortcut(e) {
  if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return false
  if (!state.completed || state.sessionFinished || state.drawer) return false
  if (e.code === 'KeyR') {
    e.preventDefault()
    e.stopPropagation()
    redoCurrentPassage()
    return true
  }
  if (e.code === 'KeyN') {
    e.preventDefault()
    e.stopPropagation()
    if (!state.sessionFinished) goNextPassage()
    return true
  }
  return false
}

function bindEvents() {
  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode))
  })

  document.querySelectorAll('[data-duration]').forEach((btn) => {
    btn.addEventListener('click', () => setDuration(btn.dataset.duration))
  })

  document.querySelector('#custom-duration')?.addEventListener('change', (e) => {
    setDuration(e.target.value)
  })

  bindTimerButtons()

  document.querySelector('#kb-toggle')?.addEventListener('click', () => {
    applySettingsPatch({ keyboardCovered: !settings.keyboardCovered })
  })

  document.querySelector('#btn-skip')?.addEventListener('click', () => {
    if (state.sessionFinished) return
    clearAdvanceTimer()
    if (state.mode === 'character') {
      nextCharacter()
      render()
    } else {
      goNextPassage()
    }
    focusApp()
  })

  document.querySelector('#btn-speak')?.addEventListener('click', speakCurrent)

  document.querySelector('#btn-reset')?.addEventListener('click', () => {
    resetSessionStats()
    if (state.mode === 'character') nextCharacter()
    else {
      state.passageHistory = []
      state.historyIndex = -1
      startPassage(state.mode)
    }
    render()
    focusApp()
  })

  document.querySelector('#btn-hints')?.addEventListener('click', () => {
    applySettingsPatch({ showHints: !settings.showHints })
  })

  document.querySelector('#btn-next-passage')?.addEventListener('click', () => {
    if (state.sessionFinished) return
    goNextPassage()
  })

  document.querySelector('#btn-redo-passage')?.addEventListener('click', () => {
    if (state.sessionFinished) return
    redoCurrentPassage()
  })

  document.querySelector('#btn-prev-passage')?.addEventListener('click', goPrevPassage)
  document.querySelector('#btn-next-passage-nav')?.addEventListener('click', goNextPassage)
  document.querySelector('#btn-prev-page')?.addEventListener('click', () => goPage(-1))
  document.querySelector('#btn-next-page')?.addEventListener('click', () => goPage(1))

  const wireUpload = (id) => {
    document.querySelector(id)?.addEventListener('change', (e) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (file) handleUploadedFile(file)
    })
  }
  wireUpload('#file-upload')
  wireUpload('#file-upload-settings')

  document.querySelectorAll('[data-remove-doc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      removeUserDoc(btn.dataset.removeDoc)
      render()
    })
  })

  document.querySelector('#btn-cycle-scheme')?.addEventListener('click', () => {
    cycleScheme()
  })
  document.querySelector('#btn-open-mistakes')?.addEventListener('click', () => openDrawer('mistakes'))
  document.querySelector('#btn-open-settings')?.addEventListener('click', () => openDrawer('settings'))
  document.querySelector('#drawer-backdrop')?.addEventListener('click', closeDrawer)
  document.querySelectorAll('#btn-close-drawer').forEach((btn) => {
    btn.addEventListener('click', closeDrawer)
  })

  document.querySelector('#btn-clear-mistakes')?.addEventListener('click', () => {
    clearMistakes()
    render()
  })

  document.querySelector('#btn-practice-mistakes')?.addEventListener('click', () => {
    settings = saveSettings({ smartPractice: true })
    state.drawer = null
    state.passageHistory = []
    state.historyIndex = -1
    if (state.mode === 'character') nextCharacter()
    else startPassage(state.mode)
    render()
    focusApp()
  })

  // Settings controls — keep drawer open
  document.querySelector('#set-smart')?.addEventListener('change', (e) => {
    applySettingsPatch({ smartPractice: e.target.checked })
  })
  document.querySelectorAll('input[name="timerMode"]').forEach((el) => {
    el.addEventListener('change', (e) => {
      if (e.target.checked) applySettingsPatch({ timerMode: e.target.value })
    })
  })
  document.querySelector('#set-duration')?.addEventListener('change', (e) => {
    applySettingsPatch({ durationMinutes: Number(e.target.value) || 5 })
  })
  document.querySelector('#set-page-chars')?.addEventListener('change', (e) => {
    applySettingsPatch({
      charsPerPage: Math.max(20, Math.min(300, Number(e.target.value) || 80)),
    })
  })
  document.querySelectorAll('input[name="scheme"]').forEach((el) => {
    el.addEventListener('change', (e) => {
      if (e.target.checked) applySettingsPatch({ scheme: e.target.value })
    })
  })
  document.querySelector('#set-hints')?.addEventListener('change', (e) => {
    applySettingsPatch({ showHints: e.target.checked })
  })
  document.querySelector('#set-cover')?.addEventListener('change', (e) => {
    applySettingsPatch({ keyboardCovered: e.target.checked })
  })
  document.querySelector('#set-speak')?.addEventListener('change', (e) => {
    applySettingsPatch({ speakOnCorrect: e.target.checked })
  })
  document.querySelector('#set-speak-sentence')?.addEventListener('change', (e) => {
    applySettingsPatch({ speakOnSentenceClick: e.target.checked })
  })
  document.querySelectorAll('input[name="speak-limit-mode"]').forEach((el) => {
    el.addEventListener('change', (e) => {
      if (e.target.checked) {
        applySettingsPatch({ speakLimitMode: e.target.value === 'count' ? 'count' : 'time' })
      }
    })
  })
  document.querySelector('#set-speak-minutes')?.addEventListener('change', (e) => {
    applySettingsPatch({ speakMaxMinutes: Number(e.target.value) || 5 })
  })
  document.querySelector('#set-speak-min-minutes')?.addEventListener('change', (e) => {
    applySettingsPatch({ speakMinMinutes: Number(e.target.value) || 1 })
  })
  document.querySelector('#set-speak-count')?.addEventListener('change', (e) => {
    applySettingsPatch({ speakMaxCount: Number(e.target.value) || 200 })
  })
  document.querySelector('#set-speak-min-count')?.addEventListener('change', (e) => {
    applySettingsPatch({ speakMinCount: Number(e.target.value) || 60 })
  })
  document.querySelector('#set-auto-advance')?.addEventListener('change', (e) => {
    applySettingsPatch({ autoAdvancePerfect: e.target.checked })
  })
  document.querySelector('#set-auto-advance-mistakes')?.addEventListener('change', (e) => {
    applySettingsPatch({ autoAdvanceWithMistakes: e.target.checked })
  })

  const mirror = document.querySelector('#key-mirror')
  const card = document.querySelector('#practice-card')
  card?.addEventListener('click', focusApp)
  mirror?.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (handleCompletionShortcut(e)) return
    if (e.key === 'Escape') {
      e.preventDefault()
      if (state.drawer) {
        closeDrawer()
        return
      }
      state.buffer = ''
      patchLive()
      return
    }
    if (e.key === 'Backspace') {
      e.preventDefault()
      state.buffer = state.buffer.slice(0, -1)
      patchLive()
      return
    }
    if (e.key.length === 1) {
      e.preventDefault()
      handleKey(e.key)
    }
  })

  focusApp()
}

/** Boot 双拼 practice (only when this track is active).
 * @param {HTMLElement} [root]
 */
export function bootShuangpin(root) {
  if (root) app = root
  document.title = '拼写练习'
  document.documentElement.lang = 'zh-CN'

  window.addEventListener('keydown', (e) => {
    if (handleCompletionShortcut(e)) return
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (e.key === 'Escape') {
      if (state.drawer) {
        closeDrawer()
        return
      }
      state.buffer = ''
      patchLive()
      return
    }
    if (state.drawer) return
    if (e.key.length === 1 && isPracticeTypingKey(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      handleKey(e.key)
    }
  })

  if (tickHandle) clearInterval(tickHandle)
  tickHandle = setInterval(() => {
    updateTimerDisplay()
    if (!state.startedAt || state.sessionFinished) return
    patchStats()
  }, 250)

  if (import.meta.env.DEV) {
    const results = selfTestScheme('xiaohe')
    const failed = results.filter((r) => !r.ok)
    if (failed.length) console.warn('Scheme self-test failures', failed)
    else console.info('Xiaohe self-test passed', results.length)
  }

  state.remainingMs = state.durationMinutes * 60 * 1000
  if (state.mode === 'character') nextCharacter()
  else startPassage(state.mode)

  render()
}
