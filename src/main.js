import './style.css'
import { toXiaohe, KEYBOARD_LAYOUT, selfTest } from './xiaohe.js'
import { CHARACTERS, SENTENCES, ARTICLES, buildUnits } from './data.js'

const STORAGE_MODE = 'xiaohe-practice-mode'
const STORAGE_KB = 'xiaohe-keyboard-covered'
const STORAGE_BEST = 'xiaohe-best-combo'
const STORAGE_DURATION = 'xiaohe-practice-duration'

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

function loadDuration() {
  const n = Number(localStorage.getItem(STORAGE_DURATION))
  return Number.isFinite(n) && n > 0 ? n : 5
}

function saveDuration(mins) {
  localStorage.setItem(STORAGE_DURATION, String(mins))
}

const state = {
  mode: loadMode(),
  buffer: '',
  correct: 0,
  wrong: 0,
  combo: 0,
  best: Number(localStorage.getItem(STORAGE_BEST) || 0),
  startedAt: null,
  keystrokes: 0,
  keyboardCovered: localStorage.getItem(STORAGE_KB) === '1',
  showHints: true,
  currentChar: null,
  passage: null,
  units: [],
  unitIndex: 0,
  completed: false,
  passageWrong: 0,
  passagesDone: 0,
  // timer
  durationMinutes: loadDuration(),
  sessionEndsAt: null,
  sessionActive: false,
  sessionFinished: false,
  remainingMs: 0,
  autoAdvanceNote: '',
}

const app = document.querySelector('#app')
let tickHandle = null
let advanceTimer = null

function shufflePick(list, avoid) {
  if (list.length === 1) return list[0]
  let item
  do {
    item = list[Math.floor(Math.random() * list.length)]
  } while (avoid && item === avoid)
  return item
}

function currentTarget() {
  if (state.mode === 'character') return state.currentChar
  return state.units[state.unitIndex] || null
}

function currentCode() {
  const t = currentTarget()
  return t ? toXiaohe(t.pinyin) : ''
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
    ? (state.sessionEndsAt || performance.now())
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
  state.currentChar = shufflePick(CHARACTERS, state.currentChar)
  state.buffer = ''
  state.completed = false
  state.autoAdvanceNote = ''
}

function startPassage(mode) {
  const pool = mode === 'article' ? ARTICLES : SENTENCES
  state.passage = shufflePick(pool, state.passage)
  state.units = buildUnits(state.passage.text, state.passage.pinyin)
  state.unitIndex = 0
  state.buffer = ''
  state.completed = false
  state.passageWrong = 0
  state.autoAdvanceNote = ''
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
  if (mode === 'character') nextCharacter()
  else startPassage(mode)
  render()
  focusApp()
}

function setDuration(mins) {
  const n = Math.min(60, Math.max(1, Math.round(Number(mins) || 5)))
  state.durationMinutes = n
  saveDuration(n)
  if (!state.sessionActive) {
    state.remainingMs = n * 60 * 1000
  }
  render()
  focusApp()
}

function ensureSession() {
  if (!state.sessionActive && !state.sessionFinished) startSession()
}

function onPassageComplete() {
  state.passagesDone += 1
  const clean = state.passageWrong === 0
  const timed = state.sessionActive && !state.sessionFinished

  if (timed && clean) {
    state.autoAdvanceNote = '全部正确 · 下一篇'
    state.completed = true
    render()
    clearAdvanceTimer()
    advanceTimer = setTimeout(() => {
      if (!state.sessionActive || state.sessionFinished) return
      startPassage(state.mode)
      render()
      focusApp()
    }, 700)
    return
  }

  state.completed = true
  state.autoAdvanceNote = clean ? '' : '有错字 · 可继续下一篇'
  render()
}

function onCorrectSyllable() {
  state.correct += 1
  state.combo += 1
  if (state.combo > state.best) {
    state.best = state.combo
    localStorage.setItem(STORAGE_BEST, String(state.best))
  }
  state.buffer = ''

  if (state.mode === 'character') {
    const el = document.querySelector('.hanzi')
    if (el) {
      el.classList.remove('correct-flash')
      void el.offsetWidth
      el.classList.add('correct-flash')
    }
    setTimeout(() => {
      if (state.sessionFinished) return
      nextCharacter()
      render()
    }, 180)
    render()
    return
  }

  state.unitIndex += 1
  if (state.unitIndex >= state.units.length) {
    onPassageComplete()
    return
  }
  render()
}

function onWrongKey() {
  state.wrong += 1
  state.passageWrong += 1
  state.combo = 0
  state.buffer = ''
  render()
}

function handleKey(key) {
  if (state.sessionFinished) return
  if (state.completed && state.mode !== 'character') return
  const target = currentTarget()
  if (!target) return

  ensureSession()
  const code = currentCode()
  if (!code) return

  const lower = key.toLowerCase()
  if (!/^[a-z;]$/.test(lower)) return

  state.keystrokes += 1
  const nextBuf = state.buffer + lower
  const expected = code.slice(0, nextBuf.length)

  if (nextBuf !== expected) {
    onWrongKey()
    return
  }

  state.buffer = nextBuf
  if (state.buffer === code) onCorrectSyllable()
  else render()
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
  const mirror = document.querySelector('#key-mirror')
  if (mirror) mirror.focus({ preventScroll: true })
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
  const code = currentCode()
  const initKey = state.showHints && code && !state.sessionFinished ? code[0] : ''
  const finalKey = state.showHints && code && !state.sessionFinished ? code[1] : ''
  const typedLen = state.buffer.length

  const rows = KEYBOARD_LAYOUT.map(
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
  ).join('')

  return `
    <div class="keyboard-wrap">
      <button type="button" class="keyboard-toggle" id="kb-toggle">
        ${state.keyboardCovered ? '键盘已遮盖 · 点此恢复' : '点此遮盖键盘'}
      </button>
      <div class="legend">
        <span class="init">声母</span>
        <span class="final">韵母</span>
      </div>
      <div class="keyboard ${state.keyboardCovered ? 'covered' : ''}" id="keyboard">
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
  const code = toXiaohe(t.pinyin)
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

function renderPassageStage() {
  if (!state.passage) return ''
  if (state.sessionFinished) return renderSessionSummary()

  if (state.completed) {
    return `
      <div class="complete-banner">
        <h2>${state.passageWrong === 0 ? '全部正确！' : '本篇完成'}</h2>
        <p>${state.autoAdvanceNote || `准确率 ${accuracy()}% · ${cpm()} 字/分`}</p>
        ${
          state.autoAdvanceNote.includes('下一篇')
            ? `<p class="advance-hint">即将加载下一篇…</p>`
            : `<div class="toolbar">
                <button type="button" class="primary" id="btn-next-passage">下一篇</button>
              </div>`
        }
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
    <div class="char-stage" style="width:100%;align-items:stretch">
      <div class="passage-meta">
        <span class="title">${state.passage.title}</span>
        <span>${state.unitIndex}/${state.units.length}${state.passageWrong ? ` · 错 ${state.passageWrong}` : ''}</span>
      </div>
      <div class="passage poem">${chars}</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:0.6rem;margin-top:1rem">
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

  app.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <h1>双拼练习</h1>
        <span class="scheme">小鹤双拼</span>
      </div>
      <nav class="mode-tabs" aria-label="练习模式">${modeButtons}</nav>
    </header>
    ${renderTimerBar()}
    ${renderStats()}
    <main class="main">
      <section class="practice-card" id="practice-card" tabindex="0">
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
        <button type="button" id="btn-hints">${state.showHints ? '隐藏键位提示' : '显示键位提示'}</button>
      </div>
      ${renderKeyboard()}
    </main>
    <p class="footer-note">本地练习 · 文章模式收录唐诗 · 偏好已自动保存</p>
  `

  bindEvents()
}

function restartRound() {
  resetSessionStats()
  if (state.mode === 'character') nextCharacter()
  else startPassage(state.mode)
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

  document.querySelector('#btn-end-timer')?.addEventListener('click', () => {
    endSession()
  })

  document.querySelectorAll('#btn-restart-timer').forEach((btn) => {
    btn.addEventListener('click', restartRound)
  })

  document.querySelector('#kb-toggle')?.addEventListener('click', () => {
    state.keyboardCovered = !state.keyboardCovered
    localStorage.setItem(STORAGE_KB, state.keyboardCovered ? '1' : '0')
    render()
  })

  document.querySelector('#btn-skip')?.addEventListener('click', () => {
    if (state.sessionFinished) return
    clearAdvanceTimer()
    if (state.mode === 'character') {
      nextCharacter()
    } else {
      startPassage(state.mode)
    }
    state.buffer = ''
    render()
    focusApp()
  })

  document.querySelector('#btn-speak')?.addEventListener('click', speakCurrent)

  document.querySelector('#btn-reset')?.addEventListener('click', () => {
    resetSessionStats()
    if (state.mode === 'character') nextCharacter()
    else startPassage(state.mode)
    render()
    focusApp()
  })

  document.querySelector('#btn-hints')?.addEventListener('click', () => {
    state.showHints = !state.showHints
    render()
    focusApp()
  })

  document.querySelector('#btn-next-passage')?.addEventListener('click', () => {
    if (state.sessionFinished) return
    startPassage(state.mode)
    render()
    focusApp()
  })

  const mirror = document.querySelector('#key-mirror')
  const card = document.querySelector('#practice-card')
  card?.addEventListener('click', focusApp)
  mirror?.addEventListener('keydown', (e) => {
    if (e.target?.id === 'custom-duration') return
    if (e.key === 'Escape') {
      e.preventDefault()
      state.buffer = ''
      render()
      focusApp()
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
      render()
      focusApp()
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
  const id = document.activeElement?.id
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    if (id === 'custom-duration') return
    if (id !== 'key-mirror') return
  }
  if (e.key === 'Escape') {
    state.buffer = ''
    render()
    return
  }
  if (e.key === ' ' || e.code === 'Space') {
    if (id === 'custom-duration') return
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
  const values = document.querySelectorAll('.stat .value')
  if (values.length >= 6) {
    values[3].textContent = `${accuracy()}%`
    values[4].textContent = String(cpm())
    values[5].textContent = String(kpm())
  }
}, 250)

if (import.meta.env.DEV) {
  const results = selfTest()
  const failed = results.filter((r) => !r.ok)
  if (failed.length) console.warn('Xiaohe self-test failures', failed)
  else console.info('Xiaohe self-test passed', results.length)

  for (const a of ARTICLES) {
    buildUnits(a.text, a.pinyin)
  }
}

state.remainingMs = state.durationMinutes * 60 * 1000
if (state.mode === 'character') nextCharacter()
else startPassage(state.mode)

render()
