/**
 * English typing practice — fully isolated from 双拼 (settings / mistakes / library / stats).
 */

import {
  loadEnglishSettings,
  saveEnglishSettings,
  DEFAULT_ENGLISH_SETTINGS,
  EN_KEYBOARD_EXPLICIT_KEY,
} from './settings.js'
import {
  ENGLISH_WORDS,
  ENGLISH_SENTENCES,
  ENGLISH_ARTICLES,
  buildEnglishUnits,
  buildEnglishPages,
  pageIndexForUnit,
  countEnglishChars,
  countEnglishWords,
  fitEnglishPassage,
} from './data.js'
import {
  loadEnglishMistakes,
  recordEnglishMistake,
  clearEnglishMistakes,
  summarizeEnglishMistakes,
  smartEnglishWordPool,
  uniqueEnglishMistakeWords,
  wordSpanAroundIndex,
} from './mistakes.js'
import { loadEnglishLibrary, addEnglishDoc, removeEnglishDoc } from './library.js'
import { extractFromFile } from '../upload.js'
import { isTypablePunct, punctTypingKey, isTypableSpace } from '../punct.js'
import { renderAnsiKeyboardRows, resolveHintKeys } from '../keyboard.js'
import { speakBudgetFromMinutes } from '../speaking/length.js'
import { scrollTypingFocusIntoView } from '../scrollTypingFocus.js'
import { speakText, cancelSpeech, isSpeechPlaying } from '../speaking/speech.js'
import { installViewportKeyboardSync } from '../viewport.js'
import {
  bindStatsDisclosure,
  consumePendingDrawer,
  isPhoneViewport,
  patchStatsSummary,
  registerDrawerHandlers,
  registerModeControl,
  renderMobilePracticeActions,
  syncBottomTabActive,
  syncModeControl,
  syncPracticeSpeakButtons,
  wrapCollapsibleStats,
} from '../mobileNav.js'

const STORAGE_MODE = 'english-practice-mode'
const STORAGE_BEST = 'english-best-combo'
const STORAGE_RECENT_SENTENCES = 'english-recent-sentences'
const SENTENCE_REPEAT_WINDOW = 30

const MODES = [
  { id: 'word', label: 'Words' },
  { id: 'sentence', label: 'Sentences' },
  { id: 'article', label: 'Articles' },
]

const DURATION_PRESETS = [3, 5, 10, 15]
const IDLE_PAUSE_MS = 60_000

function loadMode() {
  const saved = localStorage.getItem(STORAGE_MODE)
  if (MODES.some((m) => m.id === saved)) return saved
  return 'sentence'
}

function saveMode(mode) {
  localStorage.setItem(STORAGE_MODE, mode)
}

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

function loadRecentSentences() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_RECENT_SENTENCES) || '[]')
    return Array.isArray(parsed)
      ? parsed.filter((text) => typeof text === 'string').slice(-SENTENCE_REPEAT_WINDOW)
      : []
  } catch {
    return []
  }
}

function rememberSentence(text) {
  const recent = loadRecentSentences().filter((item) => item !== text)
  recent.push(text)
  try {
    localStorage.setItem(
      STORAGE_RECENT_SENTENCES,
      JSON.stringify(recent.slice(-SENTENCE_REPEAT_WINDOW)),
    )
  } catch {
    /* Practice still works when storage is unavailable. */
  }
}

function pickSentence() {
  const recent = new Set(loadRecentSentences())
  let candidates = ENGLISH_SENTENCES.filter((sentence) => !recent.has(sentence.text))
  // Defensive fallback if the content bank ever becomes smaller than the window.
  if (!candidates.length) {
    const oldest = loadRecentSentences()[0]
    candidates = ENGLISH_SENTENCES.filter((sentence) => sentence.text === oldest)
  }
  const picked = shufflePick(candidates, null)
  if (picked) rememberSentence(picked.text)
  return picked
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

/**
 * @param {HTMLElement} root
 */
export function bootEnglish(root) {
  let settings = loadEnglishSettings()

  const state = {
    mode: loadMode(),
    correct: 0,
    wrong: 0,
    combo: 0,
    best: Number(localStorage.getItem(STORAGE_BEST) || 0),
    startedAt: null,
    keystrokes: 0,
    passage: null,
    units: [],
    unitIndex: 0,
    completed: false,
    passageWrong: 0,
    passagesDone: 0,
    durationMinutes: settings.durationMinutes || DEFAULT_ENGLISH_SETTINGS.durationMinutes,
    sessionEndsAt: null,
    sessionActive: false,
    sessionFinished: false,
    sessionPaused: false,
    remainingMs: 0,
    lastActivityAt: 0,
    pauseStartedAt: null,
    pausedAccumMs: 0,
    autoAdvanceNote: '',
    autoPaused: false,
    pages: [{ start: 0, end: 0 }],
    pageIndex: 0,
    uploadBusy: false,
    uploadMessage: '',
    passageHistory: [],
    historyIndex: -1,
    drawer: null,
    drawerJustOpened: false,
    lastWrong: false,
    mistakesOnly: false,
    mistakeIndex: -1,
    recordedMistakeWordSpans: new Set(),
  }

  let tickHandle = null
  let advanceTimer = null

  function clearAdvanceTimer() {
    if (advanceTimer) {
      clearTimeout(advanceTimer)
      advanceTimer = null
    }
  }

  function currentTarget() {
    return state.units[state.unitIndex] || null
  }

  function matchesExpected(typed, expected) {
    if (isTypableSpace(expected) || expected === ' ') return typed === ' '
    if (isTypablePunct(expected)) return typed === punctTypingKey(expected)
    if (settings.caseSensitive) return typed === expected
    return typed.toLowerCase() === expected.toLowerCase()
  }

  function accuracy() {
    const total = state.correct + state.wrong
    if (!total) return 100
    return Math.round((state.correct / total) * 100)
  }

  function cpm() {
    if (!state.startedAt) return 0
    const elapsed = (performance.now() - state.startedAt - state.pausedAccumMs) / 60000
    if (elapsed <= 0) return 0
    return Math.round(state.correct / elapsed)
  }

  function wpm() {
    return Math.round(cpm() / 5)
  }

  function noteActivity() {
    state.lastActivityAt = performance.now()
    if (state.sessionActive && state.sessionPaused && state.autoPaused && !state.sessionFinished) {
      resumeSession()
    }
  }

  function startSession() {
    if (state.sessionActive && !state.sessionPaused) return
    if (state.sessionActive && state.sessionPaused) {
      resumeSession()
      return
    }
    state.sessionActive = true
    state.sessionFinished = false
    state.sessionPaused = false
    state.autoPaused = false
    state.pausedAccumMs = 0
    state.pauseStartedAt = null
    state.remainingMs = state.durationMinutes * 60 * 1000
    state.sessionEndsAt = performance.now() + state.remainingMs
    state.lastActivityAt = performance.now()
    if (!state.startedAt) state.startedAt = performance.now()
  }

  function pauseSession({ auto = false } = {}) {
    if (!state.sessionActive || state.sessionFinished || state.sessionPaused) return
    state.sessionPaused = true
    state.autoPaused = auto
    state.pauseStartedAt = performance.now()
    if (state.sessionEndsAt) {
      state.remainingMs = Math.max(0, state.sessionEndsAt - performance.now())
    }
  }

  function resumeSession() {
    if (!state.sessionActive || state.sessionFinished || !state.sessionPaused) return
    if (state.pauseStartedAt) {
      state.pausedAccumMs += performance.now() - state.pauseStartedAt
    }
    state.sessionPaused = false
    state.autoPaused = false
    state.pauseStartedAt = null
    state.sessionEndsAt = performance.now() + state.remainingMs
    state.lastActivityAt = performance.now()
  }

  function resetTimerClock() {
    if (state.sessionActive && !state.sessionPaused) {
      state.remainingMs = Math.max(0, (state.sessionEndsAt || 0) - performance.now())
    }
    state.lastActivityAt = performance.now()
    state.sessionEndsAt = performance.now() + state.remainingMs
    const el = document.querySelector('#timer-value')
    if (el) {
      el.textContent = formatTime(state.remainingMs)
      el.classList.remove('paused')
    }
  }

  function endSession() {
    state.sessionActive = false
    state.sessionFinished = true
    state.sessionPaused = false
    state.autoPaused = false
    if (state.sessionEndsAt) {
      state.remainingMs = Math.max(0, state.sessionEndsAt - performance.now())
    }
    clearAdvanceTimer()
    render()
  }

  function updateTimerDisplay() {
    if (!state.sessionActive || state.sessionFinished) return
    if (state.sessionPaused) return
    const left = Math.max(0, (state.sessionEndsAt || 0) - performance.now())
    state.remainingMs = left
    if (
      state.lastActivityAt &&
      performance.now() - state.lastActivityAt >= IDLE_PAUSE_MS
    ) {
      pauseSession({ auto: true })
      renderTimerControls()
      return
    }
    if (left <= 0) {
      endSession()
      return
    }
    const el = document.querySelector('#timer-value')
    if (el) {
      el.textContent = formatTime(left)
      el.classList.toggle('urgent', left < 30000)
    }
  }

  function renderTimerControls() {
    const host = document.querySelector('.timer-right')
    if (host) host.innerHTML = timerRightHtml()
    bindTimerButtons()
  }

  function timerRightHtml() {
    if (settings.timerMode === 'off') {
      return `
        <span class="timer-value idle" id="timer-value">No timer</span>
        <div class="timer-actions"><span class="timer-hint">Free practice</span></div>
      `
    }

    let status
    let actions
    if (state.sessionFinished) {
      status = `<span class="timer-value done">Done</span>`
    } else if (state.sessionActive && state.sessionPaused) {
      status = `<span class="timer-value paused" id="timer-value">${formatTime(state.remainingMs)}${state.autoPaused ? ' · idle' : ' · paused'}</span>`
    } else if (state.sessionActive) {
      status = `<span class="timer-value ${state.remainingMs < 30000 ? 'urgent' : ''}" id="timer-value">${formatTime(state.remainingMs)}</span>`
    } else {
      status = `<span class="timer-value idle" id="timer-value">${formatTime(state.durationMinutes * 60 * 1000)}</span>`
    }

    const iconPause = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`
    const iconPlay = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7L8 5z"/></svg>`
    const iconReset = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.2"/><path d="M21 3v7h-7"/></svg>`
    const iconEnd = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`

    if (state.sessionFinished) {
      actions = `<button type="button" class="primary" data-restart>Restart</button>`
    } else if (state.sessionActive) {
      actions = `
        <button type="button" class="icon-btn" id="btn-pause-timer" aria-label="${state.sessionPaused ? 'Resume' : 'Pause'}">${state.sessionPaused ? iconPlay : iconPause}</button>
        <button type="button" class="icon-btn" id="btn-reset-timer" aria-label="Reset timer">${iconReset}</button>
        <button type="button" class="icon-btn icon-btn-danger" id="btn-end-timer" aria-label="End">${iconEnd}</button>
      `
    } else if (settings.timerMode === 'manual') {
      actions = `<button type="button" class="primary" id="btn-start-timer">Start timer</button>`
    } else {
      actions = `<span class="timer-hint">Starts when you type</span>`
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
      renderTimerControls()
    })
    document.querySelector('#btn-reset-timer')?.addEventListener('click', () => {
      state.remainingMs = state.durationMinutes * 60 * 1000
      resetTimerClock()
      renderTimerControls()
    })
    document.querySelectorAll('[data-restart]').forEach((btn) => {
      btn.addEventListener('click', restartRound)
    })
  }

  function articleLengthBounds() {
    if (settings.speakLimitMode === 'count') {
      let min = Math.max(1, Number(settings.speakMinCount) || 40)
      let max = Math.max(1, Number(settings.speakMaxCount) || 150)
      if (min > max) min = max
      return { min, max }
    }
    const min = speakBudgetFromMinutes('en', settings.speakMinMinutes || 1)
    const max = speakBudgetFromMinutes('en', settings.speakMaxMinutes || 5)
    return { min: Math.min(min, max), max: Math.max(min, max) }
  }

  function allEnglishArticleSources() {
    // Same built-in bank as speaking (`ENGLISH_ARTICLES`); user uploads on top.
    const user = loadEnglishLibrary().map((d) => ({ title: d.title, text: d.text }))
    return [...ENGLISH_ARTICLES, ...user]
  }

  function pickFittedArticle(avoid) {
    const { min, max } = articleLengthBounds()
    const sources = allEnglishArticleSources()
    if (!sources.length) return null
    const measured = sources
      .map((p) => ({ p, n: countEnglishWords(p.text) }))
      .filter((x) => x.n > 0)
    // Prefer a single article already inside [min, max]
    const inRange = measured.filter((x) => x.n >= min && x.n <= max)
    let base =
      shufflePick(
        inRange.length ? inRange.map((x) => x.p) : [],
        avoid,
      ) || null
    if (!base) {
      // Else shortest article that still meets min (will trim to max)
      const aboveMin = measured.filter((x) => x.n >= min).sort((a, b) => a.n - b.n)
      base = shufflePick(aboveMin.map((x) => x.p), avoid)
    }
    if (!base) {
      // All shorter than min — use the longest single article as-is
      const longest = [...measured].sort((a, b) => b.n - a.n)
      base = shufflePick(longest.slice(0, Math.min(5, longest.length)).map((x) => x.p), avoid)
    }
    if (!base) return null
    return fitEnglishPassage(base, min, max)
  }

  function refitCurrentArticle() {
    if (state.mode !== 'article' || !state.passage) return false
    const { min, max } = articleLengthBounds()
    const sources = allEnglishArticleSources()
    const base =
      sources.find((p) => p.title === state.passage.title) || sources[0]
    if (!base) return false
    const fitted = fitEnglishPassage(base, min, max)
    if (state.historyIndex >= 0 && state.historyIndex < state.passageHistory.length) {
      state.passageHistory[state.historyIndex] = fitted
    }
    loadPassageAt(fitted)
    return true
  }

  function pickPassage(mode) {
    if (mode === 'word') {
      if (state.mistakesOnly) {
        const words = uniqueEnglishMistakeWords()
        if (words.length) {
          state.mistakeIndex = (state.mistakeIndex + 1) % words.length
          return { title: 'Mistakes', text: words[state.mistakeIndex] }
        }
        state.mistakesOnly = false
      }
      const pool = settings.smartPractice
        ? smartEnglishWordPool(ENGLISH_WORDS)
        : ENGLISH_WORDS
      const word = shufflePick(pool, state.passage?.text)
      return { title: 'Word', text: String(word) }
    }
    if (mode === 'article') {
      return pickFittedArticle(state.passage)
    }
    return pickSentence()
  }

  function loadPassageAt(passage) {
    state.passage = passage
    state.units = buildEnglishUnits(passage.text)
    state.pages = buildEnglishPages(state.units, settings.charsPerPage)
    state.pageIndex = 0
    state.unitIndex = 0
    state.completed = false
    state.passageWrong = 0
    state.autoAdvanceNote = ''
    state.lastWrong = false
    state.recordedMistakeWordSpans = new Set()
  }

  function startPassage(mode, { pushHistory = true } = {}) {
    const passage = pickPassage(mode)
    if (!passage) return
    if (pushHistory) {
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

  function goPage(delta) {
    const next = state.pageIndex + delta
    if (next < 0 || next >= state.pages.length) return
    state.pageIndex = next
    const page = state.pages[state.pageIndex]
    if (state.unitIndex < page.start || state.unitIndex >= page.end) {
      state.unitIndex = page.start
    }
    clearAdvanceTimer()
    render()
    focusApp()
    requestAnimationFrame(scrollCurrentIntoView)
  }

  function resetSessionStats() {
    state.correct = 0
    state.wrong = 0
    state.combo = 0
    state.startedAt = null
    state.keystrokes = 0
    state.completed = false
    state.passageWrong = 0
    state.passagesDone = 0
    state.autoAdvanceNote = ''
    state.sessionActive = false
    state.sessionFinished = false
    state.sessionPaused = false
    state.autoPaused = false
    state.pausedAccumMs = 0
    state.pauseStartedAt = null
    state.lastActivityAt = 0
    state.remainingMs = state.durationMinutes * 60 * 1000
    clearAdvanceTimer()
  }

  function setMode(mode) {
    state.mistakesOnly = false
    state.mistakeIndex = -1
    state.mode = mode
    saveMode(mode)
    clearAdvanceTimer()
    state.passageHistory = []
    state.historyIndex = -1
    startPassage(mode)
    render()
    focusApp()
  }

  function setDuration(mins) {
    const n = Math.min(60, Math.max(1, Math.round(Number(mins) || 5)))
    state.durationMinutes = n
    settings = saveEnglishSettings({ durationMinutes: n })
    if (!state.sessionActive) state.remainingMs = n * 60 * 1000
    render()
    focusApp()
  }

  function applySettingsPatch(patch, opts) {
    settings = saveEnglishSettings(patch, opts)
    if (patch.durationMinutes != null) {
      state.durationMinutes = settings.durationMinutes
      if (!state.sessionActive) state.remainingMs = state.durationMinutes * 60 * 1000
    }
    if (patch.timerMode === 'off') {
      state.sessionActive = false
      state.sessionFinished = false
      state.sessionPaused = false
      state.autoPaused = false
      state.pauseStartedAt = null
      state.completed = false
    }
    if (patch.charsPerPage != null && state.units.length) {
      state.pages = buildEnglishPages(state.units, settings.charsPerPage)
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

    if (
      Object.prototype.hasOwnProperty.call(patch, 'keyboardCovered') &&
      Object.keys(patch).every((k) => k === 'keyboardCovered')
    ) {
      document.querySelector('.keyboard')?.classList.toggle('covered', settings.keyboardCovered)
      const kbToggle = document.querySelector('#kb-toggle')
      if (kbToggle) {
        kbToggle.textContent = settings.keyboardCovered ? 'Show keyboard' : 'Hide keyboard'
      }
      const coverCheckbox = document.querySelector('#set-cover')
      if (coverCheckbox instanceof HTMLInputElement) {
        coverCheckbox.checked = settings.keyboardCovered
      }
      return
    }

    if (patch.charsPerPage != null || patch.timerMode != null) {
      render()
      return
    }

    if (state.drawer === 'settings') {
      if (lengthChanged) {
        render()
      }
      return
    }
    render()
    focusApp()
  }

  function ensureSession() {
    if (state.sessionFinished) return true
    if (state.sessionActive) return true
    if (settings.timerMode === 'off' || settings.timerMode === 'manual') {
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
    clearAdvanceTimer()
    loadPassageAt(state.passage)
    render()
    focusApp()
  }

  function onPassageComplete() {
    state.completed = true
    state.passagesDone += 1
    const clean = state.passageWrong === 0
    const shouldAdvance =
      (clean && settings.autoAdvancePerfect) ||
      (!clean && settings.autoAdvanceWithMistakes)

    if (shouldAdvance) {
      clearAdvanceTimer()
      state.autoAdvanceNote = clean ? 'Perfect — next…' : 'Next with mistakes…'
      render()
      advanceTimer = setTimeout(() => {
        state.autoAdvanceNote = ''
        goNextPassage()
      }, 900)
      return
    }
    state.autoAdvanceNote = clean ? '' : 'Mistakes found — retry or continue'
    render()
  }

  function onCorrectChar() {
    state.correct += 1
    state.combo += 1
    state.lastWrong = false
    if (state.combo > state.best) {
      state.best = state.combo
      localStorage.setItem(STORAGE_BEST, String(state.best))
    }
    if (settings.speakOnCorrect) speakCurrent()

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

  function onWrongKey(typed) {
    const target = currentTarget()
    // Punctuation / space errors still count for accuracy, but are not saved to Mistakes.
    if (
      target &&
      state.passage &&
      !isTypablePunct(target.char) &&
      !isTypableSpace(target.char)
    ) {
      const span = wordSpanAroundIndex(state.passage.text, target.index)
      const key = `${span.word.toLowerCase()}|${span.start}|${span.end}`
      if (span.word && !state.recordedMistakeWordSpans.has(key)) {
        state.recordedMistakeWordSpans.add(key)
        recordEnglishMistake({
          word: span.word,
          char: span.word,
          expected: span.word,
          typed: typed === ' ' ? 'space' : typed,
          mode: state.mode,
        })
      }
    }
    state.wrong += 1
    state.passageWrong += 1
    state.combo = 0
    state.lastWrong = true
    patchLive()
  }

  function handleKey(key) {
    if (state.sessionFinished) return
    if (state.drawer) return
    if (state.completed) return
    const target = currentTarget()
    if (!target) return

    ensureSession()
    noteActivity()
    state.keystrokes += 1

    if (matchesExpected(key, target.char)) onCorrectChar()
    else onWrongKey(key)
  }

  function speakCurrent() {
    const t = currentTarget()
    if (!t) return
    void speakText(t.char === ' ' ? 'space' : t.char, 'en', 1)
  }

  function syncSpeakUi(speaking) {
    syncPracticeSpeakButtons({
      speaking,
      speakLabel: 'Read aloud',
      stopLabel: 'Stop',
    })
  }

  function toggleSpeakPassage() {
    if (isSpeechPlaying()) {
      cancelSpeech()
      syncSpeakUi(false)
      return
    }
    if (!state.passage?.text) return
    syncSpeakUi(true)
    speakText(state.passage.text, 'en', 0.95, () => syncSpeakUi(false))
  }

  function speakPassage() {
    toggleSpeakPassage()
  }

  function focusApp() {
    if (state.drawer) return
    document.querySelector('#key-mirror')?.focus({ preventScroll: true })
  }

  function openDrawer(name) {
    state.drawer = name
    state.drawerJustOpened = true
    render()
    syncBottomTabActive()
  }

  function closeDrawer() {
    state.drawer = null
    render()
    focusApp()
    syncBottomTabActive()
  }

  function scrollCurrentIntoView() {
    scrollTypingFocusIntoView({
      unitIndex: state.unitIndex,
      unitCount: state.units.length,
      selector: '.passage-scroll .ch.current',
    })
  }

  function patchLive() {
    if (!state.passage || state.completed || state.sessionFinished) return
    const currentIndex = state.units[state.unitIndex]?.index ?? -1
    const doneIndexes = new Set(state.units.slice(0, state.unitIndex).map((u) => u.index))
    document.querySelectorAll('.passage .ch').forEach((el) => {
      const i = Number(el.dataset.i)
      el.classList.toggle('done', doneIndexes.has(i))
      el.classList.toggle('current', i === currentIndex)
      el.classList.toggle('wrong', state.lastWrong && i === currentIndex)
    })
    const metaProg = document.querySelector('.passage-progress')
    if (metaProg) {
      metaProg.textContent = `${state.unitIndex}/${state.units.length}${
        state.passageWrong ? ` · err ${state.passageWrong}` : ''
      }`
    }
    const hint = document.querySelector('.pinyin-line')
    if (hint) {
      // Sentence/article: whole-word suggestion; word mode keeps single-letter cue.
      if (state.mode === 'word') {
        const t = currentTarget()
        hint.textContent = t ? displayChar(t.char) : ''
      } else {
        hint.innerHTML = suggestionHintHtml()
      }
    }
    patchKeyboardHints()
    patchStats()
    scrollCurrentIntoView()
  }

  function displayChar(ch) {
    if (ch === ' ') return 'space'
    if (ch === '\n') return '↵'
    return ch
  }

  /**
   * Bottom suggestion for sentence/article: the whole word (current letter marked),
   * while keyboard hints stay on the single expected key.
   */
  function suggestionHintHtml() {
    const t = currentTarget()
    if (!t || !state.passage) return ''
    const ch = t.char
    if (isTypableSpace(ch) || ch === ' ') return 'space'
    if (isTypablePunct(ch) || ch === '\n') return escapeHtml(displayChar(ch))
    if (!/[A-Za-z0-9']/.test(ch)) return escapeHtml(displayChar(ch))

    const chars = [...state.passage.text]
    let start = t.index
    let end = t.index
    while (start > 0 && /[A-Za-z0-9']/.test(chars[start - 1])) start -= 1
    while (end < chars.length - 1 && /[A-Za-z0-9']/.test(chars[end + 1])) end += 1
    const wordChars = chars.slice(start, end + 1)
    const offset = t.index - start
    return wordChars
      .map((c, i) => {
        const safe = escapeHtml(c)
        return i === offset ? `<span class="hint-current-letter">${safe}</span>` : safe
      })
      .join('')
  }

  function patchStats() {
    const values = document.querySelectorAll('.stat .value')
    if (values.length < 6) return
    values[0].textContent = String(state.correct)
    values[1].textContent = String(state.combo)
    values[2].textContent = String(state.best)
    values[3].textContent = `${accuracy()}%`
    values[4].textContent = String(state.startedAt ? wpm() : 0)
    values[5].textContent = String(state.keystrokes)
    patchStatsSummary()
  }

  function expectedKeyLabel() {
    const t = currentTarget()
    if (!t) return ''
    const ch = t.char
    if (isTypableSpace(ch) || ch === ' ') return ' '
    if (isTypablePunct(ch)) return punctTypingKey(ch)
    return ch.toLowerCase()
  }

  function patchKeyboardHints() {
    const want = expectedKeyLabel()
    const { keys, needShift } = resolveHintKeys(want)
    const keySet = new Set(keys)
    document.querySelectorAll('.key').forEach((el) => {
      const k = el.dataset.key
      el.classList.toggle('hint', keySet.has(k))
      el.classList.toggle('hint-shift', needShift && k === 'Shift')
    })
  }

  function renderKeyboard() {
    const want = expectedKeyLabel()
    const { keys, needShift } = resolveHintKeys(want)
    const keySet = new Set(keys)
    const rows = renderAnsiKeyboardRows({
      lang: 'en',
      tag: 'button',
      extraClasses: (key) => {
        const parts = []
        if (keySet.has(key.id)) parts.push('hint')
        if (needShift && key.id === 'Shift') parts.push('hint-shift')
        return parts.join(' ')
      },
      renderInner: (key) => (key.id === ' ' ? 'space' : escapeHtml(key.label)),
    })

    return `
      <div class="keyboard-wrap">
        <div class="keyboard keyboard-full ${settings.keyboardCovered ? 'covered' : ''}">${rows}</div>
      </div>
    `
  }

  async function handleUploadedFile(file) {
    if (!file || state.uploadBusy) return
    const keepDrawer = state.drawer
    state.uploadBusy = true
    state.uploadMessage = 'Parsing…'
    render()
    try {
      const extracted = await extractFromFile(file, { ocrLang: 'eng', requireHanzi: false })
      let text = extracted.text.replace(/\s+/g, ' ').trim()
      if (text.length > 120000) text = text.slice(0, 120000)
      if (!/[A-Za-z]/.test(text)) throw new Error('No English letters found in file')
      const passage = { title: extracted.title || 'Upload', text }
      addEnglishDoc(passage)
      state.mode = 'article'
      saveMode('article')
      if (state.historyIndex >= 0 && state.historyIndex < state.passageHistory.length - 1) {
        state.passageHistory = state.passageHistory.slice(0, state.historyIndex + 1)
      }
      state.passageHistory.push(passage)
      state.historyIndex = state.passageHistory.length - 1
      loadPassageAt(passage)
      state.uploadMessage = `Added “${passage.title}” · ${countEnglishWords(passage.text)} words`
      state.drawer = keepDrawer === 'settings' ? 'settings' : null
    } catch (err) {
      state.uploadMessage = err?.message || 'Upload failed'
      state.drawer = keepDrawer
    } finally {
      state.uploadBusy = false
      render()
      if (!state.drawer) focusApp()
    }
  }

  function renderTimerBar() {
    if (settings.timerMode === 'off') {
      return `
      <div class="timer-bar timer-bar-off">
        <div class="timer-bar-inner">
          <div class="timer-left">
            <span class="timer-label">Session</span>
            <span class="timer-hint">Timer off</span>
          </div>
          <div class="timer-right">${timerRightHtml()}</div>
        </div>
      </div>
    `
    }
    const presets = DURATION_PRESETS.map(
      (m) =>
        `<button type="button" class="dur-btn ${state.durationMinutes === m && !state.sessionActive ? 'active' : ''}" data-duration="${m}" ${state.sessionActive ? 'disabled' : ''}>${m} min</button>`,
    ).join('')
    return `
      <div class="timer-bar">
        <div class="timer-bar-inner">
          <div class="timer-left">
            <span class="timer-label">Session</span>
            <div class="dur-group">
              ${presets}
              <label class="custom-dur" title="Custom minutes">
                <input type="number" id="custom-duration" min="1" max="60" value="${state.durationMinutes}" ${state.sessionActive ? 'disabled' : ''} aria-label="Custom minutes" />
                <span>min</span>
              </label>
            </div>
          </div>
          <div class="timer-right">${timerRightHtml()}</div>
        </div>
      </div>
    `
  }

  function renderStats() {
    const stats = `
      <div class="stats">
        <div class="stat"><span class="label">Correct</span><span class="value">${state.correct}</span></div>
        <div class="stat"><span class="label">Streak</span><span class="value">${state.combo}</span></div>
        <div class="stat"><span class="label">Best</span><span class="value">${state.best}</span></div>
        <div class="stat"><span class="label">Accuracy</span><span class="value">${accuracy()}%</span></div>
        <div class="stat"><span class="label">Words/min</span><span class="value">${state.startedAt ? wpm() : 0}</span></div>
        <div class="stat"><span class="label">Keystrokes</span><span class="value">${state.keystrokes}</span></div>
      </div>
    `
    return wrapCollapsibleStats(stats, {
      storageKey: 'english-stats-collapsed',
      summaryLabels: { streak: 'Streak', accuracy: 'Accuracy' },
      streakValue: state.combo,
      accuracyValue: `${accuracy()}%`,
      resetLabel: 'Reset stats',
    })
  }

  function renderSessionSummary() {
    return `
      <div class="complete-banner">
        <h2>Session complete</h2>
        <p>${accuracy()}% accuracy · ${wpm()} WPM · ${state.passagesDone} passages</p>
        <div class="toolbar">
          <button type="button" class="primary" data-restart>Restart</button>
        </div>
      </div>
    `
  }

  function renderWordStage() {
    if (state.sessionFinished) return renderSessionSummary()
    if (state.completed) {
      const hasMistakes = state.passageWrong > 0
      return `
        <div class="complete-banner">
          <h2>${hasMistakes ? 'Word complete' : 'Perfect!'}</h2>
          <p>${state.autoAdvanceNote || `${accuracy()}% · ${wpm()} WPM`}</p>
          <div class="toolbar">
            ${hasMistakes ? `<button type="button" id="btn-redo-passage">Retry <kbd class="btn-kbd">⌥R</kbd></button>` : ''}
            <button type="button" class="primary" id="btn-next-passage">Next <kbd class="btn-kbd">⌥N</kbd></button>
          </div>
        </div>
      `
    }

    const word = state.passage?.text || ''
    const t = currentTarget()

    return `
      <div class="char-stage word-stage">
        <div class="mobile-stage-actions">${renderMobilePracticeActions({ skip: 'Skip', speak: 'Read aloud' })}</div>
        <div class="hanzi word-display english-word">${escapeHtml(word)}</div>
        <div class="pinyin-line">${t ? displayChar(t.char) : ''}</div>
      </div>
    `
  }

  function renderStage() {
    if (!state.passage) return ''
    if (state.mode === 'word') return renderWordStage()
    if (state.sessionFinished) return renderSessionSummary()
    if (state.completed) {
      const hasMistakes = state.passageWrong > 0
      return `
        <div class="complete-banner">
          <h2>${hasMistakes ? 'Passage complete' : 'Perfect!'}</h2>
          <p>${state.autoAdvanceNote || `${accuracy()}% · ${wpm()} WPM`}</p>
          <div class="toolbar">
            ${hasMistakes ? `<button type="button" id="btn-redo-passage">Retry <kbd class="btn-kbd">⌥R</kbd></button>` : ''}
            <button type="button" class="primary" id="btn-next-passage">Next <kbd class="btn-kbd">⌥N</kbd></button>
          </div>
        </div>
      `
    }

    const currentIndex = state.units[state.unitIndex]?.index ?? -1
    const doneIndexes = new Set(state.units.slice(0, state.unitIndex).map((u) => u.index))
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
        if (ch === ' ') classes.push('ch-space')
        if (ch === '\n') classes.push('ch-break')
        // Keep spaces as normal spaces so the passage reads like an article
        if (ch === '\n') return `<br class="${classes.join(' ')}" data-i="${i}" />`
        const shown = ch === ' ' ? ' ' : escapeHtml(ch)
        return `<span class="${classes.join(' ')}" data-i="${i}">${shown}</span>`
      })
      .join('')

    const multiPage = state.pages.length > 1
    const progress = `${state.unitIndex}/${state.units.length}${state.passageWrong ? ` · err ${state.passageWrong}` : ''}`
    const canPrev = state.historyIndex > 0

    return `
      <div class="char-stage passage-stage">
        <div class="passage-meta">
          <div class="passage-title-row">
            <div class="passage-nav">
              <button type="button" class="nav-icon" id="btn-prev-passage" ${canPrev ? '' : 'disabled'} aria-label="Previous">‹</button>
              <button type="button" class="nav-icon" id="btn-next-passage-nav" aria-label="Next">›</button>
            </div>
            <span class="title">${escapeHtml(state.passage.title)}${settings.smartPractice ? ' · smart' : ''}</span>
            <span class="passage-progress">${progress}</span>
          </div>
          <div class="passage-actions">
            <label class="ghost-chip upload-chip practice-upload-control" title="Upload" aria-label="Upload">
              <svg class="upload-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 16.5h2V8.33l3.59 3.58L18 10.5l-6-6-6 6 1.41 1.41L11 8.33v8.17ZM5 19.5h14v-2H5v2Z"/></svg>
              <span class="upload-label">${state.uploadBusy ? 'Parsing…' : 'Upload'}</span>
              <input type="file" id="file-upload" accept=".txt,.md,.pdf,.epub,.png,.jpg,.jpeg,.webp,.gif,text/plain,application/pdf,application/epub+zip,image/*" hidden ${state.uploadBusy ? 'disabled' : ''} />
            </label>
            ${renderMobilePracticeActions({ skip: 'Skip', speak: 'Read aloud' })}
          </div>
        </div>
        ${
          multiPage
            ? `<div class="page-bar">
                <button type="button" class="nav-icon" id="btn-prev-page" ${state.pageIndex > 0 ? '' : 'disabled'} aria-label="Prev page">‹</button>
                <span class="page-label">Page ${state.pageIndex + 1}/${state.pages.length}</span>
                <button type="button" class="nav-icon" id="btn-next-page" ${state.pageIndex < state.pages.length - 1 ? '' : 'disabled'} aria-label="Next page">›</button>
              </div>`
            : ''
        }
        <div class="passage-scroll">
          <div class="passage english-passage">${chars}</div>
        </div>
        <div class="typing-chrome">
          <div class="pinyin-line">${suggestionHintHtml()}</div>
        </div>
        ${state.uploadMessage ? `<p class="upload-msg">${escapeHtml(state.uploadMessage)}</p>` : ''}
      </div>
    `
  }

  function renderMistakesDrawer() {
    const summary = summarizeEnglishMistakes()
    const top = summary.topWords.length
      ? summary.topWords
          .map(
            (c) =>
              `<li><span class="m-char">${escapeHtml(c.word)}</span> <span class="m-count">${c.count}×</span></li>`,
          )
          .join('')
      : '<li class="empty">No frequent mistakes yet</li>'
    const recent = summary.recent.length
      ? summary.recent
          .map(
            (m) =>
              `<li>
                <span class="m-char">${escapeHtml(m.word || m.char)}</span>
                <span class="m-meta">wanted ${escapeHtml(m.expected || m.word || '')} · typed ${escapeHtml(m.typed || '—')}</span>
                <span class="m-time">${formatAgo(m.at)}</span>
              </li>`,
          )
          .join('')
      : '<li class="empty">No mistakes logged</li>'

    return `
      <aside class="drawer ${state.drawerJustOpened ? 'drawer-enter' : ''}" role="dialog" aria-label="Mistakes">
        <div class="drawer-head">
          <h2>Mistakes</h2>
          <button type="button" class="drawer-close" id="btn-close-drawer" aria-label="Close">×</button>
        </div>
        <div class="drawer-body">
          <p class="drawer-lead">${summary.total} errors · English only · not shared with 双拼</p>
          <section class="drawer-section">
            <h3>Often missed</h3>
            <ul class="mistake-list">${top}</ul>
          </section>
          <section class="drawer-section">
            <h3>Recent</h3>
            <ul class="mistake-list">${recent}</ul>
          </section>
        </div>
        <div class="drawer-foot">
          <button type="button" class="primary practice-all-mistakes" id="btn-practice-mistakes" ${summary.total ? '' : 'disabled'}>Practice all mistakes</button>
          <button type="button" class="btn-warning" id="btn-clear-mistakes">Clear</button>
        </div>
      </aside>
    `
  }

  function renderSettingsDrawer() {
    const lib = loadEnglishLibrary()
    return `
      <aside class="drawer ${state.drawerJustOpened ? 'drawer-enter' : ''}" role="dialog" aria-label="English settings">
        <div class="drawer-head">
          <h2>English settings</h2>
          <button type="button" class="drawer-close" id="btn-close-drawer" aria-label="Close">×</button>
        </div>
        <div class="drawer-body">
          <p class="drawer-lead">These settings apply only to English practice. Article length is measured in words.</p>
          <section class="drawer-section">
            <h3>Practice</h3>
            <label class="opt-row">
              <input type="checkbox" id="set-smart" ${settings.smartPractice ? 'checked' : ''} />
              <span>Smart practice (favor weak keys)</span>
            </label>
            <label class="opt-row">
              <input type="checkbox" id="set-case" ${settings.caseSensitive ? 'checked' : ''} />
              <span>Case sensitive</span>
            </label>
          </section>
          <section class="drawer-section">
            <h3>Timer</h3>
            <label class="opt-row">
              <input type="radio" name="timerMode" value="auto" ${settings.timerMode === 'auto' ? 'checked' : ''} />
              <span>Start timing when I type</span>
            </label>
            <label class="opt-row">
              <input type="radio" name="timerMode" value="manual" ${settings.timerMode === 'manual' ? 'checked' : ''} />
              <span>Manual start</span>
            </label>
            <label class="opt-row">
              <input type="radio" name="timerMode" value="off" ${settings.timerMode === 'off' ? 'checked' : ''} />
              <span>No timer</span>
            </label>
            <label class="opt-row stacked">
              <span>Default minutes</span>
              <input type="number" id="set-duration" min="1" max="60" value="${settings.durationMinutes}" ${settings.timerMode === 'off' ? 'disabled' : ''} />
            </label>
          </section>
          <section class="drawer-section">
            <h3>Articles</h3>
            <label class="opt-row">
              <span class="ghost-chip upload-chip">
                ${state.uploadBusy ? 'Parsing…' : 'Upload article'}
                <input type="file" id="file-upload-settings" accept=".txt,.md,.pdf,.epub,.png,.jpg,.jpeg,.webp,.gif,text/plain,application/pdf,application/epub+zip,image/*" hidden ${state.uploadBusy ? 'disabled' : ''} />
              </span>
            </label>
            ${
              lib.length
                ? `<ul class="mistake-list compact user-lib">${lib
                    .map(
                      (d) =>
                        `<li><span class="m-meta">${escapeHtml(d.title)}</span> <span class="m-count">${countEnglishWords(d.text)} words</span> <button type="button" class="linkish" data-remove-doc="${d.id}">Delete</button></li>`,
                    )
                    .join('')}</ul>`
                : '<p class="drawer-lead">No uploads yet</p>'
            }
          </section>
          <section class="drawer-section">
            <h3>Experience</h3>
            <label class="opt-row setting-keyboard-option">
              <input type="checkbox" id="set-cover" ${settings.keyboardCovered ? 'checked' : ''} />
              <span>Hide keyboard by default</span>
            </label>
            <label class="opt-row">
              <input type="checkbox" id="set-speak" ${settings.speakOnCorrect ? 'checked' : ''} />
              <span>Speak each character when correct</span>
            </label>
            <label class="opt-row">
              <input type="checkbox" id="set-speak-sentence" ${settings.speakOnSentenceClick ? 'checked' : ''} />
              <span>Read when clicking on a sentence (Speaking)</span>
            </label>
            <div class="opt-block">
              <h3 class="opt-block-title">Article length</h3>
              <p class="drawer-lead">Use either time or word/character count — only one applies. Set a min and max.</p>
              <label class="opt-row">
                <input type="radio" name="speak-limit-mode" id="set-speak-mode-time" value="time" ${settings.speakLimitMode !== 'count' ? 'checked' : ''} />
                <span>Time limit</span>
              </label>
              <label class="field-row field-row-unit">
                <span class="unit-prefix">Min</span>
                <input type="number" id="set-speak-min-minutes" min="1" max="${settings.speakMaxMinutes}" value="${settings.speakMinMinutes}" ${settings.speakLimitMode === 'count' ? 'disabled' : ''} />
                <span class="unit">min</span>
              </label>
              <label class="field-row field-row-unit">
                <span class="unit-prefix">Max</span>
                <input type="number" id="set-speak-minutes" min="${settings.speakMinMinutes}" max="30" value="${settings.speakMaxMinutes}" ${settings.speakLimitMode === 'count' ? 'disabled' : ''} />
                <span class="unit">min</span>
              </label>
              <label class="opt-row">
                <input type="radio" name="speak-limit-mode" id="set-speak-mode-count" value="count" ${settings.speakLimitMode === 'count' ? 'checked' : ''} />
                <span>Word count</span>
              </label>
              <label class="field-row field-row-unit">
                <span class="unit-prefix">Min</span>
                <input type="number" id="set-speak-min-count" min="10" max="${settings.speakMaxCount}" value="${settings.speakMinCount}" ${settings.speakLimitMode !== 'count' ? 'disabled' : ''} />
                <span class="unit">words</span>
              </label>
              <label class="field-row field-row-unit">
                <span class="unit-prefix">Max</span>
                <input type="number" id="set-speak-count" min="${settings.speakMinCount}" max="2000" value="${settings.speakMaxCount}" ${settings.speakLimitMode !== 'count' ? 'disabled' : ''} />
                <span class="unit">words</span>
              </label>
              <label class="opt-row stacked page-size-row">
                <span>Words per page</span>
                <input type="number" id="set-page-chars" min="5" max="500" value="${settings.charsPerPage}" />
              </label>
            </div>
            <label class="opt-row">
              <input type="checkbox" id="set-auto-advance" ${settings.autoAdvancePerfect ? 'checked' : ''} />
              <span>Auto-next when perfect</span>
            </label>
            <label class="opt-row">
              <input type="checkbox" id="set-auto-advance-mistakes" ${settings.autoAdvanceWithMistakes ? 'checked' : ''} />
              <span>Also auto-next with mistakes</span>
            </label>
          </section>
        </div>
      </aside>
    `
  }

  function render() {
    const modeButtons = MODES.map(
      (m) =>
        `<button type="button" data-mode="${m.id}" class="${state.mode === m.id ? 'active' : ''}">${m.label}</button>`,
    ).join('')

    const drawer =
      state.drawer === 'mistakes'
        ? renderMistakesDrawer()
        : state.drawer === 'settings'
          ? renderSettingsDrawer()
          : ''

    const mistakeCount = loadEnglishMistakes().length

    if (state.drawer && isPhoneViewport()) {
      root.innerHTML = drawer
      bindEvents()
      state.drawerJustOpened = false
      syncBottomTabActive()
      return
    }

    root.innerHTML = `
      <header class="topbar">
        <div class="brand brand-modes">
          <nav class="mode-tabs" aria-label="Practice mode">${modeButtons}</nav>
          <span class="scheme">QWERTY</span>
        </div>
        <div class="top-actions top-actions-meta">
          <button type="button" class="ghost-chip" id="btn-open-mistakes">Mistakes${mistakeCount ? ` · ${mistakeCount}` : ''}</button>
          <button type="button" class="ghost-chip" id="btn-open-settings">Settings</button>
        </div>
      </header>
      ${renderTimerBar()}
      ${renderStats()}
      <main class="main">
        <section class="practice-card enter" id="practice-card" tabindex="0">
          ${renderStage()}
          <div class="hints-row hints-row-bottom">
            <span>Type letters, punctuation & spaces</span>
            <span><kbd>Esc</kbd> clear error flash</span>
            <span><kbd>⌥R</kbd> retry · <kbd>⌥N</kbd> next</span>
          </div>
          <input id="key-mirror" class="input-mirror" autocomplete="off" autocapitalize="off" spellcheck="false" />
        </section>
        <div class="toolbar">
          <button type="button" id="btn-skip">Skip</button>
          <button type="button" id="btn-speak">Read aloud</button>
          <button type="button" id="btn-reset" data-reset-stats>Reset stats</button>
          <button type="button" id="kb-toggle" class="keyboard-option-control">${settings.keyboardCovered ? 'Show keyboard' : 'Hide keyboard'}</button>
        </div>
        ${renderKeyboard()}
      </main>
      <p class="footer-note">English track · preferences saved locally · isolated from 双拼</p>
      ${state.drawer ? `<div class="drawer-backdrop" id="drawer-backdrop"></div>${drawer}` : ''}
    `

    bindEvents()
    bindStatsDisclosure()
    syncModeControl()
    if (isSpeechPlaying()) syncSpeakUi(true)
    state.drawerJustOpened = false
    requestAnimationFrame(() => {
      document.querySelector('.practice-card')?.classList.remove('enter')
    })
  }

  function restartRound() {
    resetSessionStats()
    state.passageHistory = []
    state.historyIndex = -1
    startPassage(state.mode)
    if (settings.timerMode !== 'off') startSession()
    render()
    focusApp()
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

    document.querySelectorAll('#btn-skip, [data-practice-skip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (state.sessionFinished) return
        clearAdvanceTimer()
        goNextPassage()
      })
    })
    document.querySelectorAll('#btn-speak, [data-practice-speak]').forEach((btn) => {
      btn.addEventListener('click', toggleSpeakPassage)
    })
    document.querySelectorAll('[data-reset-stats]').forEach((btn) => {
      btn.addEventListener('click', () => {
        resetSessionStats()
        state.passageHistory = []
        state.historyIndex = -1
        startPassage(state.mode)
        render()
        focusApp()
      })
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
        removeEnglishDoc(btn.dataset.removeDoc)
        render()
      })
    })

    document.querySelector('#btn-open-mistakes')?.addEventListener('click', () => openDrawer('mistakes'))
    document.querySelector('#btn-open-settings')?.addEventListener('click', () => openDrawer('settings'))
    document.querySelector('#drawer-backdrop')?.addEventListener('click', closeDrawer)
    document.querySelectorAll('#btn-close-drawer').forEach((btn) => {
      btn.addEventListener('click', closeDrawer)
    })
    document.querySelector('#btn-clear-mistakes')?.addEventListener('click', () => {
      clearEnglishMistakes()
      render()
    })
    document.querySelector('#btn-practice-mistakes')?.addEventListener('click', () => {
      state.drawer = null
      state.mode = 'word'
      saveMode('word')
      state.mistakesOnly = true
      state.mistakeIndex = -1
      state.passageHistory = []
      state.historyIndex = -1
      resetSessionStats()
      startPassage('word')
      render()
      syncBottomTabActive()
      focusApp()
    })

    document.querySelector('#set-smart')?.addEventListener('change', (e) => {
      applySettingsPatch({ smartPractice: e.target.checked })
    })
    document.querySelector('#set-case')?.addEventListener('change', (e) => {
      applySettingsPatch({ caseSensitive: e.target.checked })
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
        charsPerPage: Math.max(5, Math.min(500, Number(e.target.value) || 80)),
      })
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
        if (!e.target.checked) return
        applySettingsPatch({ speakLimitMode: e.target.value === 'count' ? 'count' : 'time' })
      })
    })
    document.querySelector('#set-speak-minutes')?.addEventListener('change', (e) => {
      applySettingsPatch({ speakMaxMinutes: Number(e.target.value) || 5 })
    })
    document.querySelector('#set-speak-min-minutes')?.addEventListener('change', (e) => {
      applySettingsPatch({ speakMinMinutes: Number(e.target.value) || 1 })
    })
    document.querySelector('#set-speak-count')?.addEventListener('change', (e) => {
      applySettingsPatch({ speakMaxCount: Number(e.target.value) || 150 })
    })
    document.querySelector('#set-speak-min-count')?.addEventListener('change', (e) => {
      applySettingsPatch({ speakMinCount: Number(e.target.value) || 40 })
    })
    document.querySelector('#set-auto-advance')?.addEventListener('change', (e) => {
      applySettingsPatch({ autoAdvancePerfect: e.target.checked })
    })
    document.querySelector('#set-auto-advance-mistakes')?.addEventListener('change', (e) => {
      applySettingsPatch({ autoAdvanceWithMistakes: e.target.checked })
    })

    const mirror = document.querySelector('#key-mirror')
    document.querySelector('#practice-card')?.addEventListener('click', focusApp)
    mirror?.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (handleCompletionShortcut(e)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        if (state.drawer) {
          closeDrawer()
          return
        }
        state.lastWrong = false
        patchLive()
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        return
      }
      if (e.key.length === 1 && !e.altKey) {
        e.preventDefault()
        handleKey(e.key)
      }
    })

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
      goNextPassage()
      return true
    }
    return false
  }

  window.addEventListener('keydown', (e) => {
    if (handleCompletionShortcut(e)) return
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (e.key === 'Escape') {
      if (state.drawer) {
        closeDrawer()
        return
      }
      state.lastWrong = false
      patchLive()
      return
    }
    if (state.drawer) return
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
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

  document.title = 'English Typing Practice'
  document.documentElement.lang = 'en'
  state.remainingMs = state.durationMinutes * 60 * 1000
  startPassage(state.mode)
  render()

  registerDrawerHandlers({
    open: (name) => openDrawer(name),
    close: () => closeDrawer(),
    getOpen: () => state.drawer,
  })

  registerModeControl({
    modes: MODES,
    getCurrent: () => state.mode,
    onSelect: (id) => setMode(id),
  })

  const pending = consumePendingDrawer()
  if (pending) openDrawer(pending)

  installViewportKeyboardSync(
    EN_KEYBOARD_EXPLICIT_KEY,
    () => settings.keyboardCovered,
    (covered) => applySettingsPatch({ keyboardCovered: covered }, { markKeyboardExplicit: false }),
  )
}
