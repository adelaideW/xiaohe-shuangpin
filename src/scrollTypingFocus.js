/**
 * Keep the active typing glyph visible in `.passage-scroll`
 * (vertical + horizontal) so long lines/words stay reachable on mobile.
 *
 * @param {{
 *   unitIndex: number,
 *   unitCount: number,
 *   selector?: string,
 * }} opts
 */
export function scrollTypingFocusIntoView({
  unitIndex,
  unitCount,
  selector = '.passage-scroll .ch.current, .passage-scroll .jp-seg.current',
}) {
  const scroller = document.querySelector('.passage-scroll')
  const el = document.querySelector(selector)
  if (!scroller || !el) return

  const total = Math.max(1, Number(unitCount) || 1)
  const idx = Math.max(0, Number(unitIndex) || 0)
  const nearStart = idx < 10 || idx / total < 0.06
  const nearEnd = idx >= total - 12 || idx / total > 0.9

  if (nearStart || nearEnd) {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  } else {
    const sRect = scroller.getBoundingClientRect()
    const eRect = el.getBoundingClientRect()
    const elMidY = eRect.top + eRect.height / 2
    const viewMidY = sRect.top + sRect.height / 2
    const deltaY = elMidY - viewMidY
    if (Math.abs(deltaY) >= 4) {
      scroller.scrollTo({
        top: scroller.scrollTop + deltaY,
        behavior: 'smooth',
      })
    }
  }

  // Always keep the current character horizontally in view when a line is wider than the screen.
  const sRect = scroller.getBoundingClientRect()
  const eRect = el.getBoundingClientRect()
  const pad = 24
  let deltaX = 0
  if (eRect.left < sRect.left + pad) deltaX = eRect.left - sRect.left - pad
  else if (eRect.right > sRect.right - pad) deltaX = eRect.right - sRect.right + pad
  if (Math.abs(deltaX) >= 2) {
    scroller.scrollTo({
      left: scroller.scrollLeft + deltaX,
      behavior: 'smooth',
    })
  }

  scrollTypingChromeIntoView()
}

/** Keep the current code slot / hint letter visible in the typing chrome. */
export function scrollTypingChromeIntoView() {
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
      progress.scrollTo({ left: progress.scrollLeft + delta, behavior: 'smooth' })
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
      hintLine.scrollTo({ left: hintLine.scrollLeft + delta, behavior: 'smooth' })
    }
  }
}
