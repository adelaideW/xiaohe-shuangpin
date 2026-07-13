import './style.css'
import { encode, getLayout, getSchemeLabel, selfTestScheme } from './schemes.js'
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

const STORAGE_MODE = 'xiaohe-practice-mode'
const STORAGE_BEST = 'xiaohe-best-combo'

const MODES = [
  { id: 'character', label: '单字练习' },
  { id: 'sentence', label: '句子练习' },
  { id: 'article', label: '文章练习' },
]

const DURATION_PRESETS = [1, 3, 5, 10]

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
  remainingMs: 0,
  autoAdvanceNote: '',
  // navigation
  passageHistory: [],
  historyIndex: -1,
  // drawers
  drawer: null, // 'mistakes' | 'settings' | null
  drawerJustOpened: false,
}

const app = document.querySelector('#app')
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
  return t ? encode(settings.scheme, t.pinyin) : ''
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function elapsedMinutes() {
  if (!state.startedAt) return 0
  const end = state.sessionFinished
    ? state.sessionEndsAt || performance.now()
    : performance.now()
  return Math.max((end - state.startedAt) / 60000, 1 / 60)
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

function nextCharacter() {
  const pool = settings.smartPractice ? smartCharacterPool() : CHARACTERS
  state.currentChar = shufflePick(pool, state.currentChar)
  state.buffer = ''
  state.completed = false
  state.autoAdvanceNote = ''
}

function loadPassageAt(passage) {
  state.passage = passage
  state.units = buildUnits(passage.text, passage.pinyin)
  state.unitIndex = 0
  state.buffer = ''
  state.completed = false
  state.passageWrong = 0
  state.autoAdvanceNote = ''
}

function pickNewPassage(mode) {
  const pool = settings.smartPractice
    ? smartPassagePool(mode === 'article' ? 'article' : 'sentence')
    : mode === 'article'
      ? ARTICLES
      : SENTENCES
  return shufflePick(pool, state.passage)
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
  state.sessionEndsAt = null
  state.remainingMs = state.durationMinutes * 60 * 1000
  clearAdvanceTimer()
}

function startSession() {
  if (state.sessionActive || state.sessionFinished) return
  state.sessionActive = true
  state.sessionFinished = false
  state.startedAt = performance.now()
  state.sessionEndsAt = state.startedAt + state.durationMinutes * 60 * 1000
  state.remainingMs = state.durationMinutes * 60 * 1000
  updateTimerDisplay()
}

function endSession() {
  if (state.sessionFinished) return
  state.sessionActive = false
  state.sessionFinished = true
  state.remainingMs = 0
  state.completed = true
  clearAdvanceTimer()
  render()
}

function updateTimerDisplay() {
  if (!state.sessionActive || state.sessionFinished) return
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
  }
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
      next.querySelector('#kb-toggle')?.addEventListener('click', () => {
        applySettingsPatch({ keyboardCovered: !settings.keyboardCovered })
      })
    }
    patchLive()
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

  // While settings drawer is open, avoid full-page rebuild (causes blink)
  if (state.drawer === 'settings') {
    softApplySettingsVisuals(patch)
    return
  }

  render()
  focusApp()
}

function ensureSession() {
  if (state.sessionActive || state.sessionFinished) return true
  if (settings.timerMode === 'manual') {
    // Require explicit start — allow typing but don't start clock
    return true
  }
  startSession()
  const right = document.querySelector('.timer-right')
  if (right) {
    right.innerHTML = `
      <span class="timer-value" id="timer-value">${formatTime(state.remainingMs)}</span>
      <button type="button" id="btn-end-timer">结束</button>
    `
    document.querySelector('#btn-end-timer')?.addEventListener('click', () => endSession())
  }
  document.querySelectorAll('[data-duration], #custom-duration').forEach((el) => {
    el.disabled = true
  })
  document.querySelectorAll('.dur-btn').forEach((el) => el.classList.remove('active'))
  return true
}

function onPassageComplete() {
  state.passagesDone += 1
  const clean = state.passageWrong === 0
  // Auto-advance on a perfect pass while practicing (timer optional but preferred)
  const autoOk =
    settings.autoAdvancePerfect &&
    clean &&
    !state.sessionFinished

  if (autoOk) {
    clearAdvanceTimer()
    state.completed = false
    state.autoAdvanceNote = ''
    goNextPassage()
    return
  }

  state.completed = true
  state.autoAdvanceNote = clean ? '' : '有错字 · 点下一篇继续'
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
  line.textContent = `${t.pinyin} · ${encode(settings.scheme, t.pinyin)}`
}

function patchKeyboardHints() {
  const code = currentCode()
  const initKey = settings.showHints && code && !state.sessionFinished ? code[0] : ''
  const finalKey = settings.showHints && code && !state.sessionFinished ? code[1] : ''
  const typedLen = state.buffer.length
  document.querySelectorAll('.key[data-key]').forEach((el) => {
    const keyId = el.dataset.key
    el.classList.toggle('hint-initial', Boolean(initKey && keyId === initKey && typedLen === 0))
    el.classList.toggle('hint-final', Boolean(finalKey && keyId === finalKey && typedLen === 1))
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

  passage.querySelectorAll('.ch').forEach((el, i) => {
    el.classList.toggle('done', doneIndexes.has(i))
    el.classList.toggle('current', i === currentIndex)
  })

  const metaRight = document.querySelector('.passage-progress')
  if (metaRight) {
    metaRight.textContent = `${state.unitIndex}/${state.units.length}${
      state.passageWrong ? ` · 错 ${state.passageWrong}` : ''
    }`
  }
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
  patchLive()
}

function onWrongKey(typed) {
  const target = currentTarget()
  const expectedCode = currentCode()
  if (target) {
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
  if (settings.timerMode === 'manual' && !state.sessionActive && !state.sessionFinished) {
    // Still allow practice without timer; clock stays idle until Start
  }
  const target = currentTarget()
  if (!target) return

  ensureSession()
  const code = currentCode()
  if (!code) return

  const lower = key.toLowerCase()
  if (!/^[a-z;]$/.test(lower)) return

  // In manual mode without session, still count practice but CPM uses startedAt only when active
  if (settings.timerMode === 'auto') {
    // ensureSession already started
  } else if (!state.sessionActive && !state.startedAt) {
    // Track informal start for CPM only after Start — leave startedAt null until Start
  }

  state.keystrokes += 1
  const nextBuf = state.buffer + lower
  const expected = code.slice(0, nextBuf.length)

  if (nextBuf !== expected) {
    onWrongKey(nextBuf)
    return
  }

  state.buffer = nextBuf
  if (state.buffer === code) onCorrectSyllable()
  else patchLive()
}

function speakCurrent() {
  const t = currentTarget()
  if (!t || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(t.char)
  u.lang = 'zh-CN'
  u.rate = 0.9
  window.speechSynthesis.speak(u)
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
          <label class="opt-row stacked">
            <span>默认时长（分钟）</span>
            <input type="number" id="set-duration" min="1" max="60" value="${settings.durationMinutes}" />
          </label>
        </section>
        <section class="drawer-section">
          <h3>双拼方案</h3>
          ${schemes}
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
            <input type="checkbox" id="set-auto-advance" ${settings.autoAdvancePerfect ? 'checked' : ''} />
            <span>全对时自动下一篇</span>
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
  const presets = DURATION_PRESETS.map(
    (m) =>
      `<button type="button" class="dur-btn ${state.durationMinutes === m && !state.sessionActive ? 'active' : ''}" data-duration="${m}" ${state.sessionActive ? 'disabled' : ''}>${m} 分</button>`,
  ).join('')

  let status
  if (state.sessionFinished) {
    status = `<span class="timer-value done">结束</span>`
  } else if (state.sessionActive) {
    status = `<span class="timer-value ${state.remainingMs < 30000 ? 'urgent' : ''}" id="timer-value">${formatTime(state.remainingMs)}</span>`
  } else {
    status = `<span class="timer-value idle" id="timer-value">${formatTime(state.durationMinutes * 60 * 1000)}</span>`
  }

  return `
    <div class="timer-bar">
      <div class="timer-left">
        <span class="timer-label">练习时长</span>
        <div class="dur-group">${presets}</div>
        <label class="custom-dur">
          <input type="number" id="custom-duration" min="1" max="60" value="${state.durationMinutes}" ${state.sessionActive ? 'disabled' : ''} />
          <span>分钟</span>
        </label>
      </div>
      <div class="timer-right">
        ${status}
        ${
          state.sessionFinished
            ? `<button type="button" class="primary" id="btn-restart-timer">再练一轮</button>`
            : state.sessionActive
              ? `<button type="button" id="btn-end-timer">结束</button>`
              : `<button type="button" class="primary" id="btn-start-timer">开始计时</button>`
        }
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
  const code = currentCode()
  const initKey = settings.showHints && code && !state.sessionFinished ? code[0] : ''
  const finalKey = settings.showHints && code && !state.sessionFinished ? code[1] : ''
  const typedLen = state.buffer.length

  const rows = layout
    .map(
      (row) => `
    <div class="kb-row">
      ${row
        .map(([display, initLabel, finalLabel]) => {
          const keyId = display === ';' ? ';' : display.toLowerCase()
          const classes = ['key']
          if (initKey && keyId === initKey && typedLen === 0) classes.push('hint-initial')
          if (finalKey && keyId === finalKey && typedLen === 1) classes.push('hint-final')
          return `
            <div class="${classes.join(' ')}" data-key="${keyId}">
              <span class="k-init">${initLabel}</span>
              <span class="k-main">${display}</span>
              <span class="k-final">${finalLabel}</span>
            </div>
          `
        })
        .join('')}
    </div>
  `,
    )
    .join('')

  return `
    <div class="keyboard-wrap">
      <button type="button" class="keyboard-toggle" id="kb-toggle">
        ${settings.keyboardCovered ? '键盘已遮盖 · 点此恢复' : '点此遮盖键盘'}
      </button>
      <div class="legend">
        <span class="init">声母</span>
        <span class="final">韵母</span>
      </div>
      <div class="keyboard ${settings.keyboardCovered ? 'covered' : ''}" id="keyboard">
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
  const code = encode(settings.scheme, t.pinyin)
  return `
    <div class="char-stage">
      <div class="pinyin-line">${t.pinyin} · ${code}</div>
      ${renderCodeSlots()}
      <div class="hanzi">${t.char}</div>
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
    return `
      <div class="complete-banner">
        <h2>${state.passageWrong === 0 ? '全部正确！' : '本篇完成'}</h2>
        <p>${state.autoAdvanceNote || `准确率 ${accuracy()}% · ${cpm()} 字/分`}</p>
        <div class="toolbar">
          <button type="button" class="primary" id="btn-next-passage">下一篇</button>
        </div>
      </div>
    `
  }

  const currentUnit = state.units[state.unitIndex]
  const currentIndex = currentUnit?.index ?? -1
  const doneIndexes = new Set(
    state.units.slice(0, state.unitIndex).map((u) => u.index),
  )

  const chars = [...state.passage.text]
    .map((ch, i) => {
      const classes = ['ch']
      if (doneIndexes.has(i)) classes.push('done')
      if (i === currentIndex) classes.push('current')
      return `<span class="${classes.join(' ')}">${ch}</span>`
    })
    .join('')

  const code = currentCode()
  return `
    <div class="char-stage passage-stage">
      <div class="passage-meta">
        <div class="passage-title-row">
          ${renderPassageNav()}
          <span class="title">${state.passage.title}${settings.smartPractice ? ' · 智能' : ''}</span>
        </div>
        <span class="passage-progress">${state.unitIndex}/${state.units.length}${state.passageWrong ? ` · 错 ${state.passageWrong}` : ''}</span>
      </div>
      <div class="passage poem">${chars}</div>
      <div class="typing-chrome">
        <div class="pinyin-line">${currentUnit ? `${currentUnit.pinyin} · ${code}` : ''}</div>
        ${renderCodeSlots()}
      </div>
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

  app.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <h1>双拼练习</h1>
        <span class="scheme">${getSchemeLabel(settings.scheme)}</span>
      </div>
      <nav class="mode-tabs" aria-label="练习模式">${modeButtons}</nav>
      <div class="top-actions">
        <button type="button" class="ghost-chip" id="btn-open-mistakes">错字本${mistakeCount ? ` · ${mistakeCount}` : ''}</button>
        <button type="button" class="ghost-chip" id="btn-open-settings">设置</button>
      </div>
    </header>
    ${renderTimerBar()}
    ${renderStats()}
    <main class="main">
      <section class="practice-card enter" id="practice-card" tabindex="0">
        <div class="hints-row">
          <span><kbd>Space</kbd> 朗读</span>
          <span><kbd>Esc</kbd> 清空当前输入</span>
          <span>句子/文章全对时自动下一篇</span>
        </div>
        ${stage}
        <input id="key-mirror" class="input-mirror" autocomplete="off" autocapitalize="off" spellcheck="false" />
      </section>
      <div class="toolbar">
        <button type="button" id="btn-skip">跳过</button>
        <button type="button" id="btn-speak">朗读</button>
        <button type="button" id="btn-reset">重置统计</button>
        <button type="button" id="btn-hints">${settings.showHints ? '隐藏键位提示' : '显示键位提示'}</button>
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
  startSession()
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

  document.querySelector('#btn-start-timer')?.addEventListener('click', () => {
    startSession()
    render()
    focusApp()
  })

  document.querySelector('#btn-end-timer')?.addEventListener('click', () => endSession())

  document.querySelectorAll('#btn-restart-timer').forEach((btn) => {
    btn.addEventListener('click', restartRound)
  })

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

  document.querySelector('#btn-prev-passage')?.addEventListener('click', goPrevPassage)
  document.querySelector('#btn-next-passage-nav')?.addEventListener('click', goNextPassage)

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
  document.querySelector('#set-auto-advance')?.addEventListener('change', (e) => {
    applySettingsPatch({ autoAdvancePerfect: e.target.checked })
  })

  const mirror = document.querySelector('#key-mirror')
  const card = document.querySelector('#practice-card')
  card?.addEventListener('click', focusApp)
  mirror?.addEventListener('keydown', (e) => {
    e.stopPropagation()
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
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault()
      speakCurrent()
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

window.addEventListener('keydown', (e) => {
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
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault()
    speakCurrent()
    return
  }
  if (e.key.length === 1 && /^[a-zA-Z;]$/.test(e.key)) {
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
