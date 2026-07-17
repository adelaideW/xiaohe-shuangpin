/**
 * Japanese typing practice — romaji input with ひらがな hints. Isolated storage.
 */

import { toRomaji, toHiragana } from 'wanakana'
import {
  loadJapaneseSettings,
  saveJapaneseSettings,
  DEFAULT_JAPANESE_SETTINGS,
  JA_KEYBOARD_EXPLICIT_KEY,
} from './settings.js'
import {
  JP_WORDS,
  JP_SENTENCES,
  JP_ARTICLES,
  buildJapaneseUnits,
  buildJapanesePages,
  pageIndexForUnit,
  countJapaneseChars,
  passageDisplayText,
  passageFromJapaneseText,
  fitJapanesePassage,
} from './data.js'
import {
  loadJapaneseMistakes,
  recordJapaneseMistake,
  clearJapaneseMistakes,
  summarizeJapaneseMistakes,
} from './mistakes.js'
import { loadJapaneseLibrary, addJapaneseDoc, removeJapaneseDoc } from './library.js'
import { extractFromFile } from '../upload.js'
import { punctTypingKey, isPracticeTypingKey } from '../punct.js'
import { renderAnsiKeyboardRows, resolveHintKeys } from '../keyboard.js'
import { speakBudgetFromMinutes } from '../speaking/length.js'
import { enrichPassageWithReadings } from '../speaking/furigana.js'
import { scrollTypingFocusIntoView } from '../scrollTypingFocus.js'
import { speakText, cancelSpeech, isSpeechPlaying } from '../speaking/speech.js'
import { installMobileTypingViewportSync, installViewportKeyboardSync } from '../viewport.js'
import {
  focusFadeAfterHtml,
  focusFadeBeforeHtml,
  focusWindowSegBounds,
} from '../focusWindow.js'
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

const STORAGE_MODE = 'japanese-practice-mode'
const STORAGE_BEST = 'japanese-best-combo'
const MODES = [
  { id: 'word', label: '単語' },
  { id: 'sentence', label: '文' },
  { id: 'article', label: '文章' },
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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function formatAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return 'たった今'
  if (sec < 3600) return `${Math.floor(sec / 60)}分前`
  if (sec < 86400) return `${Math.floor(sec / 3600)}時間前`
  return `${Math.floor(sec / 86400)}日前`
}

/** Normalize kana → expected romaji for matching (ー stays as `-`). */
export function expectedRomaji(kana) {
  try {
    const h = toHiragana(String(kana || ''))
    return toRomaji(h)
      .toLowerCase()
      .replace(/[^a-z-]/g, '')
  } catch {
    return ''
  }
}

/** Hint line shows hiragana reading. */
function hintHiragana(kana) {
  try {
    return toHiragana(String(kana || ''))
  } catch {
    return String(kana || '')
  }
}

/**
 * Surface for passage display — ruby when a reading exists from the source
 * (Aozora annotation or curated bank). Auto-generated readings stay typeable
 * but are not shown as furigana over the article.
 * @param {{ surface: string, kana: string | null, kanaFromSource?: boolean }} seg
 * @param {boolean} showFurigana
 */
function segmentSurfaceHtml(seg, showFurigana) {
  const surface = seg?.surface || ''
  if (surface === ' ' || surface === '\u3000') return '&nbsp;'
  if (surface === '\n') return '<br />'
  const escaped = escapeHtml(surface)
  if (!showFurigana || !seg.kana) return escaped
  // Explicitly auto-filled readings: typeable, no ruby
  if (seg.kanaFromSource === false) return escaped
  if (!/[\u4E00-\u9FFF々〆ヵヶ]/.test(surface)) return escaped
  const reading = escapeHtml(hintHiragana(seg.kana))
  if (!reading || reading === escaped) return escaped
  return `<ruby>${escaped}<rt>${reading}</rt></ruby>`
}

/**
 * @param {HTMLElement} root
 */
export function bootJapanese(root) {
  let settings = loadJapaneseSettings()
  const state = {
    mode: loadMode(),
    buffer: '',
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
    durationMinutes: settings.durationMinutes || DEFAULT_JAPANESE_SETTINGS.durationMinutes,
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
    readingsBusy: false,
    mistakesOnly: false,
    mistakeIndex: -1,
  }

  let tickHandle = null
  let advanceTimer = null
  let loadPassageToken = 0

  function clearAdvanceTimer() {
    if (advanceTimer) {
      clearTimeout(advanceTimer)
      advanceTimer = null
    }
  }

  function currentTarget() {
    return state.units[state.unitIndex] || null
  }

  function currentExpected() {
    const t = currentTarget()
    if (!t) return ''
    if (t.kind === 'punct' || t.kind === 'space' || t.expectedKey) {
      return t.expectedKey || punctTypingKey(t.surface)
    }
    return expectedRomaji(t.kana)
  }

  function accuracy() {
    const total = state.correct + state.wrong
    return total ? Math.round((state.correct / total) * 100) : 100
  }

  function cpm() {
    if (!state.startedAt) return 0
    const elapsed = (performance.now() - state.startedAt - state.pausedAccumMs) / 60000
    return elapsed > 0 ? Math.round(state.correct / elapsed) : 0
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
    if (state.sessionEndsAt) state.remainingMs = Math.max(0, state.sessionEndsAt - performance.now())
  }

  function resumeSession() {
    if (!state.sessionActive || state.sessionFinished || !state.sessionPaused) return
    if (state.pauseStartedAt) state.pausedAccumMs += performance.now() - state.pauseStartedAt
    state.sessionPaused = false
    state.autoPaused = false
    state.pauseStartedAt = null
    state.sessionEndsAt = performance.now() + state.remainingMs
    state.lastActivityAt = performance.now()
  }

  function endSession() {
    state.sessionActive = false
    state.sessionFinished = true
    state.sessionPaused = false
    state.autoPaused = false
    clearAdvanceTimer()
    render()
  }

  function updateTimerDisplay() {
    if (!state.sessionActive || state.sessionFinished || state.sessionPaused) return
    const left = Math.max(0, (state.sessionEndsAt || 0) - performance.now())
    state.remainingMs = left
    if (state.lastActivityAt && performance.now() - state.lastActivityAt >= IDLE_PAUSE_MS) {
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
        <span class="timer-value idle" id="timer-value">なし</span>
        <div class="timer-actions"><span class="timer-hint">自由練習</span></div>
      `
    }

    let status
    let actions
    const iconPause = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`
    const iconPlay = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>`
    const iconReset = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-2.6-6.2"/><path d="M21 3v7h-7"/></svg>`
    const iconEnd = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`

    if (state.sessionFinished) status = `<span class="timer-value done">終了</span>`
    else if (state.sessionActive && state.sessionPaused)
      status = `<span class="timer-value paused" id="timer-value">${formatTime(state.remainingMs)}${state.autoPaused ? ' · 待機' : ' · 一時停止'}</span>`
    else if (state.sessionActive)
      status = `<span class="timer-value ${state.remainingMs < 30000 ? 'urgent' : ''}" id="timer-value">${formatTime(state.remainingMs)}</span>`
    else status = `<span class="timer-value idle" id="timer-value">${formatTime(state.durationMinutes * 60 * 1000)}</span>`

    if (state.sessionFinished) actions = `<button type="button" class="primary" data-restart>もう一度</button>`
    else if (state.sessionActive)
      actions = `
        <button type="button" class="icon-btn" id="btn-pause-timer">${state.sessionPaused ? iconPlay : iconPause}</button>
        <button type="button" class="icon-btn" id="btn-reset-timer">${iconReset}</button>
        <button type="button" class="icon-btn icon-btn-danger" id="btn-end-timer">${iconEnd}</button>`
    else if (settings.timerMode === 'manual')
      actions = `<button type="button" class="primary" id="btn-start-timer">タイマー開始</button>`
    else actions = `<span class="timer-hint">入力で開始</span>`

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
      state.sessionEndsAt = performance.now() + state.remainingMs
      renderTimerControls()
    })
    document.querySelectorAll('[data-restart]').forEach((btn) => btn.addEventListener('click', restartRound))
  }

  function articleLengthBounds() {
    if (settings.speakLimitMode === 'count') {
      let min = Math.max(1, Number(settings.speakMinCount) || 40)
      let max = Math.max(1, Number(settings.speakMaxCount) || 200)
      if (min > max) min = max
      return { min, max }
    }
    const min = speakBudgetFromMinutes('ja', settings.speakMinMinutes || 1)
    const max = speakBudgetFromMinutes('ja', settings.speakMaxMinutes || 5)
    return { min: Math.min(min, max), max: Math.max(min, max) }
  }

  /** Typed bank with readings (preferred). */
  function typedArticleSources() {
    const user = loadJapaneseLibrary()
      .map((d) => {
        try {
          return passageFromJapaneseText(d.title, d.text)
        } catch {
          return null
        }
      })
      .filter(Boolean)
    return [...JP_ARTICLES, ...user]
  }

  function pickFittedArticle(avoid) {
    const { min, max } = articleLengthBounds()
    // Same built-in bank as speaking (`JA_ARTICLE_BANK` via JP_ARTICLES).
    const sources = typedArticleSources()
    if (!sources.length) return null

    const measured = sources
      .map((p) => ({ p, n: countJapaneseChars(p) }))
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
    return fitJapanesePassage(base, min, max)
  }

  /**
   * Article progress in 文字 (same metric as Article length settings).
   * @returns {{ done: number, total: number, label: string }}
   */
  function articleCharProgress() {
    const segs = state.passage?.segments || []
    const total = countJapaneseChars(state.passage)
    const doneIndexes = new Set(state.units.slice(0, state.unitIndex).map((u) => u.index))
    let done = 0
    segs.forEach((seg, i) => {
      if (!doneIndexes.has(i)) return
      done += countJapaneseChars(seg.surface || '')
    })
    const err = state.passageWrong ? ` · 誤 ${state.passageWrong}` : ''
    return { done, total, label: `${done}/${total} 文字${err}` }
  }

  function passageProgressLabel() {
    if (state.mode === 'article') return articleCharProgress().label
    return `${state.unitIndex}/${state.units.length}${
      state.passageWrong ? ` · 誤 ${state.passageWrong}` : ''
    }`
  }

  async function refitCurrentArticle() {
    if (state.mode !== 'article' || !state.passage) return false
    const { min, max } = articleLengthBounds()
    const sources = typedArticleSources()
    const base =
      sources.find((p) => p.title === state.passage.title) || sources[0]
    if (!base) return false
    const fitted = fitJapanesePassage(base, min, max)
    if (state.historyIndex >= 0 && state.historyIndex < state.passageHistory.length) {
      state.passageHistory[state.historyIndex] = fitted
    }
    await loadPassageAt(fitted)
    return true
  }

  function pickPassage(mode) {
    if (mode === 'word') {
      if (state.mistakesOnly) {
        const items = [...new Map(
          loadJapaneseMistakes()
            .filter((m) => m.kana || m.surface)
            .map((m) => [
              `${m.surface || m.kana}|${m.kana || m.surface}`,
              {
                title: 'ミス練習',
                segments: [{ surface: m.surface || m.kana, kana: m.kana || m.surface }],
              },
            ]),
        ).values()]
        if (items.length) {
          state.mistakeIndex = (state.mistakeIndex + 1) % items.length
          return items[state.mistakeIndex]
        }
        state.mistakesOnly = false
      }
      return shufflePick(JP_WORDS, state.passage)
    }
    if (mode === 'article') return pickFittedArticle(state.passage)
    return shufflePick(JP_SENTENCES, state.passage)
  }

  function applyPassage(passage) {
    state.passage = passage
    state.units = buildJapaneseUnits(passage)
    state.pages = buildJapanesePages(state.units, settings.charsPerPage)
    state.pageIndex = 0
    state.unitIndex = 0
    state.buffer = ''
    state.completed = false
    state.passageWrong = 0
    state.autoAdvanceNote = ''
  }

  /**
   * Load a passage and fill any kanji missing source readings (Aozora / uploads)
   * via Kuroshiro so they become typeable and show furigana.
   * @param {*} passage
   * @param {{ quiet?: boolean }} [opts]
   */
  async function loadPassageAt(passage, opts = {}) {
    const token = ++loadPassageToken
    applyPassage(passage)
    const needsEnrich = (passage?.segments || []).some(
      (s) => !s.kana && /[\u4E00-\u9FFF々〆ヵヶ]/.test(s.surface || ''),
    )
    if (!needsEnrich) {
      state.readingsBusy = false
      const marked = { ...passage, _readingsEnriched: true }
      state.passage = marked
      if (state.historyIndex >= 0 && state.historyIndex < state.passageHistory.length) {
        state.passageHistory[state.historyIndex] = marked
      }
      return
    }
    state.readingsBusy = true
    if (!opts.quiet) render()
    try {
      const enriched = await enrichPassageWithReadings(passage)
      if (token !== loadPassageToken) return
      applyPassage(enriched)
      if (state.historyIndex >= 0 && state.historyIndex < state.passageHistory.length) {
        state.passageHistory[state.historyIndex] = enriched
      }
    } finally {
      if (token === loadPassageToken) {
        state.readingsBusy = false
        if (!opts.quiet) render()
      }
    }
  }

  async function startPassage(mode, { pushHistory = true } = {}) {
    const passage = pickPassage(mode)
    if (!passage) return
    if (pushHistory) {
      if (state.historyIndex >= 0 && state.historyIndex < state.passageHistory.length - 1) {
        state.passageHistory = state.passageHistory.slice(0, state.historyIndex + 1)
      }
      state.passageHistory.push(passage)
      state.historyIndex = state.passageHistory.length - 1
    }
    await loadPassageAt(passage)
  }

  async function goHistory(delta) {
    const next = state.historyIndex + delta
    if (next < 0 || next >= state.passageHistory.length) return
    state.historyIndex = next
    await loadPassageAt(state.passageHistory[next])
    clearAdvanceTimer()
    render()
    focusApp()
  }

  async function goNextPassage() {
    if (state.historyIndex < state.passageHistory.length - 1) {
      await goHistory(1)
      return
    }
    await startPassage(state.mode, { pushHistory: true })
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
    render()
    focusApp()
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
    state.pausedAccumMs = 0
    state.remainingMs = state.durationMinutes * 60 * 1000
    clearAdvanceTimer()
  }

  async function setMode(mode) {
    state.mistakesOnly = false
    state.mistakeIndex = -1
    state.mode = mode
    saveMode(mode)
    clearAdvanceTimer()
    state.passageHistory = []
    state.historyIndex = -1
    await startPassage(mode)
    render()
    focusApp()
  }

  function setDuration(mins) {
    const n = Math.min(60, Math.max(1, Math.round(Number(mins) || 5)))
    state.durationMinutes = n
    settings = saveJapaneseSettings({ durationMinutes: n })
    if (!state.sessionActive) state.remainingMs = n * 60 * 1000
    render()
    focusApp()
  }

  function applySettingsPatch(patch, opts) {
    settings = saveJapaneseSettings(patch, opts)
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
      state.pages = buildJapanesePages(state.units, settings.charsPerPage)
      state.pageIndex = pageIndexForUnit(state.pages, state.unitIndex)
    }

    // Keyboard cover only — update in place so the article card does not blink.
    if (
      Object.prototype.hasOwnProperty.call(patch, 'keyboardCovered') &&
      Object.keys(patch).every((k) => k === 'keyboardCovered')
    ) {
      document.querySelector('.keyboard')?.classList.toggle('covered', settings.keyboardCovered)
      const kbToggle = document.querySelector('#kb-toggle')
      if (kbToggle) {
        kbToggle.textContent = settings.keyboardCovered ? 'キーボード表示' : 'キーボード非表示'
      }
      const coverCheckbox = document.querySelector('#set-cover')
      if (coverCheckbox instanceof HTMLInputElement) {
        coverCheckbox.checked = settings.keyboardCovered
      }
      return
    }

    const lengthChanged =
      'speakLimitMode' in patch ||
      'speakMaxMinutes' in patch ||
      'speakMinMinutes' in patch ||
      'speakMaxCount' in patch ||
      'speakMinCount' in patch

    if (lengthChanged && state.mode === 'article') {
      void refitCurrentArticle().then(() => {
        render()
        focusApp()
      })
      return
    }

    if (patch.charsPerPage != null || patch.timerMode != null) {
      render()
      return
    }

    if (state.drawer === 'settings') {
      if (lengthChanged || 'speakShowHiragana' in patch) {
        render()
      }
      return
    }
    render()
    focusApp()
  }

  function ensureSession() {
    if (state.sessionFinished || state.sessionActive) return true
    if (settings.timerMode === 'off' || settings.timerMode === 'manual') {
      if (settings.timerMode === 'off' && !state.startedAt) {
        state.startedAt = performance.now()
        state.pausedAccumMs = 0
      }
      return true
    }
    startSession()
    renderTimerControls()
    return true
  }

  function onPassageComplete() {
    state.completed = true
    state.passagesDone += 1
    const clean = state.passageWrong === 0
    const shouldAdvance =
      (clean && settings.autoAdvancePerfect) || (!clean && settings.autoAdvanceWithMistakes)
    if (shouldAdvance) {
      state.autoAdvanceNote = clean ? '正解 — 次へ…' : 'ミスあり — 次へ…'
      render()
      advanceTimer = setTimeout(() => {
        state.autoAdvanceNote = ''
        goNextPassage()
      }, 900)
      return
    }
    state.autoAdvanceNote = clean ? '' : 'ミスあり · 再挑戦もできます'
    render()
  }

  function onCorrectUnit() {
    state.correct += 1
    state.combo += 1
    state.buffer = ''
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

  function onWrong(typed) {
    const t = currentTarget()
    // Punctuation / space errors still count for accuracy, but are not saved to ミス帳.
    if (t && t.kind !== 'punct' && t.kind !== 'space') {
      recordJapaneseMistake({
        surface: t.surface,
        kana: hintHiragana(t.kana),
        expected: currentExpected(),
        typed,
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
    if (state.sessionFinished || state.drawer || state.completed) return
    if (!currentTarget()) return
    const t = currentTarget()
    const singleWant =
      t?.kind === 'punct' || t?.kind === 'space' ? currentExpected() : ''
    if (singleWant) {
      if (key.length !== 1 && !(singleWant === ' ' && (key === ' ' || key === 'Space'))) return
      const typed = key === 'Space' ? ' ' : key
      ensureSession()
      noteActivity()
      state.keystrokes += 1
      if (typed === singleWant) onCorrectUnit()
      else onWrong(typed === ' ' ? 'space' : typed)
      return
    }
    const lower = key === '-' ? '-' : key.toLowerCase()
    if (!/^[a-z-]$/.test(lower)) return

    ensureSession()
    noteActivity()
    state.keystrokes += 1
    const next = state.buffer + lower
    const expected = currentExpected()
    if (!expected) return

    if (!expected.startsWith(next)) {
      onWrong(next)
      return
    }
    state.buffer = next
    if (state.buffer === expected) onCorrectUnit()
    else patchLive()
  }

  function speakCurrent() {
    const t = currentTarget()
    if (!t) return
    void speakText(t.surface, 'ja', 0.9)
  }

  function syncSpeakUi(speaking) {
    syncPracticeSpeakButtons({
      speaking,
      speakLabel: '読み上げ',
      stopLabel: '停止',
    })
  }

  function toggleSpeakPassage() {
    if (isSpeechPlaying()) {
      cancelSpeech()
      syncSpeakUi(false)
      return
    }
    if (!state.passage) return
    const text = passageDisplayText(state.passage)
    if (!text.trim()) return
    syncSpeakUi(true)
    speakText(text, 'ja', 0.9, () => syncSpeakUi(false))
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

  function patchStats() {
    const values = document.querySelectorAll('.stat .value')
    if (values.length < 6) return
    values[0].textContent = String(state.correct)
    values[1].textContent = String(state.combo)
    values[2].textContent = String(state.best)
    values[3].textContent = `${accuracy()}%`
    values[4].textContent = String(state.startedAt ? cpm() : 0)
    values[5].textContent = String(state.keystrokes)
    patchStatsSummary()
  }

  function patchLive() {
    if (!state.passage || state.completed || state.sessionFinished) return
    const cur = currentTarget()
    const useFocus = isPhoneViewport() && state.mode !== 'word'
    const passageEl = document.querySelector('.jp-passage')

    if (useFocus && passageEl) {
      passageEl.innerHTML = japanesePassageHtml()
      passageEl.closest('.passage-scroll')?.classList.add('focus-window')
    } else {
      const doneSeg = new Set(state.units.slice(0, state.unitIndex).map((u) => u.index))
      document.querySelectorAll('.jp-seg').forEach((el) => {
        const i = Number(el.dataset.seg)
        el.classList.toggle('done', doneSeg.has(i))
        el.classList.toggle('current', cur && i === cur.index)
      })
    }
    const metaProg = document.querySelector('.passage-progress')
    if (metaProg) {
      metaProg.textContent = passageProgressLabel()
    }
    const hint = document.querySelector('.pinyin-line')
    if (hint && cur) {
      if (cur.kind === 'punct' || cur.kind === 'space') {
        hint.textContent =
          cur.kind === 'space' ? 'space' : `${cur.surface} · ${currentExpected()}`
      } else {
        const hira = hintHiragana(cur.kana)
        const roma = currentExpected()
        hint.textContent = `${hira} · ${roma}`
      }
    }
    const slots = document.querySelector('.code-progress')
    if (slots && cur) {
      const exp = currentExpected()
      slots.innerHTML = [...exp]
        .map((ch, i) => {
          const filled = i < state.buffer.length
          const isCurrent = i === state.buffer.length
          return `<div class="code-slot ${filled ? 'filled' : ''} ${isCurrent ? 'is-current' : ''}">${filled ? state.buffer[i] : ''}</div>`
        })
        .join('')
    }
    patchStats()
    scrollCurrentIntoView()
  }

  function japanesePassageHtml() {
    const cur = currentTarget()
    const doneSeg = new Set(state.units.slice(0, state.unitIndex).map((u) => u.index))
    const page = state.pages[state.pageIndex] || { start: 0, end: state.units.length }
    const pageSegStart = state.units[page.start]?.index ?? 0
    const pageSegEnd = state.units[page.end - 1]?.index ?? pageSegStart
    const segs = state.passage.segments || []
    const showFuri = settings.speakShowHiragana
    const curSeg = cur?.index ?? pageSegStart

    let start = pageSegStart
    let end = pageSegEnd
    let clippedBefore = false
    let clippedAfter = false
    if (isPhoneViewport()) {
      const win = focusWindowSegBounds(curSeg, { start: pageSegStart, end: pageSegEnd }, {
        before: 8,
        after: 10,
      })
      start = win.start
      end = win.end
      clippedBefore = win.clippedBefore
      clippedAfter = win.clippedAfter
    }

    const chars = segs
      .map((seg, i) => {
        if (i < start || i > end) return ''
        const classes = ['jp-seg']
        if (!seg.kana) classes.push('jp-punct')
        if (seg.surface === ' ' || seg.surface === '\u3000') classes.push('jp-space')
        if (doneSeg.has(i)) classes.push('done')
        if (cur && i === cur.index) classes.push('current')
        return `<span class="${classes.join(' ')}" data-seg="${i}">${segmentSurfaceHtml(seg, showFuri)}</span>`
      })
      .join('')

    return `${clippedBefore ? focusFadeBeforeHtml() : ''}${chars}${clippedAfter ? focusFadeAfterHtml() : ''}`
  }

  function scrollCurrentIntoView() {
    scrollTypingFocusIntoView({
      unitIndex: state.unitIndex,
      unitCount: state.units.length,
      selector: '.passage-scroll .jp-seg.current',
    })
  }

  async function handleUploadedFile(file) {
    if (!file || state.uploadBusy) return
    state.uploadBusy = true
    state.uploadMessage = '読み込み中…'
    render()
    try {
      const extracted = await extractFromFile(file, { ocrLang: 'jpn', requireHanzi: false })
      let text = extracted.text
      if (text.length > 80000) text = text.slice(0, 80000)
      const passage = passageFromJapaneseText(extracted.title, text)
      addJapaneseDoc({ title: passage.title, text: passageDisplayText(passage) })
      state.mode = 'article'
      saveMode('article')
      state.passageHistory.push(passage)
      state.historyIndex = state.passageHistory.length - 1
      await loadPassageAt(passage)
      state.uploadMessage = `追加: ${passage.title} · ${countJapaneseChars(passage)} 文字`
      state.drawer = null
    } catch (err) {
      state.uploadMessage = err?.message || 'アップロード失敗'
    } finally {
      state.uploadBusy = false
      render()
      focusApp()
    }
  }

  function renderTimerBar() {
    if (settings.timerMode === 'off') {
      return `
      <div class="timer-bar timer-bar-off">
        <div class="timer-bar-inner">
          <div class="timer-left">
            <span class="timer-label">練習時間</span>
            <span class="timer-hint">タイマーオフ</span>
          </div>
          <div class="timer-right">${timerRightHtml()}</div>
        </div>
      </div>`
    }
    const presets = DURATION_PRESETS.map(
      (m) =>
        `<button type="button" class="dur-btn ${state.durationMinutes === m && !state.sessionActive ? 'active' : ''}" data-duration="${m}" ${state.sessionActive ? 'disabled' : ''}>${m} 分</button>`,
    ).join('')
    return `
      <div class="timer-bar">
        <div class="timer-bar-inner">
          <div class="timer-left">
            <span class="timer-label">練習時間</span>
            <div class="dur-group">${presets}
              <label class="custom-dur">
                <input type="number" id="custom-duration" min="1" max="60" value="${state.durationMinutes}" ${state.sessionActive ? 'disabled' : ''} />
                <span>分</span>
              </label>
            </div>
          </div>
          <div class="timer-right">${timerRightHtml()}</div>
        </div>
      </div>`
  }

  function renderStats() {
    const stats = `
      <div class="stats">
        <div class="stat"><span class="label">正解</span><span class="value">${state.correct}</span></div>
        <div class="stat"><span class="label">連打</span><span class="value">${state.combo}</span></div>
        <div class="stat"><span class="label">ベスト</span><span class="value">${state.best}</span></div>
        <div class="stat"><span class="label">正確率</span><span class="value">${accuracy()}%</span></div>
        <div class="stat"><span class="label">単位/分</span><span class="value">${state.startedAt ? cpm() : 0}</span></div>
        <div class="stat"><span class="label">打鍵</span><span class="value">${state.keystrokes}</span></div>
      </div>`
    return wrapCollapsibleStats(stats, {
      storageKey: 'japanese-stats-collapsed',
      summaryLabels: { streak: '連打', accuracy: '正確率' },
      streakValue: state.combo,
      accuracyValue: `${accuracy()}%`,
      resetLabel: '統計リセット',
    })
  }

  function renderWordStage() {
    if (state.sessionFinished) {
      return `<div class="complete-banner"><h2>セッション終了</h2><p>${accuracy()}% · ${cpm()} 単位/分</p>
        <div class="toolbar"><button type="button" class="primary" data-restart>もう一度</button></div></div>`
    }
    if (state.completed) {
      const hasMistakes = state.passageWrong > 0
      return `<div class="complete-banner">
        <h2>${hasMistakes ? '完了' : '完璧！'}</h2>
        <p>${state.autoAdvanceNote || `${accuracy()}%`}</p>
        <div class="toolbar">
          ${hasMistakes ? `<button type="button" id="btn-redo-passage">再挑戦 <kbd class="btn-kbd">⌥R</kbd></button>` : ''}
          <button type="button" class="primary" id="btn-next-passage">次へ <kbd class="btn-kbd">⌥N</kbd></button>
        </div></div>`
    }

    const segs = state.passage.segments || []
    const cur = currentTarget()
    const showFuri = settings.speakShowHiragana
    const wordHtml = segs.map((seg) => segmentSurfaceHtml(seg, showFuri)).join('')

    const exp = currentExpected()
    const slots = [...exp]
      .map((ch, i) => {
        const filled = i < state.buffer.length
        const isCurrent = i === state.buffer.length
        return `<div class="code-slot ${filled ? 'filled' : ''} ${isCurrent ? 'is-current' : ''}">${filled ? state.buffer[i] : ''}</div>`
      })
      .join('')
    const hira = cur ? hintHiragana(cur.kana) : ''
    const hintText =
      cur?.kind === 'punct' || cur?.kind === 'space'
        ? cur.kind === 'space'
          ? 'space'
          : `${cur.surface} · ${exp}`
        : cur
          ? `${hira} · ${exp}`
          : ''

    return `
      <div class="char-stage word-stage">
        <div class="mobile-stage-actions">${renderMobilePracticeActions({ skip: 'スキップ', speak: '読み上げ' })}</div>
        <div class="hanzi word-display jp-word${showFuri ? ' has-furigana' : ''}">${wordHtml}</div>
        <div class="pinyin-line">${hintText}</div>
        <div class="code-progress">${slots}</div>
      </div>`
  }

  function renderStage() {
    if (!state.passage) return ''
    if (state.mode === 'word') return renderWordStage()
    if (state.sessionFinished) {
      return `<div class="complete-banner"><h2>セッション終了</h2><p>${accuracy()}% · ${cpm()} 単位/分</p>
        <div class="toolbar"><button type="button" class="primary" data-restart>もう一度</button></div></div>`
    }
    if (state.completed) {
      const hasMistakes = state.passageWrong > 0
      return `<div class="complete-banner">
        <h2>${hasMistakes ? '完了' : '完璧！'}</h2>
        <p>${state.autoAdvanceNote || `${accuracy()}%`}</p>
        <div class="toolbar">
          ${hasMistakes ? `<button type="button" id="btn-redo-passage">再挑戦 <kbd class="btn-kbd">⌥R</kbd></button>` : ''}
          <button type="button" class="primary" id="btn-next-passage">次へ <kbd class="btn-kbd">⌥N</kbd></button>
        </div></div>`
    }

    const cur = currentTarget()
    const exp = currentExpected()
    const slots = [...exp]
      .map((ch, i) => {
        const filled = i < state.buffer.length
        const isCurrent = i === state.buffer.length
        return `<div class="code-slot ${filled ? 'filled' : ''} ${isCurrent ? 'is-current' : ''}">${filled ? state.buffer[i] : ''}</div>`
      })
      .join('')

    const multiPage = state.pages.length > 1
    const progress = passageProgressLabel()
    const canPrev = state.historyIndex > 0
    const hira = cur ? hintHiragana(cur.kana) : ''
    const showFuri = settings.speakShowHiragana
    const focusOn = isPhoneViewport()

    return `
      <div class="char-stage passage-stage">
        <div class="passage-meta">
          <div class="passage-title-row">
            <div class="passage-nav">
              <button type="button" class="nav-icon" id="btn-prev-passage" ${canPrev ? '' : 'disabled'}>‹</button>
              <button type="button" class="nav-icon" id="btn-next-passage-nav">›</button>
            </div>
            <span class="title">${escapeHtml(state.passage.title)}</span>
            <span class="passage-progress">${progress}</span>
          </div>
          <div class="passage-actions">
            <label class="ghost-chip upload-chip practice-upload-control" title="アップロード" aria-label="アップロード">
              <svg class="upload-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 16.5h2V8.33l3.59 3.58L18 10.5l-6-6-6 6 1.41 1.41L11 8.33v8.17ZM5 19.5h14v-2H5v2Z"/></svg>
              <span class="upload-label">${state.uploadBusy ? '…' : 'アップロード'}</span>
              <input type="file" id="file-upload" accept=".txt,.md,.pdf,.epub,.png,.jpg,.jpeg,.webp,text/plain,application/pdf,image/*" hidden ${state.uploadBusy ? 'disabled' : ''} />
            </label>
            ${renderMobilePracticeActions({ skip: 'スキップ', speak: '読み上げ' })}
          </div>
        </div>
        ${
          multiPage
            ? `<div class="page-bar">
                <button type="button" class="nav-icon" id="btn-prev-page" ${state.pageIndex > 0 ? '' : 'disabled'}>‹</button>
                <span class="page-label">${state.pageIndex + 1}/${state.pages.length} ページ</span>
                <button type="button" class="nav-icon" id="btn-next-page" ${state.pageIndex < state.pages.length - 1 ? '' : 'disabled'}>›</button>
              </div>`
            : ''
        }
        <div class="passage-scroll${focusOn ? ' focus-window' : ''}">
          <div class="passage poem jp-passage${showFuri ? ' has-furigana' : ''}">${japanesePassageHtml()}</div>
        </div>
        <div class="typing-chrome">
          <div class="pinyin-line">${cur ? `${hira} · ${exp}` : ''}</div>
          <div class="code-progress">${slots}</div>
        </div>
        ${state.readingsBusy ? `<p class="upload-msg">漢字の読みを自動生成中…</p>` : ''}
        ${state.uploadMessage ? `<p class="upload-msg">${escapeHtml(state.uploadMessage)}</p>` : ''}
      </div>`
  }

  function renderMistakesDrawer() {
    const summary = summarizeJapaneseMistakes()
    const top = summary.top.length
      ? summary.top.map((c) => `<li><span class="m-char">${escapeHtml(c.kana)}</span> <span class="m-count">${c.count}×</span></li>`).join('')
      : '<li class="empty">まだありません</li>'
    const recent = summary.recent.length
      ? summary.recent
          .map(
            (m) =>
              `<li><span class="m-char">${escapeHtml(m.kana)}</span>
              <span class="m-meta">${escapeHtml(m.expected)} ← ${escapeHtml(m.typed)}</span>
              <span class="m-time">${formatAgo(m.at)}</span></li>`,
          )
          .join('')
      : '<li class="empty">なし</li>'
    return `
      <aside class="drawer ${state.drawerJustOpened ? 'drawer-enter' : ''}">
        <div class="drawer-head"><h2>ミス帳</h2><button type="button" class="drawer-close" id="btn-close-drawer">×</button></div>
        <div class="drawer-body">
          <p class="drawer-lead">${summary.total} 件 · 日本語のみ（他言語と共有しません）</p>
          <section class="drawer-section"><h3>よく間違える読み</h3><ul class="mistake-list">${top}</ul></section>
          <section class="drawer-section"><h3>最近</h3><ul class="mistake-list">${recent}</ul></section>
        </div>
        <div class="drawer-foot">
          <button type="button" class="primary practice-all-mistakes" id="btn-practice-mistakes" ${summary.total ? '' : 'disabled'}>すべてのミスを練習</button>
          <button type="button" class="btn-warning" id="btn-clear-mistakes">クリア</button>
        </div>
      </aside>`
  }

  function renderSettingsDrawer() {
    const lib = loadJapaneseLibrary()
    return `
      <aside class="drawer ${state.drawerJustOpened ? 'drawer-enter' : ''}">
        <div class="drawer-head"><h2>日本語設定</h2><button type="button" class="drawer-close" id="btn-close-drawer">×</button></div>
        <div class="drawer-body">
          <p class="drawer-lead">この設定は日本語トラック専用です。ローマ字で入力し、ひらがなヒントを表示します。</p>
          <section class="drawer-section">
            <h3>タイマー</h3>
            <label class="opt-row"><input type="radio" name="timerMode" value="auto" ${settings.timerMode === 'auto' ? 'checked' : ''} /><span>入力で自動開始</span></label>
            <label class="opt-row"><input type="radio" name="timerMode" value="manual" ${settings.timerMode === 'manual' ? 'checked' : ''} /><span>手動開始</span></label>
            <label class="opt-row"><input type="radio" name="timerMode" value="off" ${settings.timerMode === 'off' ? 'checked' : ''} /><span>タイマーなし</span></label>
            <label class="opt-row stacked"><span>既定の分数</span><input type="number" id="set-duration" min="1" max="60" value="${settings.durationMinutes}" ${settings.timerMode === 'off' ? 'disabled' : ''} /></label>
          </section>
          <section class="drawer-section">
            <h3>文章</h3>
            ${
              lib.length
                ? `<ul class="mistake-list compact user-lib">${lib
                    .map(
                      (d) =>
                        `<li><span class="m-meta">${escapeHtml(d.title)}</span>
                        <button type="button" class="linkish" data-remove-doc="${d.id}">削除</button></li>`,
                    )
                    .join('')}</ul>`
                : '<p class="drawer-lead">アップロードなし</p>'
            }
          </section>
          <section class="drawer-section">
            <h3>体験</h3>
            <label class="opt-row setting-keyboard-option"><input type="checkbox" id="set-cover" ${settings.keyboardCovered ? 'checked' : ''} /><span>キーボードを隠す</span></label>
            <label class="opt-row"><input type="checkbox" id="set-speak" ${settings.speakOnCorrect ? 'checked' : ''} /><span>正解で読み上げ</span></label>
            <label class="opt-row"><input type="checkbox" id="set-speak-sentence" ${settings.speakOnSentenceClick ? 'checked' : ''} /><span>文をクリックしたとき読み上げ（スピーキング）</span></label>
            <label class="opt-row"><input type="checkbox" id="set-speak-hiragana" ${settings.speakShowHiragana ? 'checked' : ''} /><span>漢字にひらがな（ふりがな）を表示</span></label>
            <div class="opt-block">
              <h3 class="opt-block-title">文章の長さ</h3>
              <p class="drawer-lead">時間か文字数のどちらか一方だけ適用されます。最小と最大を設定します。</p>
              <label class="opt-row">
                <input type="radio" name="speak-limit-mode" value="time" ${settings.speakLimitMode !== 'count' ? 'checked' : ''} />
                <span>時間</span>
              </label>
              <label class="field-row field-row-unit">
                <span class="unit-prefix">最小</span>
                <input type="number" id="set-speak-min-minutes" min="1" max="${settings.speakMaxMinutes}" value="${settings.speakMinMinutes}" ${settings.speakLimitMode === 'count' ? 'disabled' : ''} />
                <span class="unit">分</span>
              </label>
              <label class="field-row field-row-unit">
                <span class="unit-prefix">最大</span>
                <input type="number" id="set-speak-minutes" min="${settings.speakMinMinutes}" max="30" value="${settings.speakMaxMinutes}" ${settings.speakLimitMode === 'count' ? 'disabled' : ''} />
                <span class="unit">分</span>
              </label>
              <label class="opt-row">
                <input type="radio" name="speak-limit-mode" value="count" ${settings.speakLimitMode === 'count' ? 'checked' : ''} />
                <span>文字数</span>
              </label>
              <label class="field-row field-row-unit">
                <span class="unit-prefix">最小</span>
                <input type="number" id="set-speak-min-count" min="10" max="${settings.speakMaxCount}" value="${settings.speakMinCount}" ${settings.speakLimitMode !== 'count' ? 'disabled' : ''} />
                <span class="unit">文字</span>
              </label>
              <label class="field-row field-row-unit">
                <span class="unit-prefix">最大</span>
                <input type="number" id="set-speak-count" min="${settings.speakMinCount}" max="2000" value="${settings.speakMaxCount}" ${settings.speakLimitMode !== 'count' ? 'disabled' : ''} />
                <span class="unit">文字</span>
              </label>
              <label class="opt-row stacked page-size-row">
                <span>1ページあたりの単位数</span>
                <input type="number" id="set-page-chars" min="10" max="120" value="${settings.charsPerPage}" />
              </label>
            </div>
            <label class="opt-row"><input type="checkbox" id="set-auto-advance" ${settings.autoAdvancePerfect ? 'checked' : ''} /><span>全正解で次へ</span></label>
            <label class="opt-row"><input type="checkbox" id="set-auto-advance-mistakes" ${settings.autoAdvanceWithMistakes ? 'checked' : ''} /><span>ミスありでも次へ</span></label>
          </section>
        </div>
      </aside>`
  }

  function renderKeyboard() {
    // JIS kana legends on romaji QWERTY (学習用のキー表示)
    const hiraOnKey = {
      q: 'た',
      w: 'て',
      e: 'い',
      r: 'す',
      t: 'か',
      y: 'ん',
      u: 'な',
      i: 'に',
      o: 'ら',
      p: 'せ',
      a: 'ち',
      s: 'と',
      d: 'し',
      f: 'は',
      g: 'き',
      h: 'く',
      j: 'ま',
      k: 'の',
      l: 'り',
      z: 'つ',
      x: 'さ',
      c: 'そ',
      v: 'ひ',
      b: 'こ',
      n: 'み',
      m: 'も',
      '-': 'ー',
    }
    const cur = currentTarget()
    const want =
      cur?.kind === 'punct' || cur?.kind === 'space'
        ? currentExpected()
        : currentExpected()[state.buffer.length] || ''
    const { keys, needShift } = resolveHintKeys(want)
    const keySet = new Set(keys)
    const html = renderAnsiKeyboardRows({
      lang: 'ja',
      tag: 'button',
      extraKeyClass: 'key-jp',
      extraClasses: (key) => {
        const parts = []
        if (keySet.has(key.id)) parts.push('hint')
        if (needShift && key.id === 'Shift') parts.push('hint-shift')
        return parts.join(' ')
      },
      renderInner: (key) => {
        if (key.id === ' ') return '<span class="k-hira"></span><span class="k-main">space</span>'
        const hira = hiraOnKey[key.id] || ''
        if (/^[a-z;-]$/.test(key.id) || key.id === '-') {
          return `<span class="k-hira">${hira}</span><span class="k-main">${escapeHtml(key.label)}</span>`
        }
        return `<span class="k-hira"></span><span class="k-main">${escapeHtml(key.label)}</span>`
      },
    })
    return `
      <div class="keyboard-wrap">
        <div class="keyboard keyboard-jp keyboard-full ${settings.keyboardCovered ? 'covered' : ''}">${html}</div>
      </div>`
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
    const mistakeCount = loadJapaneseMistakes().length

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
          <nav class="mode-tabs">${modeButtons}</nav>
          <span class="scheme">Romaji · ひらがな</span>
        </div>
        <div class="top-actions top-actions-meta">
          <button type="button" class="ghost-chip" id="btn-open-mistakes">ミス帳${mistakeCount ? ` · ${mistakeCount}` : ''}</button>
          <button type="button" class="ghost-chip" id="btn-open-settings">設定</button>
        </div>
      </header>
      ${renderTimerBar()}
      ${renderStats()}
      <main class="main">
        <section class="practice-card enter" id="practice-card" tabindex="0">
          ${renderStage()}
          <div class="hints-row hints-row-bottom">
            <span>ローマ字・句読点・スペース · 下に<strong>ひらがな</strong>ヒント</span>
            <span><kbd>Esc</kbd> 入力クリア</span>
            <span><kbd>⌥R</kbd> 再挑戦 · <kbd>⌥N</kbd> 次へ</span>
          </div>
          <input id="key-mirror" class="input-mirror" autocomplete="off" autocapitalize="off" spellcheck="false" />
        </section>
        <div class="toolbar">
          <button type="button" id="btn-skip">スキップ</button>
          <button type="button" id="btn-speak">読み上げ</button>
          <button type="button" id="btn-reset" data-reset-stats>統計リセット</button>
          <button type="button" id="kb-toggle" class="keyboard-option-control">${settings.keyboardCovered ? 'キーボード表示' : 'キーボード非表示'}</button>
        </div>
        ${renderKeyboard()}
      </main>
      <p class="footer-note">日本語トラック · 設定は他言語と分離</p>
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

  async function restartRound() {
    resetSessionStats()
    state.passageHistory = []
    state.historyIndex = -1
    await startPassage(state.mode)
    if (settings.timerMode !== 'off') startSession()
    render()
    focusApp()
  }

  function handleCompletionShortcut(e) {
    if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return false
    if (!state.completed || state.sessionFinished || state.drawer) return false
    if (e.code === 'KeyR') {
      e.preventDefault()
      e.stopPropagation()
      void loadPassageAt(state.passage).then(() => {
        render()
        focusApp()
      })
      return true
    }
    if (e.code === 'KeyN') {
      e.preventDefault()
      e.stopPropagation()
      void goNextPassage()
      return true
    }
    return false
  }

  function bindEvents() {
    document.querySelectorAll('[data-mode]').forEach((btn) =>
      btn.addEventListener('click', () => setMode(btn.dataset.mode)),
    )
    document.querySelectorAll('[data-duration]').forEach((btn) =>
      btn.addEventListener('click', () => setDuration(btn.dataset.duration)),
    )
    document.querySelector('#custom-duration')?.addEventListener('change', (e) => setDuration(e.target.value))
    bindTimerButtons()
    document.querySelector('#kb-toggle')?.addEventListener('click', () =>
      applySettingsPatch({ keyboardCovered: !settings.keyboardCovered }),
    )
    document.querySelectorAll('#btn-skip, [data-practice-skip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!state.sessionFinished) {
          clearAdvanceTimer()
          goNextPassage()
        }
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
        void startPassage(state.mode).then(() => {
          render()
          focusApp()
        })
      })
    })
    document.querySelector('#btn-next-passage')?.addEventListener('click', () => void goNextPassage())
    document.querySelector('#btn-redo-passage')?.addEventListener('click', () => {
      void loadPassageAt(state.passage).then(() => {
        render()
        focusApp()
      })
    })
    document.querySelector('#btn-prev-passage')?.addEventListener('click', () => void goHistory(-1))
    document.querySelector('#btn-next-passage-nav')?.addEventListener('click', () => void goNextPassage())
    document.querySelector('#btn-prev-page')?.addEventListener('click', () => goPage(-1))
    document.querySelector('#btn-next-page')?.addEventListener('click', () => goPage(1))
    document.querySelector('#file-upload')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (file) handleUploadedFile(file)
    })
    document.querySelectorAll('[data-remove-doc]').forEach((btn) =>
      btn.addEventListener('click', () => {
        removeJapaneseDoc(btn.dataset.removeDoc)
        render()
      }),
    )
    document.querySelector('#btn-open-mistakes')?.addEventListener('click', () => openDrawer('mistakes'))
    document.querySelector('#btn-open-settings')?.addEventListener('click', () => openDrawer('settings'))
    document.querySelector('#drawer-backdrop')?.addEventListener('click', closeDrawer)
    document.querySelectorAll('#btn-close-drawer').forEach((btn) => btn.addEventListener('click', closeDrawer))
    document.querySelector('#btn-clear-mistakes')?.addEventListener('click', () => {
      clearJapaneseMistakes()
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
      void startPassage('word').then(() => {
        render()
        syncBottomTabActive()
        focusApp()
      })
    })
    document.querySelectorAll('input[name="timerMode"]').forEach((el) =>
      el.addEventListener('change', (e) => {
        if (e.target.checked) applySettingsPatch({ timerMode: e.target.value })
      }),
    )
    document.querySelector('#set-duration')?.addEventListener('change', (e) =>
      applySettingsPatch({ durationMinutes: Number(e.target.value) || 5 }),
    )
    document.querySelector('#set-page-chars')?.addEventListener('change', (e) =>
      applySettingsPatch({ charsPerPage: Math.max(10, Number(e.target.value) || 40) }),
    )
    document.querySelector('#set-cover')?.addEventListener('change', (e) =>
      applySettingsPatch({ keyboardCovered: e.target.checked }),
    )
    document.querySelector('#set-speak')?.addEventListener('change', (e) =>
      applySettingsPatch({ speakOnCorrect: e.target.checked }),
    )
    document.querySelector('#set-speak-sentence')?.addEventListener('change', (e) =>
      applySettingsPatch({ speakOnSentenceClick: e.target.checked }),
    )
    document.querySelector('#set-speak-hiragana')?.addEventListener('change', (e) =>
      applySettingsPatch({ speakShowHiragana: e.target.checked }),
    )
    document.querySelectorAll('input[name="speak-limit-mode"]').forEach((el) =>
      el.addEventListener('change', (e) => {
        if (e.target.checked) {
          applySettingsPatch({ speakLimitMode: e.target.value === 'count' ? 'count' : 'time' })
        }
      }),
    )
    document.querySelector('#set-speak-minutes')?.addEventListener('change', (e) =>
      applySettingsPatch({ speakMaxMinutes: Number(e.target.value) || 5 }),
    )
    document.querySelector('#set-speak-min-minutes')?.addEventListener('change', (e) =>
      applySettingsPatch({ speakMinMinutes: Number(e.target.value) || 1 }),
    )
    document.querySelector('#set-speak-count')?.addEventListener('change', (e) =>
      applySettingsPatch({ speakMaxCount: Number(e.target.value) || 200 }),
    )
    document.querySelector('#set-speak-min-count')?.addEventListener('change', (e) =>
      applySettingsPatch({ speakMinCount: Number(e.target.value) || 60 }),
    )
    document.querySelector('#set-auto-advance')?.addEventListener('change', (e) =>
      applySettingsPatch({ autoAdvancePerfect: e.target.checked }),
    )
    document.querySelector('#set-auto-advance-mistakes')?.addEventListener('change', (e) =>
      applySettingsPatch({ autoAdvanceWithMistakes: e.target.checked }),
    )

    const mirror = document.querySelector('#key-mirror')
    document.querySelector('#practice-card')?.addEventListener('click', focusApp)
    mirror?.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (handleCompletionShortcut(e)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        if (state.drawer) closeDrawer()
        else {
          state.buffer = ''
          patchLive()
        }
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        state.buffer = state.buffer.slice(0, -1)
        patchLive()
        return
      }
      if (e.key.length === 1 && !e.altKey) {
        e.preventDefault()
        handleKey(e.key)
      }
    })
    focusApp()
  }

  window.addEventListener('keydown', (e) => {
    if (handleCompletionShortcut(e)) return
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (e.key === 'Escape') {
      if (state.drawer) closeDrawer()
      else {
        state.buffer = ''
        patchLive()
      }
      return
    }
    if (state.drawer) return
    if (
      e.key.length === 1 &&
      isPracticeTypingKey(e.key) &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey
    ) {
      e.preventDefault()
      handleKey(e.key)
    }
  })

  if (tickHandle) clearInterval(tickHandle)
  tickHandle = setInterval(() => {
    updateTimerDisplay()
    if (state.startedAt && !state.sessionFinished) patchStats()
  }, 250)

  document.title = '日本語タイピング'
  document.documentElement.lang = 'ja'
  state.remainingMs = state.durationMinutes * 60 * 1000
  void startPassage(state.mode).then(() => {
    render()
    focusApp()
  })
  render()

  registerDrawerHandlers({
    open: (name) => openDrawer(name),
    close: () => closeDrawer(),
    getOpen: () => state.drawer,
  })

  registerModeControl({
    modes: MODES,
    getCurrent: () => state.mode,
    onSelect: (id) => {
      void setMode(id)
    },
  })

  const pending = consumePendingDrawer()
  if (pending) openDrawer(pending)

  installViewportKeyboardSync(
    JA_KEYBOARD_EXPLICIT_KEY,
    () => settings.keyboardCovered,
    (covered) => applySettingsPatch({ keyboardCovered: covered }, { markKeyboardExplicit: false }),
  )
  installMobileTypingViewportSync()
}
