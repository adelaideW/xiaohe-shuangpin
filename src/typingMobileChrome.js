/**
 * Phone typing chrome: compact in-card timer + session stats bottom sheet.
 */

import { isPhoneViewport } from './mobileNav.js'

/**
 * @param {string} statsInnerHtml must include `.stats` root
 */
export function renderHiddenStatsForMobile(statsInnerHtml) {
  return `<div class="typing-stats-source" aria-hidden="true">${statsInnerHtml}</div>`
}

/**
 * @param {string} initialText
 */
/**
 * @param {{
 *   state: {
 *     sessionFinished: boolean,
 *     sessionActive: boolean,
 *     sessionPaused: boolean,
 *     autoPaused: boolean,
 *     remainingMs: number,
 *     durationMinutes: number,
 *   },
 *   settings: { timerMode: string },
 *   formatTime: (ms: number) => string,
 *   labels: { done: string },
 * }} opts
 */
export function mobileTimerChipText({ state, settings, formatTime, labels }) {
  if (settings.timerMode === 'off') return ''
  if (state.sessionFinished) return labels.done
  if (state.sessionActive) return formatTime(state.remainingMs)
  return formatTime(state.durationMinutes * 60 * 1000)
}

export function renderMobileTimerChip(initialText = '') {
  if (!isPhoneViewport() || !initialText) return ''
  return `
    <span class="typing-timer-chip" id="typing-timer-chip" role="timer" aria-live="polite">
      <span id="typing-timer-chip-value" class="typing-timer-chip-value">${initialText}</span>
    </span>
  `
}

/** @param {string} text @param {string[]} classes */
export function patchMobileTimerChip(text, classes = []) {
  const chip = document.querySelector('#typing-timer-chip')
  const value = document.querySelector('#typing-timer-chip-value')
  if (!chip || !value) return
  value.textContent = text
  chip.classList.toggle('urgent', classes.includes('urgent'))
  chip.classList.toggle('paused', classes.includes('paused'))
  chip.classList.toggle('done', classes.includes('done'))
  chip.classList.toggle('idle', classes.includes('idle'))
}

/**
 * @param {{
 *   state: {
 *     sessionFinished: boolean,
 *     sessionActive: boolean,
 *     sessionPaused: boolean,
 *     autoPaused: boolean,
 *     remainingMs: number,
 *     durationMinutes: number,
 *   },
 *   settings: { timerMode: string },
 *   formatTime: (ms: number) => string,
 *   labels: { done: string, paused: string, idle: string },
 * }} opts
 */
export function syncMobileTimerFromState({ state, settings, formatTime, labels }) {
  if (!isPhoneViewport() || settings.timerMode === 'off') return

  if (state.sessionFinished) {
    patchMobileTimerChip(labels.done, ['done'])
    return
  }

  if (state.sessionActive && state.sessionPaused) {
    const suffix = state.autoPaused ? ` · ${labels.idle}` : ` · ${labels.paused}`
    patchMobileTimerChip(`${formatTime(state.remainingMs)}${suffix}`, ['paused'])
    return
  }

  if (state.sessionActive) {
    const urgent = state.remainingMs < 30000
    patchMobileTimerChip(formatTime(state.remainingMs), urgent ? ['urgent'] : [])
    return
  }

  patchMobileTimerChip(formatTime(state.durationMinutes * 60 * 1000), ['idle'])
}

/**
 * @param {{
 *   title: string,
 *   summaryHtml: string,
 *   statsHtml: string,
 *   restartLabel: string,
 *   open?: boolean,
 * }} opts
 */
export function renderTypingStatsSheet({ title, summaryHtml, statsHtml, restartLabel, open = false }) {
  return `
    <div class="spk-feedback-sheet typing-stats-sheet ${open ? 'is-open' : ''}" id="typing-stats-sheet" ${open ? '' : 'hidden'}>
      <div class="spk-feedback-sheet-backdrop" data-close-typing-stats></div>
      <div class="spk-feedback-sheet-panel" role="dialog" aria-label="${title}">
        <div class="spk-feedback-sheet-handle" aria-hidden="true"></div>
        <div class="spk-feedback-sheet-head">
          <h2 class="spk-feedback-sheet-title">${title}</h2>
        </div>
        ${summaryHtml}
        ${statsHtml}
        <div class="typing-stats-sheet-actions">
          <button type="button" class="primary" data-typing-stats-restart>${restartLabel}</button>
        </div>
      </div>
    </div>
  `
}

/** @param {boolean} open */
export function syncTypingStatsSheet(open) {
  const sheet = document.querySelector('#typing-stats-sheet')
  if (!sheet) return
  sheet.hidden = !open
  sheet.classList.toggle('is-open', open)
  document.body.classList.toggle('typing-stats-sheet-open', Boolean(open && isPhoneViewport()))
}

/**
 * @param {{ onRestart: () => void, onClose?: () => void }} handlers
 */
export function bindTypingStatsSheet(handlers) {
  document.querySelector('[data-close-typing-stats]')?.addEventListener('click', () => {
    handlers.onClose?.()
  })
  document.querySelector('[data-typing-stats-restart]')?.addEventListener('click', () => {
    handlers.onRestart()
  })
}

/** Copy live stat values from the hidden source grid into the sheet. */
export function patchTypingStatsSheetFromSource() {
  const source = document.querySelector('.typing-stats-source .stats')
  const target = document.querySelector('#typing-stats-sheet .stats')
  if (!source || !target) return
  const srcValues = source.querySelectorAll('.stat .value')
  const tgtValues = target.querySelectorAll('.stat .value')
  srcValues.forEach((el, i) => {
    if (tgtValues[i]) tgtValues[i].textContent = el.textContent
  })
}
