/**
 * Keep the active typing glyph vertically centered in `.passage-scroll`
 * (except near the first/last lines). Horizontal overflow is handled only
 * in the typing chrome (word suggestion + code slots).
 *
 * @param {{
 *   unitIndex: number,
 *   unitCount: number,
 *   selector?: string,
 *   instant?: boolean,
 * }} opts
 */
export function scrollTypingFocusIntoView({
  unitIndex,
  unitCount,
  selector = '.passage-scroll .ch.current, .passage-scroll .jp-seg.current',
  instant = false,
}) {
  const scroller = document.querySelector('.passage-scroll')
  const el = document.querySelector(selector)
  if (!scroller || !el) return

  const behavior = instant ? 'auto' : 'smooth'
  const total = Math.max(1, Number(unitCount) || 1)
  const idx = Math.max(0, Number(unitIndex) || 0)
  const nearStart = idx < 10 || idx / total < 0.06
  const nearEnd = idx >= total - 12 || idx / total > 0.9

  if (nearStart || nearEnd) {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior })
  } else {
    const sRect = scroller.getBoundingClientRect()
    const eRect = el.getBoundingClientRect()
    const elMid = eRect.top + eRect.height / 2
    const viewMid = sRect.top + sRect.height / 2
    const delta = elMid - viewMid
    if (Math.abs(delta) >= 4) {
      scroller.scrollTo({
        top: scroller.scrollTop + delta,
        behavior,
      })
    }
  }

  scrollTypingChromeIntoView({ instant })
}

/** Keep the current word suggestion / code slot visible when wider than the screen. */
export function scrollTypingChromeIntoView({ instant = false } = {}) {
  const behavior = instant ? 'auto' : 'smooth'
  const slot = document.querySelector('.code-progress .code-slot.is-current, .code-progress .code-slot.error')
  const progress = document.querySelector('.code-progress')
  if (slot && progress) {
    const pRect = progress.getBoundingClientRect()
    const sRect = slot.getBoundingClientRect()
    const pad = 16
    let delta = 0
    if (sRect.left < pRect.left + pad) delta = sRect.left - pRect.left - pad
    else if (sRect.right > pRect.right - pad) delta = sRect.right - pRect.right + pad
    if (Math.abs(delta) >= 2) {
      progress.scrollTo({ left: progress.scrollLeft + delta, behavior })
    }
  }

  const hint = document.querySelector('.typing-chrome .pinyin-line .hint-current-letter')
  const hintLine = document.querySelector('.typing-chrome .pinyin-line')
  if (hint && hintLine) {
    const lRect = hintLine.getBoundingClientRect()
    const hRect = hint.getBoundingClientRect()
    const pad = 12
    let delta = 0
    if (hRect.left < lRect.left + pad) delta = hRect.left - lRect.left - pad
    else if (hRect.right > lRect.right - pad) delta = hRect.right - lRect.right + pad
    if (Math.abs(delta) >= 2) {
      hintLine.scrollTo({ left: hintLine.scrollLeft + delta, behavior })
    }
  }
}
