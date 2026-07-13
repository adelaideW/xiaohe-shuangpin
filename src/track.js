/**
 * Practice track: shuangpin (双拼) vs english.
 * Switching reloads so each track boots in isolation.
 */

const STORAGE_KEY = 'typing-practice-track'

/** @typedef {'shuangpin' | 'english'} PracticeTrack */

/** @returns {PracticeTrack} */
export function loadTrack() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'english' || v === 'shuangpin') return v
  } catch {
    /* ignore */
  }
  return 'shuangpin'
}

/** @param {PracticeTrack} track */
export function saveTrack(track) {
  localStorage.setItem(STORAGE_KEY, track)
}

/**
 * Persist track and reload so timers / listeners / DOM fully reset.
 * @param {PracticeTrack} track
 */
export function switchTrack(track) {
  saveTrack(track)
  location.reload()
}

/**
 * Shared track switch markup for both apps.
 * @param {PracticeTrack} active
 */
export function trackSwitchHtml(active) {
  return `
    <div class="track-switch" role="tablist" aria-label="Practice language">
      <button type="button" role="tab" data-track="shuangpin" class="${active === 'shuangpin' ? 'active' : ''}" aria-selected="${active === 'shuangpin'}">双拼</button>
      <button type="button" role="tab" data-track="english" class="${active === 'english' ? 'active' : ''}" aria-selected="${active === 'english'}">English</button>
    </div>
  `
}

/** @param {(track: PracticeTrack) => void} onSwitch */
export function bindTrackSwitch(onSwitch) {
  document.querySelectorAll('[data-track]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-track')
      if (t === 'english' || t === 'shuangpin') onSwitch(t)
    })
  })
}
