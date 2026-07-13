/**
 * Japanese typing practice — romaji input with ひらがな hints. Isolated storage.
 */

import { toRomaji, toHiragana } from 'wanakana'
import {
  loadJapaneseSettings,
  saveJapaneseSettings,
  DEFAULT_JAPANESE_SETTINGS,
} from './settings.js'
import {
  JP_WORDS,
  JP_SENTENCES,
  JP_ARTICLES,
  buildJapaneseUnits,
  buildJapanesePages,
  pageIndexForUnit,
  countJapaneseUnits,
  passageDisplayText,
  passageFromJapaneseText,
} from './data.js'
import {
  loadJapaneseMistakes,
  recordJapaneseMistake,
  clearJapaneseMistakes,
  summarizeJapaneseMistakes,
} from './mistakes.js'
import { loadJapaneseLibrary, addJapaneseDoc, removeJapaneseDoc } from './library.js'
import { extractFromFile } from '../upload.js'
import { PUNCT_KEYS, punctTypingKey } from '../punct.js'

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

  function getArticlePool() {
    const min = settings.minArticleChars
    const built = JP_ARTICLES.filter((p) => countJapaneseUnits(p) >= min)
    const user = loadJapaneseLibrary()
      .map((d) => {
        try {
          return passageFromJapaneseText(d.title, d.text)
        } catch {
          return null
        }
      })
      .filter((p) => p && countJapaneseUnits(p) >= min)
    const pool = [...built, ...user]
    return pool.length ? pool : JP_ARTICLES
  }

  function pickPassage(mode) {
    if (mode === 'word') return shufflePick(JP_WORDS, state.passage)
    if (mode === 'article') return shufflePick(getArticlePool(), state.passage)
    return shufflePick(JP_SENTENCES, state.passage)
  }

  function loadPassageAt(passage) {
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

  function setMode(mode) {
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
    settings = saveJapaneseSettings({ durationMinutes: n })
    if (!state.sessionActive) state.remainingMs = n * 60 * 1000
    render()
    focusApp()
  }

  function applySettingsPatch(patch) {
    settings = saveJapaneseSettings(patch)
    if (patch.durationMinutes != null) {
      state.durationMinutes = settings.durationMinutes
      if (!state.sessionActive) state.remainingMs = state.durationMinutes * 60 * 1000
    }
    if (patch.charsPerPage != null && state.units.length) {
      state.pages = buildJapanesePages(state.units, settings.charsPerPage)
      state.pageIndex = pageIndexForUnit(state.pages, state.unitIndex)
    }
    if (state.drawer === 'settings') {
      if (
        'speakLimitMode' in patch ||
        'speakMaxMinutes' in patch ||
        'speakMaxCount' in patch
      ) {
        render()
      } else if ('timerMode' in patch) {
        renderTimerControls()
      }
      return
    }
    render()
    focusApp()
  }

  function ensureSession() {
    if (state.sessionFinished || state.sessionActive) return true
    if (settings.timerMode === 'manual') return true
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
      return
    }
    patchLive()
  }

  function onWrong(typed) {
    const t = currentTarget()
    if (t) {
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
    if (!t || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(t.surface)
    u.lang = 'ja-JP'
    u.rate = 0.9
    window.speechSynthesis.speak(u)
  }

  function speakPassage() {
    if (!state.passage || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(passageDisplayText(state.passage))
    u.lang = 'ja-JP'
    u.rate = 0.9
    window.speechSynthesis.speak(u)
  }

  function focusApp() {
    if (state.drawer) return
    document.querySelector('#key-mirror')?.focus({ preventScroll: true })
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

  function patchStats() {
    const values = document.querySelectorAll('.stat .value')
    if (values.length < 6) return
    values[0].textContent = String(state.correct)
    values[1].textContent = String(state.combo)
    values[2].textContent = String(state.best)
    values[3].textContent = `${accuracy()}%`
    values[4].textContent = String(state.startedAt ? cpm() : 0)
    values[5].textContent = String(state.keystrokes)
  }

  function patchLive() {
    if (!state.passage || state.completed || state.sessionFinished) return
    const cur = currentTarget()
    const doneSeg = new Set(state.units.slice(0, state.unitIndex).map((u) => u.index))
    document.querySelectorAll('.jp-seg').forEach((el) => {
      const i = Number(el.dataset.seg)
      el.classList.toggle('done', doneSeg.has(i))
      el.classList.toggle('current', cur && i === cur.index)
    })
    const metaProg = document.querySelector('.passage-progress')
    if (metaProg) {
      metaProg.textContent = `${state.unitIndex}/${state.units.length}${
        state.passageWrong ? ` · 誤 ${state.passageWrong}` : ''
      }`
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
          return `<div class="code-slot ${filled ? 'filled' : ''}">${filled ? state.buffer[i] : ''}</div>`
        })
        .join('')
    }
    patchStats()
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
      loadPassageAt(passage)
      state.uploadMessage = `追加: ${passage.title} · ${countJapaneseUnits(passage)} 単位`
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
    const presets = DURATION_PRESETS.map(
      (m) =>
        `<button type="button" class="dur-btn ${state.durationMinutes === m && !state.sessionActive ? 'active' : ''}" data-duration="${m}" ${state.sessionActive ? 'disabled' : ''}>${m} 分</button>`,
    ).join('')
    return `
      <div class="timer-bar">
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
      </div>`
  }

  function renderStats() {
    return `
      <div class="stats">
        <div class="stat"><span class="label">正解</span><span class="value">${state.correct}</span></div>
        <div class="stat"><span class="label">連打</span><span class="value">${state.combo}</span></div>
        <div class="stat"><span class="label">ベスト</span><span class="value">${state.best}</span></div>
        <div class="stat"><span class="label">正確率</span><span class="value">${accuracy()}%</span></div>
        <div class="stat"><span class="label">単位/分</span><span class="value">${state.startedAt ? cpm() : 0}</span></div>
        <div class="stat"><span class="label">打鍵</span><span class="value">${state.keystrokes}</span></div>
      </div>`
  }

  function renderStage() {
    if (!state.passage) return ''
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
    const doneSeg = new Set(state.units.slice(0, state.unitIndex).map((u) => u.index))
    const page = state.pages[state.pageIndex] || { start: 0, end: state.units.length }
    const pageUnitIndexes = new Set(
      state.units.slice(page.start, page.end).map((u) => u.index),
    )
    // Include leading/trailing punctuation on page by segment range
    const pageSegStart = state.units[page.start]?.index ?? 0
    const pageSegEnd = state.units[page.end - 1]?.index ?? pageSegStart
    const segs = state.passage.segments || []

    const chars = segs
      .map((seg, i) => {
        if (i < pageSegStart || i > pageSegEnd) return ''
        if (!pageUnitIndexes.has(i) && seg.kana) {
          // skip units outside page already handled
        }
        const classes = ['jp-seg']
        if (!seg.kana) classes.push('jp-punct')
        if (seg.surface === ' ' || seg.surface === '\u3000') classes.push('jp-space')
        if (doneSeg.has(i)) classes.push('done')
        if (cur && i === cur.index) classes.push('current')
        const show =
          seg.surface === ' ' || seg.surface === '\u3000' ? '&nbsp;' : escapeHtml(seg.surface)
        return `<span class="${classes.join(' ')}" data-seg="${i}">${show}</span>`
      })
      .join('')

    const exp = currentExpected()
    const slots = [...exp]
      .map((ch, i) => {
        const filled = i < state.buffer.length
        return `<div class="code-slot ${filled ? 'filled' : ''}">${filled ? state.buffer[i] : ''}</div>`
      })
      .join('')

    const multiPage = state.pages.length > 1
    const progress = `${state.unitIndex}/${state.units.length}${state.passageWrong ? ` · 誤 ${state.passageWrong}` : ''}`
    const canPrev = state.historyIndex > 0
    const hira = cur ? hintHiragana(cur.kana) : ''

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
            <label class="ghost-chip upload-chip">${state.uploadBusy ? '…' : 'アップロード'}
              <input type="file" id="file-upload" accept=".txt,.md,.pdf,.epub,.png,.jpg,.jpeg,.webp,text/plain,application/pdf,image/*" hidden ${state.uploadBusy ? 'disabled' : ''} />
            </label>
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
        <div class="passage-scroll">
          <div class="passage poem jp-passage">${chars}</div>
        </div>
        <div class="typing-chrome">
          <div class="pinyin-line">${cur ? `${hira} · ${exp}` : ''}</div>
          <div class="code-progress">${slots}</div>
        </div>
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
          <button type="button" class="btn-warning" id="btn-clear-mistakes">クリア</button>
          <button type="button" class="primary" id="btn-close-drawer">完了</button>
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
            <label class="opt-row stacked"><span>既定の分数</span><input type="number" id="set-duration" min="1" max="60" value="${settings.durationMinutes}" /></label>
          </section>
          <section class="drawer-section">
            <h3>文章</h3>
            <label class="opt-row stacked"><span>最小単位数（ヒント付き語など）</span><input type="number" id="set-min-chars" min="1" max="500" value="${settings.minArticleChars}" /></label>
            <label class="opt-row stacked"><span>1ページあたりの単位数</span><input type="number" id="set-page-chars" min="10" max="120" value="${settings.charsPerPage}" /></label>
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
            <label class="opt-row"><input type="checkbox" id="set-cover" ${settings.keyboardCovered ? 'checked' : ''} /><span>キーボードを隠す</span></label>
            <label class="opt-row"><input type="checkbox" id="set-speak" ${settings.speakOnCorrect ? 'checked' : ''} /><span>正解で読み上げ</span></label>
            <label class="opt-row"><input type="checkbox" id="set-speak-sentence" ${settings.speakOnSentenceClick ? 'checked' : ''} /><span>文をクリックしたとき読み上げ（スピーキング）</span></label>
            <div class="opt-block">
              <p class="drawer-lead" style="margin-bottom:0.5rem">スピーキング長さ — <strong>時間</strong>か<strong>文字数</strong>のどちらか</p>
              <label class="opt-row">
                <input type="radio" name="speak-limit-mode" value="time" ${settings.speakLimitMode !== 'count' ? 'checked' : ''} />
                <span>最大分数</span>
              </label>
              <label class="field-row"><span>分</span>
                <input type="number" id="set-speak-minutes" min="1" max="30" value="${settings.speakMaxMinutes}" ${settings.speakLimitMode === 'count' ? 'disabled' : ''} />
              </label>
              <label class="opt-row">
                <input type="radio" name="speak-limit-mode" value="count" ${settings.speakLimitMode === 'count' ? 'checked' : ''} />
                <span>最大文字数</span>
              </label>
              <label class="field-row"><span>文字</span>
                <input type="number" id="set-speak-count" min="10" max="2000" value="${settings.speakMaxCount}" ${settings.speakLimitMode !== 'count' ? 'disabled' : ''} />
              </label>
            </div>
            <label class="opt-row"><input type="checkbox" id="set-auto-advance" ${settings.autoAdvancePerfect ? 'checked' : ''} /><span>全正解で次へ</span></label>
            <label class="opt-row"><input type="checkbox" id="set-auto-advance-mistakes" ${settings.autoAdvanceWithMistakes ? 'checked' : ''} /><span>ミスありでも次へ</span></label>
          </section>
        </div>
        <div class="drawer-foot"><button type="button" class="primary" id="btn-close-drawer">完了</button></div>
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
    }
    const rows = [
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '-'],
      ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
      [...PUNCT_KEYS.filter((k) => k !== '-')],
      [' '],
    ]
    const cur = currentTarget()
    const nextKey = currentExpected()[state.buffer.length] || ''
    const html = rows
      .map(
        (row) =>
          `<div class="kb-row">${row
            .map((k) => {
              const hira = hiraOnKey[k] || (k === '-' ? 'ー' : '')
              const label = k === ' ' ? 'space' : k === '-' ? '-' : k
              const wide = k === ' ' ? ' key-wide' : ''
              const hinted =
                cur?.kind === 'punct' || cur?.kind === 'space'
                  ? k === currentExpected()
                  : k === nextKey
              return `<button type="button" class="key key-jp${wide} ${hinted ? 'hint' : ''}" data-key="${escapeHtml(k)}" tabindex="-1">
                <span class="k-hira">${hira}</span>
                <span class="k-main">${escapeHtml(label)}</span>
              </button>`
            })
            .join('')}</div>`,
      )
      .join('')
    return `
      <div class="keyboard-wrap">
        <div class="keyboard keyboard-jp ${settings.keyboardCovered ? 'covered' : ''}">${html}</div>
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

    root.innerHTML = `
      <header class="topbar">
        <div class="brand brand-modes">
          <nav class="mode-tabs">${modeButtons}</nav>
          <span class="scheme">Romaji · ひらがな</span>
        </div>
        <div class="top-actions">
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
          <button type="button" id="btn-reset">統計リセット</button>
          <button type="button" id="kb-toggle">${settings.keyboardCovered ? 'キーボード表示' : 'キーボード非表示'}</button>
        </div>
        ${renderKeyboard()}
      </main>
      <p class="footer-note">日本語トラック · 設定は他言語と分離</p>
      ${state.drawer ? `<div class="drawer-backdrop" id="drawer-backdrop"></div>${drawer}` : ''}
    `
    bindEvents()
    state.drawerJustOpened = false
  }

  function restartRound() {
    resetSessionStats()
    state.passageHistory = []
    state.historyIndex = -1
    startPassage(state.mode)
    startSession()
    render()
    focusApp()
  }

  function handleCompletionShortcut(e) {
    if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return false
    if (!state.completed || state.sessionFinished || state.drawer) return false
    if (e.code === 'KeyR') {
      e.preventDefault()
      e.stopPropagation()
      loadPassageAt(state.passage)
      render()
      focusApp()
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
    document.querySelector('#btn-skip')?.addEventListener('click', () => {
      if (!state.sessionFinished) {
        clearAdvanceTimer()
        goNextPassage()
      }
    })
    document.querySelector('#btn-speak')?.addEventListener('click', speakPassage)
    document.querySelector('#btn-reset')?.addEventListener('click', () => {
      resetSessionStats()
      state.passageHistory = []
      state.historyIndex = -1
      startPassage(state.mode)
      render()
      focusApp()
    })
    document.querySelector('#btn-next-passage')?.addEventListener('click', goNextPassage)
    document.querySelector('#btn-redo-passage')?.addEventListener('click', () => {
      loadPassageAt(state.passage)
      render()
      focusApp()
    })
    document.querySelector('#btn-prev-passage')?.addEventListener('click', () => goHistory(-1))
    document.querySelector('#btn-next-passage-nav')?.addEventListener('click', goNextPassage)
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
    document.querySelectorAll('input[name="timerMode"]').forEach((el) =>
      el.addEventListener('change', (e) => {
        if (e.target.checked) applySettingsPatch({ timerMode: e.target.value })
      }),
    )
    document.querySelector('#set-duration')?.addEventListener('change', (e) =>
      applySettingsPatch({ durationMinutes: Number(e.target.value) || 5 }),
    )
    document.querySelector('#set-min-chars')?.addEventListener('change', (e) =>
      applySettingsPatch({ minArticleChars: Math.max(1, Number(e.target.value) || 20) }),
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
    document.querySelector('#set-speak-count')?.addEventListener('change', (e) =>
      applySettingsPatch({ speakMaxCount: Number(e.target.value) || 200 }),
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
      (/^[a-zA-Z.,!?;:'"/\- ]$/.test(e.key) || e.key === ' ') &&
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
  startPassage(state.mode)
  render()
}
