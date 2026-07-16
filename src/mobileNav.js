/**
 * Phone-only (≤393px) chrome: language action sheet, bottom tabs, pending drawers.
 */

import { TRACKS, switchTrack } from './track.js'

/** @typedef {'english' | 'japanese' | 'shuangpin'} SkillLang */
/** @typedef {'typing' | 'speaking'} PracticeSkill */
/** @typedef {'mistakes' | 'settings'} DrawerName */

const PENDING_DRAWER_KEY = 'pending-drawer'
const PHONE_MQ = '(max-width: 393px)'

/** @type {null | ((name: DrawerName) => void)} */
let drawerOpener = null

/** @type {null | (() => void)} */
let drawerCloser = null

/** @type {null | (() => string | null)} */
let drawerStateGetter = null

/** @type {PracticeSkill} */
let currentSkill = 'typing'

/** @type {SkillLang} */
let currentLang = 'shuangpin'

/** @type {null | { modes: Array<{ id: string, label: string }>, getCurrent: () => string, onSelect: (id: string) => void }} */
let modeControl = null

export function isPhoneViewport() {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia(PHONE_MQ).matches
  } catch {
    return false
  }
}

/**
 * @param {{
 *   open: (name: DrawerName) => void,
 *   close?: () => void,
 *   getOpen?: () => string | null,
 * }} handlers
 */
export function registerDrawerHandlers(handlers) {
  drawerOpener = handlers.open
  drawerCloser = handlers.close || null
  drawerStateGetter = handlers.getOpen || null
  syncBottomTabActive()
}

/** @param {DrawerName} name */
export function setPendingDrawer(name) {
  try {
    sessionStorage.setItem(PENDING_DRAWER_KEY, name)
  } catch {
    /* ignore */
  }
}

/** @returns {DrawerName | null} */
export function consumePendingDrawer() {
  try {
    const v = sessionStorage.getItem(PENDING_DRAWER_KEY)
    sessionStorage.removeItem(PENDING_DRAWER_KEY)
    if (v === 'mistakes' || v === 'settings') return v
  } catch {
    /* ignore */
  }
  return null
}

/**
 * @param {string} storageKey
 * @param {boolean} [defaultCollapsed]
 */
export function loadStatsCollapsed(storageKey, defaultCollapsed = true) {
  try {
    const v = localStorage.getItem(storageKey)
    if (v === '1') return true
    if (v === '0') return false
  } catch {
    /* ignore */
  }
  return defaultCollapsed
}

/** @param {string} storageKey @param {boolean} collapsed */
export function saveStatsCollapsed(storageKey, collapsed) {
  try {
    localStorage.setItem(storageKey, collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/**
 * Wrap stats HTML with a phone collapsible disclosure.
 * Keeps all `.stat .value` nodes in the DOM for patchStats.
 * @param {string} statsInnerHtml must include a `.stats` root
 * @param {{
 *   storageKey: string,
 *   summaryLabels: { streak: string, accuracy: string },
 *   streakValue: string | number,
 *   accuracyValue: string | number,
 * }} opts
 */
export function wrapCollapsibleStats(statsInnerHtml, opts) {
  const collapsed = loadStatsCollapsed(opts.storageKey, true)
  return `
    <div class="stats-disclosure ${collapsed ? 'is-collapsed' : ''}" data-stats-key="${opts.storageKey}">
      <button type="button" class="stats-summary" id="btn-stats-toggle" aria-expanded="${!collapsed}">
        <span class="stats-summary-item"><span class="stats-summary-label">${opts.summaryLabels.streak}</span> <strong class="stats-summary-streak">${opts.streakValue}</strong></span>
        <span class="stats-summary-item"><span class="stats-summary-label">${opts.summaryLabels.accuracy}</span> <strong class="stats-summary-accuracy">${opts.accuracyValue}</strong></span>
        <span class="stats-summary-chevron" aria-hidden="true">${collapsed ? '▾' : '▴'}</span>
      </button>
      ${statsInnerHtml}
    </div>
  `
}

/** Sync summary strongs from the live `.stat .value` nodes (indices 1 = streak, 3 = accuracy). */
export function patchStatsSummary() {
  const disc = document.querySelector('.stats-disclosure')
  if (!disc) return
  const values = disc.querySelectorAll('.stat .value')
  if (values.length < 4) return
  const streak = disc.querySelector('.stats-summary-streak')
  const accuracy = disc.querySelector('.stats-summary-accuracy')
  if (streak) streak.textContent = values[1].textContent
  if (accuracy) accuracy.textContent = values[3].textContent
}

/** Bind collapse toggle after render. */
export function bindStatsDisclosure() {
  const disc = document.querySelector('.stats-disclosure')
  const btn = document.querySelector('#btn-stats-toggle')
  if (!disc || !btn || btn.dataset.bound === '1') return
  btn.dataset.bound = '1'
  btn.addEventListener('click', () => {
    const next = !disc.classList.contains('is-collapsed')
    disc.classList.toggle('is-collapsed', next)
    btn.setAttribute('aria-expanded', String(!next))
    const chev = btn.querySelector('.stats-summary-chevron')
    if (chev) chev.textContent = next ? '▾' : '▴'
    const key = disc.getAttribute('data-stats-key')
    if (key) saveStatsCollapsed(key, next)
  })
}

/**
 * @param {SkillLang} lang
 * @param {PracticeSkill} activeSkill
 * @param {{ onSkillChange: (skill: PracticeSkill) => void }} hooks
 */
export function mountMobileChrome(lang, activeSkill, hooks) {
  currentSkill = activeSkill
  currentLang = lang
  const track = TRACKS.find((t) => t.id === lang) || TRACKS[0]
  const labels = tabLabels(lang)

  const head = document.querySelector('.skill-lang-head')
  if (head && !head.querySelector('#btn-lang-switch')) {
    let row = head.querySelector('.skill-lang-title-row')
    const title = head.querySelector('.skill-lang-title')
    if (!row) {
      row = document.createElement('div')
      row.className = 'skill-lang-title-row'
      if (title) {
        title.replaceWith(row)
        row.appendChild(title)
      } else {
        head.prepend(row)
      }
    }
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.id = 'btn-lang-switch'
    btn.className = 'lang-switch-btn'
    btn.setAttribute('aria-haspopup', 'dialog')
    btn.setAttribute('aria-expanded', 'false')
    btn.setAttribute('aria-label', labels.chooseLanguage)
    btn.innerHTML = `<span class="lang-switch-short">${track.short}</span><span class="lang-switch-chevron" aria-hidden="true">▾</span>`
    row.appendChild(btn)
    btn.addEventListener('click', () => openLangSheet(true))
  }

  if (!document.querySelector('#lang-action-sheet')) {
    const sheet = document.createElement('div')
    sheet.id = 'lang-action-sheet'
    sheet.className = 'lang-action-sheet'
    sheet.hidden = true
    sheet.innerHTML = `
      <div class="lang-sheet-backdrop" data-close-lang-sheet></div>
      <div class="lang-sheet-panel" role="dialog" aria-modal="true" aria-label="${labels.chooseLanguage}">
        <div class="lang-sheet-handle" aria-hidden="true"></div>
        <p class="lang-sheet-title">${labels.chooseLanguage}</p>
        <div class="lang-sheet-list" role="listbox">
          ${TRACKS.map(
            (t) => `
            <button type="button" class="lang-sheet-item ${t.id === lang ? 'active' : ''}" data-sheet-track="${t.id}" role="option" aria-selected="${t.id === lang}">
              <span class="lang-short">${t.short}</span>
              <span class="lang-sheet-copy">
                <span class="lang-label">${t.label}</span>
                <span class="lang-sub">${t.sub}</span>
              </span>
            </button>`,
          ).join('')}
        </div>
        <button type="button" class="lang-sheet-cancel" data-close-lang-sheet>${labels.cancel}</button>
      </div>
    `
    document.body.appendChild(sheet)
    sheet.querySelectorAll('[data-close-lang-sheet]').forEach((el) => {
      el.addEventListener('click', () => openLangSheet(false))
    })
    sheet.querySelectorAll('[data-sheet-track]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-sheet-track')
        if (!id || id === lang) {
          openLangSheet(false)
          return
        }
        if (id === 'english' || id === 'shuangpin' || id === 'japanese') switchTrack(id)
      })
    })
  }

  if (!document.querySelector('#mobile-bottom-nav')) {
    const nav = document.createElement('nav')
    nav.id = 'mobile-bottom-nav'
    nav.className = 'mobile-bottom-nav'
    nav.setAttribute('aria-label', labels.nav)
    nav.innerHTML = `
      <button type="button" class="mobile-tab" data-mobile-tab="typing" data-skill-tab="1">
        <span class="mobile-tab-icon" aria-hidden="true">${iconTyping()}</span>
        <span class="mobile-tab-label">${labels.typing}</span>
      </button>
      <button type="button" class="mobile-tab" data-mobile-tab="speaking" data-skill-tab="1">
        <span class="mobile-tab-icon" aria-hidden="true">${iconSpeaking()}</span>
        <span class="mobile-tab-label">${labels.speaking}</span>
      </button>
      <button type="button" class="mobile-tab" data-mobile-tab="mistakes">
        <span class="mobile-tab-icon" aria-hidden="true">${iconMistakes()}</span>
        <span class="mobile-tab-label">${labels.mistakes}</span>
      </button>
      <button type="button" class="mobile-tab" data-mobile-tab="settings">
        <span class="mobile-tab-icon" aria-hidden="true">${iconSettings()}</span>
        <span class="mobile-tab-label">${labels.settings}</span>
      </button>
    `
    document.body.appendChild(nav)
    nav.querySelectorAll('[data-mobile-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-mobile-tab')
        handleTab(lang, tab, hooks.onSkillChange)
      })
    })
  }

  document.documentElement.classList.add('has-mobile-chrome')
  syncBottomTabActive()
}

/** @param {boolean} open */
function openLangSheet(open) {
  const sheet = document.querySelector('#lang-action-sheet')
  const btn = document.querySelector('#btn-lang-switch')
  if (!sheet) return
  sheet.hidden = !open
  sheet.classList.toggle('is-open', open)
  document.body.classList.toggle('lang-sheet-open', open)
  if (btn) btn.setAttribute('aria-expanded', String(open))
}

/**
 * Register the practice mode control (words / sentence / article) as a
 * dropdown on the title line. Call once at boot; re-syncs the label if the
 * control already exists.
 * @param {{ modes: Array<{ id: string, label: string }>, getCurrent: () => string, onSelect: (id: string) => void }} config
 */
export function registerModeControl(config) {
  modeControl = config
  const row = document.querySelector('.skill-lang-title-row')
  if (!row) return
  const labels = tabLabels(currentLang)

  if (!row.querySelector('#btn-mode-switch')) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.id = 'btn-mode-switch'
    btn.className = 'mode-switch-btn'
    btn.setAttribute('aria-haspopup', 'dialog')
    btn.setAttribute('aria-expanded', 'false')
    btn.innerHTML = `<span class="mode-switch-label"></span><span class="mode-switch-chevron" aria-hidden="true">▾</span>`
    row.appendChild(btn)
    btn.addEventListener('click', () => openModeSheet(true))
  }

  if (!document.querySelector('#mode-action-sheet')) {
    const sheet = document.createElement('div')
    sheet.id = 'mode-action-sheet'
    sheet.className = 'lang-action-sheet mode-action-sheet'
    sheet.hidden = true
    sheet.innerHTML = `
      <div class="lang-sheet-backdrop" data-close-mode-sheet></div>
      <div class="lang-sheet-panel" role="dialog" aria-modal="true" aria-label="${labels.chooseMode}">
        <div class="lang-sheet-handle" aria-hidden="true"></div>
        <p class="lang-sheet-title">${labels.chooseMode}</p>
        <div class="lang-sheet-list mode-sheet-list" role="listbox"></div>
        <button type="button" class="lang-sheet-cancel" data-close-mode-sheet>${labels.cancel}</button>
      </div>
    `
    document.body.appendChild(sheet)
    sheet.querySelectorAll('[data-close-mode-sheet]').forEach((el) => {
      el.addEventListener('click', () => openModeSheet(false))
    })
  }

  renderModeOptions()
  syncModeControl()
}

function renderModeOptions() {
  const list = document.querySelector('.mode-sheet-list')
  if (!list || !modeControl) return
  const current = modeControl.getCurrent()
  list.innerHTML = modeControl.modes
    .map(
      (m) => `
      <button type="button" class="lang-sheet-item mode-sheet-item ${m.id === current ? 'active' : ''}" data-sheet-mode="${m.id}" role="option" aria-selected="${m.id === current}">
        <span class="lang-sheet-copy"><span class="lang-label">${m.label}</span></span>
      </button>`,
    )
    .join('')
  list.querySelectorAll('[data-sheet-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-sheet-mode')
      openModeSheet(false)
      if (id && modeControl) modeControl.onSelect(id)
    })
  })
}

/** Update the mode button label + active option from the current mode. */
export function syncModeControl() {
  if (!modeControl) return
  const current = modeControl.getCurrent()
  const active = modeControl.modes.find((m) => m.id === current)
  const label = document.querySelector('.mode-switch-label')
  if (label && active) label.textContent = active.label
  const list = document.querySelector('.mode-sheet-list')
  if (list) {
    list.querySelectorAll('[data-sheet-mode]').forEach((btn) => {
      const on = btn.getAttribute('data-sheet-mode') === current
      btn.classList.toggle('active', on)
      btn.setAttribute('aria-selected', String(on))
    })
  }
}

/** @param {boolean} open */
function openModeSheet(open) {
  const sheet = document.querySelector('#mode-action-sheet')
  const btn = document.querySelector('#btn-mode-switch')
  if (!sheet) return
  if (open) renderModeOptions()
  sheet.hidden = !open
  sheet.classList.toggle('is-open', open)
  document.body.classList.toggle('lang-sheet-open', open)
  if (btn) btn.setAttribute('aria-expanded', String(open))
}

/**
 * @param {SkillLang} lang
 * @param {string | null} tab
 * @param {(skill: PracticeSkill) => void} onSkillChange
 */
function handleTab(lang, tab, onSkillChange) {
  if (tab === 'typing' || tab === 'speaking') {
    if (tab === currentSkill) {
      if (drawerCloser && drawerStateGetter?.()) drawerCloser()
      syncBottomTabActive()
      return
    }
    onSkillChange(tab)
    return
  }

  if (tab === 'mistakes') {
    if (currentSkill === 'typing' && drawerOpener) {
      if (drawerStateGetter?.() === 'mistakes' && drawerCloser) drawerCloser()
      else drawerOpener('mistakes')
      syncBottomTabActive()
      return
    }
    setPendingDrawer('mistakes')
    onSkillChange('typing')
    return
  }

  if (tab === 'settings') {
    if (drawerOpener) {
      if (drawerStateGetter?.() === 'settings' && drawerCloser) drawerCloser()
      else drawerOpener('settings')
      syncBottomTabActive()
      return
    }
    setPendingDrawer('settings')
    onSkillChange('typing')
  }
}

export function syncBottomTabActive() {
  const nav = document.querySelector('#mobile-bottom-nav')
  if (!nav) return
  const open = drawerStateGetter?.() || null
  nav.querySelectorAll('[data-mobile-tab]').forEach((btn) => {
    const tab = btn.getAttribute('data-mobile-tab')
    if (tab === 'typing' || tab === 'speaking') {
      btn.classList.toggle('active', !open && tab === currentSkill)
    } else {
      btn.classList.toggle('active', open === tab)
    }
  })
}

/** @param {SkillLang} lang */
function tabLabels(lang) {
  if (lang === 'japanese') {
    return {
      typing: 'タイピング',
      speaking: 'スピーキング',
      mistakes: 'ミス帳',
      settings: '設定',
      chooseLanguage: '言語を選択',
      chooseMode: '練習モード',
      cancel: 'キャンセル',
      nav: 'メインナビ',
    }
  }
  if (lang === 'english') {
    return {
      typing: 'Typing',
      speaking: 'Speaking',
      mistakes: 'Mistakes',
      settings: 'Settings',
      chooseLanguage: 'Choose language',
      chooseMode: 'Practice mode',
      cancel: 'Cancel',
      nav: 'Main',
    }
  }
  return {
    typing: '打字',
    speaking: '口语',
    mistakes: '错字本',
    settings: '设置',
    chooseLanguage: '选择语言',
    chooseMode: '练习模式',
    cancel: '取消',
    nav: '主导航',
  }
}

function iconTyping() {
  return `<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h10a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5v-7ZM3 4a.5.5 0 0 0-.5.5V6h2V4H3Zm2.5 0v2h2V4h-2Zm3 0v2h2V4h-2Zm3 0v2h2V4.5a.5.5 0 0 0-.5-.5h-1.5ZM2.5 7v2h2V7h-2Zm3 0v2h2V7h-2Zm3 0v2h2V7h-2Zm3 0v2h2V7h-2ZM2.5 10v1.5a.5.5 0 0 0 .5.5h1.5v-2h-2Zm3 0v2h5v-2h-5Zm6 0v2H13a.5.5 0 0 0 .5-.5V10h-2Z"/></svg>`
}

function iconSpeaking() {
  return `<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 1 0 5 0v-4A2.5 2.5 0 0 0 8 1.5ZM4 6.75a.75.75 0 0 1 1.5 0v1.25a2.5 2.5 0 0 0 5 0V6.75a.75.75 0 0 1 1.5 0v1.25a4 4 0 0 1-3.25 3.93V13.5h1.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5H7.5v-1.57A4 4 0 0 1 4.25 8V6.75Z"/></svg>`
}

function iconMistakes() {
  return `<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h6.086a1.5 1.5 0 0 1 1.06.44l2.914 2.914A1.5 1.5 0 0 1 14 5.414V13.5A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-11Zm8.5-.5v2.25c0 .69.56 1.25 1.25 1.25H14L10.5 2ZM5.78 7.22a.75.75 0 0 0-1.06 1.06L6.44 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L7.5 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L8.56 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L7.5 8.94 5.78 7.22Z"/></svg>`
}

function iconSettings() {
  return `<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 4.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5ZM6.5 8a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"/><path d="M6.12 1.53A1.5 1.5 0 0 1 7.56 1h.88a1.5 1.5 0 0 1 1.44 1.53l.1.9a5.54 5.54 0 0 1 1.08.63l.8-.4a1.5 1.5 0 0 1 1.95.58l.44.76a1.5 1.5 0 0 1-.55 2.02l-.74.43c.06.36.1.73.1 1.1 0 .37-.04.74-.1 1.1l.74.43a1.5 1.5 0 0 1 .55 2.02l-.44.76a1.5 1.5 0 0 1-1.95.58l-.8-.4a5.54 5.54 0 0 1-1.08.63l-.1.9A1.5 1.5 0 0 1 8.44 15h-.88a1.5 1.5 0 0 1-1.44-1.53l-.1-.9a5.54 5.54 0 0 1-1.08-.63l-.8.4a1.5 1.5 0 0 1-1.95-.58l-.44-.76a1.5 1.5 0 0 1 .55-2.02l.74-.43A5.7 5.7 0 0 1 2.9 8c0-.37.04-.74.1-1.1l-.74-.43a1.5 1.5 0 0 1-.55-2.02l.44-.76a1.5 1.5 0 0 1 1.95-.58l.8.4a5.54 5.54 0 0 1 1.08-.63l.1-.9Z"/></svg>`
}
