/**
 * Viewport helpers for responsive practice defaults.
 */

/**
 * Small screens / short windows / low display resolution — hide the on-screen keyboard by default.
 * Users can still show it; that choice is stored as an explicit preference.
 */
export function shouldHideKeyboardByDefault() {
  if (typeof window === 'undefined') return false
  try {
    // Phone-first: narrow viewports always start with keyboard hidden.
    if (window.matchMedia('(max-width: 720px)').matches) return true
    const compact = window.matchMedia(
      [
        '(max-width: 900px)',
        '(max-height: 720px)',
        '(max-width: 1366px) and (max-height: 800px)',
      ].join(', '),
    )
    if (compact.matches) return true
  } catch {
    /* ignore */
  }
  const sw = Number(window.screen?.width) || 0
  const sh = Number(window.screen?.height) || 0
  // Common low-resolution laptop / tablet native resolutions
  if (sw > 0 && sh > 0 && (sw <= 1366 || sh <= 768)) return true
  return false
}

/**
 * Resolve whether the keyboard should start covered.
 * Explicit user toggles always win; otherwise compact viewports hide by default.
 * @param {boolean} saved
 * @param {string} explicitStorageKey localStorage key set when the user toggles the keyboard
 */
export function resolveKeyboardCovered(saved, explicitStorageKey) {
  try {
    if (localStorage.getItem(explicitStorageKey) === '1') return Boolean(saved)
  } catch {
    /* ignore */
  }
  if (shouldHideKeyboardByDefault()) return true
  return Boolean(saved)
}

/** @param {string} explicitStorageKey */
export function markKeyboardPreferenceExplicit(explicitStorageKey) {
  try {
    localStorage.setItem(explicitStorageKey, '1')
  } catch {
    /* ignore */
  }
}
