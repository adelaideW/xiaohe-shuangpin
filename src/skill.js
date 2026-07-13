/**
 * Typing ↔ Speaking skill switch (GitHub-style underline tabs).
 */

/** @typedef {'typing' | 'speaking'} PracticeSkill */
/** @typedef {'english' | 'japanese' | 'shuangpin'} SkillLang */

const STORAGE = {
  english: 'english-practice-skill',
  japanese: 'japanese-practice-skill',
  shuangpin: 'shuangpin-practice-skill',
}

/** @param {SkillLang} lang */
export function loadSkill(lang) {
  try {
    const v = localStorage.getItem(STORAGE[lang])
    if (v === 'speaking' || v === 'typing') return v
  } catch {
    /* ignore */
  }
  return 'typing'
}

/**
 * @param {SkillLang} lang
 * @param {PracticeSkill} skill
 */
export function saveSkill(lang, skill) {
  localStorage.setItem(STORAGE[lang], skill)
}

const ICON_TYPING = `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h10a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5v-7ZM3 4a.5.5 0 0 0-.5.5V6h2V4H3Zm2.5 0v2h2V4h-2Zm3 0v2h2V4h-2Zm3 0v2h2V4.5a.5.5 0 0 0-.5-.5h-1.5ZM2.5 7v2h2V7h-2Zm3 0v2h2V7h-2Zm3 0v2h2V7h-2Zm3 0v2h2V7h-2ZM2.5 10v1.5a.5.5 0 0 0 .5.5h1.5v-2h-2Zm3 0v2h5v-2h-5Zm6 0v2H13a.5.5 0 0 0 .5-.5V10h-2Z"/></svg>`

const ICON_SPEAKING = `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 1.5a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 1 0 5 0v-4A2.5 2.5 0 0 0 8 1.5ZM4 6.75a.75.75 0 0 1 1.5 0v1.25a2.5 2.5 0 0 0 5 0V6.75a.75.75 0 0 1 1.5 0v1.25a4 4 0 0 1-3.25 3.93V13.5h1.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5H7.5v-1.57A4 4 0 0 1 4.25 8V6.75Z"/></svg>`

const LANG_META = {
  english: {
    title: 'English',
    sub: 'Typing & speaking practice',
    typing: 'Typing',
    speaking: 'Speaking',
    tablist: 'Practice mode',
  },
  japanese: {
    title: '日本語',
    sub: 'タイピングとスピーキング',
    typing: 'タイピング',
    speaking: 'スピーキング',
    tablist: '練習モード',
  },
  shuangpin: {
    title: '中文',
    sub: '打字与口语练习',
    typing: '打字',
    speaking: '口语',
    tablist: '练习模式',
  },
}

/**
 * Mount skill tab bar above a practice host. Clicking a tab persists + reloads
 * so typing key handlers don't leak across modes.
 * @param {HTMLElement} practiceRoot
 * @param {SkillLang} lang
 * @param {PracticeSkill} active
 * @returns {HTMLElement} skill practice host
 */
export function mountSkillShell(practiceRoot, lang, active) {
  const meta = LANG_META[lang]

  practiceRoot.innerHTML = `
    <div class="skill-shell">
      <div class="skill-sticky-head">
        <header class="skill-lang-head">
          <h1 class="skill-lang-title">${meta.title}</h1>
          <p class="skill-lang-sub">${meta.sub}</p>
        </header>
        <nav class="skill-tabs" role="tablist" aria-label="${meta.tablist}">
          <button type="button" class="skill-tab ${active === 'typing' ? 'active' : ''}" data-skill="typing" role="tab" aria-selected="${active === 'typing'}">
            <span class="skill-tab-icon">${ICON_TYPING}</span>
            <span class="skill-tab-label">${meta.typing}</span>
          </button>
          <button type="button" class="skill-tab ${active === 'speaking' ? 'active' : ''}" data-skill="speaking" role="tab" aria-selected="${active === 'speaking'}">
            <span class="skill-tab-icon">${ICON_SPEAKING}</span>
            <span class="skill-tab-label">${meta.speaking}</span>
          </button>
        </nav>
      </div>
      <div class="skill-host" id="skill-root"></div>
    </div>
  `

  practiceRoot.querySelectorAll('[data-skill]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const skill = /** @type {PracticeSkill} */ (btn.getAttribute('data-skill'))
      if (skill === active) return
      saveSkill(lang, skill)
      location.reload()
    })
  })

  return /** @type {HTMLElement} */ (practiceRoot.querySelector('#skill-root'))
}
