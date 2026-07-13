/**
 * Keep the active typing glyph centered in `.passage-scroll`
 * so upcoming lines stay visible — except near the start or end.
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
    return
  }

  const sRect = scroller.getBoundingClientRect()
  const eRect = el.getBoundingClientRect()
  const elMid = eRect.top + eRect.height / 2
  const viewMid = sRect.top + sRect.height / 2
  const delta = elMid - viewMid
  if (Math.abs(delta) < 4) return
  scroller.scrollTo({
    top: scroller.scrollTop + delta,
    behavior: 'smooth',
  })
}
