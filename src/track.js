/**
 * Practice track + left language panel shell.
 * Switching tracks reloads so each language boots in isolation.
 */

const STORAGE_TRACK = 'typing-practice-track'
const STORAGE_PANEL = 'typing-lang-panel-collapsed'

/** @typedef {'shuangpin' | 'english' | 'japanese'} PracticeTrack */

export const TRACKS = [
  {
    id: 'shuangpin',
    label: '中文',
    sub: '打字 & 口语',
    short: '中',
  },
  {
    id: 'english',
    label: 'English',
    sub: 'Typing & speaking',
    short: 'En',
  },
  {
    id: 'japanese',
    label: '日本語',
    sub: 'タイピング & スピーキング',
    short: '日',
  },
]

/** @returns {PracticeTrack} */
export function loadTrack() {
  try {
    const v = localStorage.getItem(STORAGE_TRACK)
    if (v === 'english' || v === 'shuangpin' || v === 'japanese') return v
  } catch {
    /* ignore */
  }
  return 'shuangpin'
}

/** @param {PracticeTrack} track */
export function saveTrack(track) {
  localStorage.setItem(STORAGE_TRACK, track)
}

/** @param {PracticeTrack} track */
export function switchTrack(track) {
  saveTrack(track)
  location.reload()
}

export function loadPanelCollapsed() {
  try {
    return localStorage.getItem(STORAGE_PANEL) === '1'
  } catch {
    return false
  }
}

/** @param {boolean} collapsed */
export function savePanelCollapsed(collapsed) {
  localStorage.setItem(STORAGE_PANEL, collapsed ? '1' : '0')
}

/**
 * Mount left language panel + practice host inside #app.
 * @param {HTMLElement} app
 * @param {PracticeTrack} active
 * @returns {HTMLElement} practice root
 */
export function mountLanguageShell(app, active) {
  const collapsed = loadPanelCollapsed()
  const items = TRACKS.map((t) => {
    const isActive = t.id === active
    return `
      <button
        type="button"
        class="lang-item ${isActive ? 'active' : ''}"
        data-track="${t.id}"
        role="tab"
        aria-selected="${isActive}"
        title="${t.label}"
      >
        <span class="lang-short" aria-hidden="true">${t.short}</span>
        <span class="lang-copy">
          <span class="lang-label">${t.label}</span>
          <span class="lang-sub">${t.sub}</span>
        </span>
      </button>
    `
  }).join('')

  app.innerHTML = `
    <div class="app-shell ${collapsed ? 'is-collapsed' : ''}">
      <aside class="lang-panel" aria-label="Language">
        <div class="lang-panel-head">
          <div class="lang-panel-titles">
            <p class="lang-panel-kicker">Practice</p>
            <p class="lang-panel-title">Language</p>
          </div>
          <button type="button" class="lang-collapse" id="btn-lang-collapse" aria-expanded="${!collapsed}" aria-label="${collapsed ? 'Expand language panel' : 'Collapse language panel'}">
            <span class="lang-collapse-icon" aria-hidden="true">${collapsed ? '»' : '«'}</span>
          </button>
        </div>
        <nav class="lang-list" role="tablist">${items}</nav>
        <p class="lang-panel-note">Each language keeps its own settings & history.</p>
      </aside>
      <div class="app-content" id="practice-root"></div>
    </div>
  `

  document.querySelector('#btn-lang-collapse')?.addEventListener('click', () => {
    const shell = document.querySelector('.app-shell')
    if (!shell) return
    const next = !shell.classList.contains('is-collapsed')
    shell.classList.toggle('is-collapsed', next)
    savePanelCollapsed(next)
    const btn = document.querySelector('#btn-lang-collapse')
    if (btn) {
      btn.setAttribute('aria-expanded', String(!next))
      btn.setAttribute('aria-label', next ? 'Expand language panel' : 'Collapse language panel')
      const icon = btn.querySelector('.lang-collapse-icon')
      if (icon) icon.textContent = next ? '»' : '«'
    }
  })

  document.querySelectorAll('[data-track]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = /** @type {PracticeTrack | null} */ (btn.getAttribute('data-track'))
      if (!t || t === active) return
      if (t === 'english' || t === 'shuangpin' || t === 'japanese') switchTrack(t)
    })
  })

  return /** @type {HTMLElement} */ (document.querySelector('#practice-root'))
}
