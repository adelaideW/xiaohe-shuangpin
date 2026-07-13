import './style.css'
import { toXiaohe, KEYBOARD_LAYOUT, selfTest } from './xiaohe.js'
import { CHARACTERS, SENTENCES, ARTICLES, buildUnits } from './data.js'

const STORAGE_MODE = 'xiaohe-practice-mode'
const STORAGE_KB = 'xiaohe-keyboard-covered'
const STORAGE_BEST = 'xiaohe-best-combo'

const MODES = [
  { id: 'character', label: '单字练习' },
  { id: 'sentence', label: '句子练习' },
  { id: 'article', label: '文章练习' },
]

function loadMode() {
  const saved = localStorage.getItem(STORAGE_MODE)
  if (MODES.some((m) => m.id === saved)) return saved
  return 'character'
}

function saveMode(mode) {
  localStorage.setItem(STORAGE_MODE, mode)
}

const state = {
  mode: loadMode(),
  typed: '',
  buffer: '',
  correct: 0,
  wrong: 0,
  combo: 0,
  best: Number(localStorage.getItem(STORAGE_BEST) || 0),
  startedAt: null,
  keystrokes: 0,
  keyboardCovered: localStorage.getItem(STORAGE_KB) === '1',
  showHints: true,
  // character mode
  currentChar: null,
  // passage modes
  passage: null,
  units: [],
  unitIndex: 0,
  completed: false,
}

const app = document.querySelector('#app')

function shufflePick(list, avoid) {
  if (list.length === 1) return list[0]
  let item
  do {
    item = list[Math.floor(Math.random() * list.length)]
  } while (avoid && item === avoid)
  return item
}

function currentTarget() {
  if (state.mode === 'character') {
    return state.currentChar
  }
  return state.units[state.unitIndex] || null
}

function currentCode() {
  const t = currentTarget()
  return t ? toXiaohe(t.pinyin) : ''
}

function ensureTimer() {
  if (!state.startedAt) state.startedAt = performance.now()
}

function elapsedMinutes() {
  if (!state.startedAt) return 0
  return Math.max((performance.now() - state.startedAt) / 60000, 1 / 60)
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

function nextCharacter() {
  state.currentChar = shufflePick(CHARACTERS, state.currentChar)
  state.buffer = ''
  state.completed = false
}

function startPassage(mode) {
  const pool = mode === 'article' ? ARTICLES : SENTENCES
  state.passage = shufflePick(pool, state.passage)
  state.units = buildUnits(state.passage.text, state.passage.pinyin)
  state.unitIndex = 0
  state.buffer = ''
  state.completed = false
}

function resetSessionStats() {
  state.correct = 0
  state.wrong = 0
  state.combo = 0
  state.startedAt = null
  state.keystrokes = 0
  state.buffer = ''
  state.completed = false
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
      nextCharacter()
      render()
    }, 180)
    render()
    return
  }

  state.unitIndex += 1
  if (state.unitIndex >= state.units.length) {
    state.completed = true
  }
  render()
}

function onWrongKey() {
  state.wrong += 1
  state.combo = 0
  state.buffer = ''
  render()
}

function handleKey(key) {
  if (state.completed) return
  const target = currentTarget()
  if (!target) return

  ensureTimer()
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
  if (state.buffer === code) {
    onCorrectSyllable()
  } else {
    render()
  }
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
  const initKey = state.showHints && code ? code[0] : ''
  const finalKey = state.showHints && code ? code[1] : ''
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
          if (typedLen === 0 && initKey && keyId === initKey) {
            /* awaiting initial */
          } else if (typedLen >= 1 && initKey && keyId === initKey) {
            /* already typed */
          }
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
        .map((ch, i) => {
          const filled = i < state.buffer.length
          const err = false
          return `<div class="code-slot ${filled ? 'filled' : ''} ${err ? 'error' : ''}">${filled ? state.buffer[i] : ''}</div>`
        })
        .join('')}
    </div>
  `
}

function renderCharacterStage() {
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

function renderPassageStage() {
  if (!state.passage) return ''
  if (state.completed) {
    return `
      <div class="complete-banner">
        <h2>完成！</h2>
        <p>准确率 ${accuracy()}% · ${cpm()} 字/分</p>
        <div class="toolbar">
          <button type="button" class="primary" id="btn-next-passage">再来一篇</button>
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
    <div class="char-stage" style="width:100%;align-items:stretch">
      <div class="passage-meta">
        <span class="title">${state.passage.title}</span>
        <span>${state.unitIndex}/${state.units.length}</span>
      </div>
      <div class="passage">${chars}</div>
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
    ${renderStats()}
    <main class="main">
      <section class="practice-card" id="practice-card" tabindex="0">
        <div class="hints-row">
          <span><kbd>Space</kbd> 朗读</span>
          <span><kbd>Esc</kbd> 清空当前输入</span>
          <span>直接敲击声母 + 韵母两键</span>
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
    <p class="footer-note">本地练习 · 偏好已自动保存 · 灵感来自 ulpb.app</p>
  `

  bindEvents()
}

function bindEvents() {
  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode))
  })

  document.querySelector('#kb-toggle')?.addEventListener('click', () => {
    state.keyboardCovered = !state.keyboardCovered
    localStorage.setItem(STORAGE_KB, state.keyboardCovered ? '1' : '0')
    render()
  })

  document.querySelector('#btn-skip')?.addEventListener('click', () => {
    if (state.mode === 'character') {
      nextCharacter()
    } else if (!state.completed) {
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
    startPassage(state.mode)
    render()
    focusApp()
  })

  const mirror = document.querySelector('#key-mirror')
  const card = document.querySelector('#practice-card')
  card?.addEventListener('click', focusApp)
  mirror?.addEventListener('keydown', (e) => {
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

  // Keep focus
  focusApp()
}

// Global fallback so typing works even if mirror loses focus
window.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (e.key === 'Escape') {
    state.buffer = ''
    render()
    return
  }
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

// Live stats tick
setInterval(() => {
  if (!state.startedAt || state.completed) return
  const values = document.querySelectorAll('.stat .value')
  if (values.length >= 6) {
    values[3].textContent = `${accuracy()}%`
    values[4].textContent = String(cpm())
    values[5].textContent = String(kpm())
  }
}, 1000)

// Boot
if (import.meta.env.DEV) {
  const results = selfTest()
  const failed = results.filter((r) => !r.ok)
  if (failed.length) console.warn('Xiaohe self-test failures', failed)
  else console.info('Xiaohe self-test passed', results.length)
}

if (state.mode === 'character') nextCharacter()
else startPassage(state.mode)

render()
