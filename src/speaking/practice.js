/**
 * Oral speaking practice — listen, repeat line-by-line, get feedback.
 * Ported from daily-language-practice into the typing app shell.
 */

import { gradeRepeat, buildSpeakDiff } from './grade.js'
import { pickLesson, builtInSpeakBank } from './lessons.js'
import { fitLessonToSpeakLimit } from './length.js'
import {
  speakText,
  cancelSpeech,
  pauseSpeech,
  resumeSpeech,
  isSpeechPaused,
  createSpeechRecognizer,
  splitSentences,
} from './speech.js'
import { loadEnglishSettings, saveEnglishSettings } from '../english/settings.js'
import { loadJapaneseSettings, saveJapaneseSettings } from '../japanese/settings.js'
import { loadSettings, saveSettings } from '../settings.js'
import { toFuriganaHtml } from './furigana.js'
import { registerDrawerHandlers, syncBottomTabActive, isPhoneViewport } from '../mobileNav.js'

const ICON_RECORD = `<svg class="spk-mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11.25a6.5 6.5 0 0 0 13 0"/><path d="M12 17.75V21"/><path d="M9.25 21h5.5"/></svg>`
const ICON_STOP = `<svg class="spk-mic-icon spk-stop-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="0" y="0" width="16" height="16" rx="2" fill="currentColor"/></svg>`

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

/**
 * @param {HTMLElement} root
 * @param {{ language: 'en' | 'ja' | 'zh' }} opts
 */
export function bootSpeaking(root, opts) {
  const language = opts.language === 'ja' ? 'ja' : opts.language === 'zh' ? 'zh' : 'en'
  const storagePrefix = language === 'ja' ? 'jp-speak' : language === 'zh' ? 'zh-speak' : 'en-speak'

  /** @param {string} en @param {string} ja @param {string} [zh] */
  function t(en, ja, zh) {
    if (language === 'ja') return ja
    if (language === 'zh') return zh ?? en
    return en
  }

  let settings =
    language === 'ja'
      ? loadJapaneseSettings()
      : language === 'zh'
        ? loadSettings()
        : loadEnglishSettings()

  function applySpeakSetting(checked) {
    settings =
      language === 'ja'
        ? saveJapaneseSettings({ speakOnSentenceClick: checked })
        : language === 'zh'
          ? saveSettings({ speakOnSentenceClick: checked })
          : saveEnglishSettings({ speakOnSentenceClick: checked })
  }

  function defaultSpeakCount(kind) {
    if (language === 'en') return kind === 'min' ? 40 : 150
    return kind === 'min' ? 60 : 200
  }

  /** Other bank articles used to grow short seeds up to the min limit. */
  function speakFillers(avoidTitle = '') {
    return builtInSpeakBank(language).filter((l) => l.title !== avoidTitle)
  }

  function refitCurrentLesson() {
    const source = {
      ...state.lesson,
      article: state.lesson.baseArticle || state.lesson.sourceArticle || state.lesson.article,
    }
    state.lesson = fitLessonToSpeakLimit(
      source,
      language,
      settings,
      speakFillers(source.title),
    )
    saveJSON(`${storagePrefix}-lesson`, state.lesson)
    state.index = 0
    state.results = []
    state.fullResult = null
    persistResults()
    state.manualText = ''
    state.transcript = ''
    state.gradeError = ''
  }

  function applySpeakLimitPatch(patch) {
    settings =
      language === 'ja'
        ? saveJapaneseSettings(patch)
        : language === 'zh'
          ? saveSettings(patch)
          : saveEnglishSettings(patch)
    refitCurrentLesson()
    render()
  }

  /** Read length fields from the open settings drawer (covers blurless Done clicks). */
  function readSpeakLimitFromDrawer() {
    const modeEl = root.querySelector('input[name="speak-limit-mode"]:checked')
    const mode = modeEl?.value === 'count' ? 'count' : 'time'
    return {
      speakLimitMode: mode,
      speakMinMinutes: Number(root.querySelector('#set-speak-min-minutes')?.value) || 1,
      speakMaxMinutes: Number(root.querySelector('#set-speak-minutes')?.value) || 5,
      speakMinCount: Number(root.querySelector('#set-speak-min-count')?.value) || defaultSpeakCount('min'),
      speakMaxCount: Number(root.querySelector('#set-speak-count')?.value) || defaultSpeakCount('max'),
    }
  }

  function closeSettingsApplyingLimits() {
    if (state.drawer === 'settings') {
      const patch = readSpeakLimitFromDrawer()
      settings =
        language === 'ja'
          ? saveJapaneseSettings(patch)
          : language === 'zh'
            ? saveSettings(patch)
            : saveEnglishSettings(patch)
      state.drawer = null
      refitCurrentLesson()
      render()
      syncBottomTabActive()
      return
    }
    state.drawer = null
    render()
    syncBottomTabActive()
  }

  function openSpeakSettings() {
    settings =
      language === 'ja'
        ? loadJapaneseSettings()
        : language === 'zh'
          ? loadSettings()
          : loadEnglishSettings()
    state.drawer = 'settings'
    render()
    syncBottomTabActive()
  }

  function chooseLesson(avoidTitles = []) {
    const picked = pickLesson(language, avoidTitles)
    return fitLessonToSpeakLimit(picked, language, settings, speakFillers(picked.title))
  }

  function lessonHasArticle(raw) {
    if (!raw || typeof raw !== 'object') return false
    const text = String(raw.baseArticle || raw.sourceArticle || raw.article || raw.text || '').trim()
    return text.length > 0
  }

  /** @type {ReturnType<typeof pickLesson> | null} */
  let lesson = loadJSON(`${storagePrefix}-lesson`, null)
  if (!lessonHasArticle(lesson) || lesson.language !== language) {
    lesson = chooseLesson()
    saveJSON(`${storagePrefix}-lesson`, lesson)
    saveJSON(`${storagePrefix}-results`, [])
  } else {
    // Re-fit to current length settings; tolerate legacy { text } shape
    const source = {
      ...lesson,
      article: lesson.baseArticle || lesson.sourceArticle || lesson.article || lesson.text || '',
    }
    lesson = fitLessonToSpeakLimit(source, language, settings, speakFillers(source.title))
    saveJSON(`${storagePrefix}-lesson`, lesson)
  }

  const state = {
    lesson,
    rate: 1,
    speaking: false,
    paused: false,
    index: 0,
    /** @type {'line' | 'article'} */
    scope: 'line',
    results: /** @type {any[]} */ (loadJSON(`${storagePrefix}-results`, [])),
    fullResult: /** @type {any | null} */ (loadJSON(`${storagePrefix}-full-result`, null)),
    manualText: '',
    grading: false,
    gradeError: '',
    transcript: '',
    listening: false,
    srError: '',
    drawer: /** @type {null | 'settings'} */ (null),
    /** Phone: slide-up feedback sheet after grading */
    feedbackSheetOpen: false,
    feedbackSheetExpanded: false,
  }

  const paragraphs = () =>
    String(state.lesson?.article || '')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)

  const paragraphSentences = () =>
    paragraphs().map((p) => splitSentences(p, language))

  const sentences = () => paragraphSentences().flat()

  /** @type {Map<string, string>} */
  const furiganaCache = new Map()
  /** Bumps on each full render so late furigana work is ignored. */
  let renderGen = 0

  let recognizer = createSpeechRecognizer(language, {
    onUpdate: ({ transcript, listening, error }) => {
      const wasListening = state.listening
      state.transcript = transcript
      state.listening = listening
      state.srError = error
      patchLive()
      // Grade once when a recording session ends (stop, silence, or error).
      if (wasListening && !listening && !state.grading) {
        void runGrade(transcript)
      }
    },
  })

  function currentSentence() {
    return sentences()[state.index] || ''
  }

  /** Original text to match against for the current practice scope. */
  function gradeTarget() {
    if (state.scope === 'article') return String(state.lesson.article || '').trim()
    return currentSentence()
  }

  function activeFeedback() {
    return state.scope === 'article' ? state.fullResult : state.results[state.index]
  }

  function persistResults() {
    saveJSON(`${storagePrefix}-results`, state.results)
    saveJSON(`${storagePrefix}-full-result`, state.fullResult)
  }

  function clearActiveFeedback() {
    if (state.scope === 'article') state.fullResult = null
    else state.results[state.index] = undefined
    state.feedbackSheetOpen = false
    state.feedbackSheetExpanded = false
    persistResults()
  }

  async function runGrade(transcript) {
    if (state.grading) return
    const text = String(transcript || '').trim()
    // Always surface the phone feedback sheet when a recording attempt ends.
    if (isPhoneViewport()) {
      state.feedbackSheetOpen = true
      state.feedbackSheetExpanded = false
    }
    if (!text) {
      state.gradeError =
        t(
          'Nothing to grade yet — try recording or typing what you said.',
          '採点する内容がありません。録音するか入力してください。',
          '还没有可评分的内容，请先录音或输入。',
        )
      render()
      return
    }
    const original = gradeTarget()
    if (!original) {
      state.gradeError = t('No article text to compare.', '比較する文章がありません。', '没有可对比的原文。')
      render()
      return
    }
    state.grading = true
    state.gradeError = ''
    render()
    try {
      const result = await gradeRepeat(language, original, text)
      const packed = {
        ...result,
        transcript: text,
        sentence: original,
        original,
        scope: state.scope,
        diff: buildSpeakDiff(original, text, language),
      }
      if (state.scope === 'article') state.fullResult = packed
      else state.results[state.index] = packed
      persistResults()
      if (isPhoneViewport()) {
        state.feedbackSheetOpen = true
        state.feedbackSheetExpanded = false
      }
    } catch {
      state.gradeError =
        t(
          'Something went wrong grading your attempt. Please try again.',
          '採点中に問題が発生しました。もう一度お試しください。',
          '评分出错了，请再试一次。',
        )
      if (isPhoneViewport()) state.feedbackSheetOpen = true
    } finally {
      state.grading = false
      render()
    }
  }

  function nextLesson() {
    cancelSpeech()
    recognizer.stop()
    const recent = loadJSON(`${storagePrefix}-recent`, [])
    recent.unshift(state.lesson.title)
    saveJSON(`${storagePrefix}-recent`, recent.slice(0, 5))
    state.lesson = chooseLesson(recent)
    saveJSON(`${storagePrefix}-lesson`, state.lesson)
    state.results = []
    state.fullResult = null
    saveJSON(`${storagePrefix}-results`, [])
    saveJSON(`${storagePrefix}-full-result`, null)
    state.index = 0
    state.manualText = ''
    state.gradeError = ''
    state.transcript = ''
    state.feedbackSheetOpen = false
    state.feedbackSheetExpanded = false
    furiganaCache.clear()
    recognizer.reset()
    render()
  }

  function playArticle() {
    if (state.paused && isSpeechPaused()) {
      resumeSpeech()
      state.paused = false
      state.speaking = true
      patchListen()
      return
    }
    startSpeech(state.lesson.article, { track: true })
  }

  function startSpeech(text, { track = false } = {}) {
    const trimmed = String(text || '').trim()
    if (!trimmed) return
    state.speaking = true
    state.paused = false
    const offsets = track ? buildSentenceOffsets(trimmed) : null
    speakText(
      trimmed,
      language,
      state.rate,
      () => {
        state.speaking = false
        state.paused = false
        highlightSentence(state.index)
        patchListen()
      },
      offsets
        ? {
            onBoundary: (charIndex) => {
              const idx = sentenceIndexForOffset(offsets, charIndex)
              if (idx >= 0) highlightSentence(idx)
            },
          }
        : {},
    )
    patchListen()
  }

  /** Character start offset of each flattened sentence inside the article text. */
  function buildSentenceOffsets(articleText) {
    const list = sentences()
    const offsets = []
    let cursor = 0
    for (const s of list) {
      const at = articleText.indexOf(s, cursor)
      if (at === -1) {
        offsets.push(cursor)
      } else {
        offsets.push(at)
        cursor = at + s.length
      }
    }
    return offsets
  }

  /** @param {number[]} offsets @param {number} charIndex */
  function sentenceIndexForOffset(offsets, charIndex) {
    let idx = -1
    for (let i = 0; i < offsets.length; i++) {
      if (charIndex >= offsets[i]) idx = i
      else break
    }
    return idx
  }

  /** Move the active highlight to a sentence and keep it in view. */
  function highlightSentence(idx) {
    const spans = root.querySelectorAll('.spk-sent')
    if (!spans.length) return
    spans.forEach((el) => {
      el.classList.toggle('is-active', Number(el.getAttribute('data-sent')) === idx)
    })
    scrollActiveSentenceIntoView()
  }

  function pauseArticle() {
    pauseSpeech()
    state.paused = true
    patchListen()
  }

  function stopArticle() {
    cancelSpeech()
    state.speaking = false
    state.paused = false
    patchListen()
  }

  function setIndex(i, { readAloud = false } = {}) {
    const max = Math.max(0, sentences().length - 1)
    state.index = Math.max(0, Math.min(i, max))
    state.manualText = ''
    state.gradeError = ''
    state.transcript = ''
    state.feedbackSheetOpen = false
    state.feedbackSheetExpanded = false
    recognizer.reset()
    render()
    if (readAloud) {
      const line = currentSentence()
      if (line) startSpeech(line)
      return
    }
    if (state.speaking || state.paused) stopArticle()
  }

  function micIconHtml(listening) {
    return listening ? ICON_STOP : ICON_RECORD
  }

  function ratingDots(rating) {
    return [1, 2, 3, 4, 5]
      .map((n) => `<span class="spk-dot ${n <= rating ? 'filled' : ''}">●</span>`)
      .join('')
  }

  function patchListen() {
    const host = root.querySelector('.spk-listen')
    if (!host) return
    const compact = host.classList.contains('spk-listen-compact')
    host.innerHTML = listenControlsHtml({ compact })
    bindListen()
  }

  function patchLive() {
    const status = root.querySelector('.spk-mic-status')
    const float = root.querySelector('.spk-transcribe-float')
    const floatText = root.querySelector('.spk-transcribe-text')
    const err = root.querySelector('.spk-sr-error')
    const mic = root.querySelector('.spk-mic')
    const block = root.querySelector('.spk-mic-block')
    if (block) block.classList.toggle('is-listening', state.listening)
    if (mic) {
      mic.classList.toggle('is-listening', state.listening)
      mic.innerHTML = micIconHtml(state.listening)
      mic.setAttribute('aria-pressed', state.listening ? 'true' : 'false')
      mic.setAttribute(
        'aria-label',
        state.listening
          ? t('Stop recording', '録音を停止', '停止录音')
          : t('Start recording', '録音開始', '开始录音'),
      )
    }
    if (status) {
      status.textContent = state.listening
        ? t('Listening… tap to stop', '聞き取り中…タップで停止', '正在听写…点按停止')
        : t('Tap to start speaking', 'タップして話す', '点按开始说话')
    }
    if (float) {
      float.hidden = !state.listening
    }
    if (floatText && state.listening) {
      floatText.textContent = state.transcript || '…'
      // Keep the latest speech visible (last ~3 lines); user can scroll up for earlier text.
      requestAnimationFrame(() => {
        floatText.scrollTop = floatText.scrollHeight
      })
    }
    if (err) {
      if (state.srError) {
        err.hidden = false
        err.textContent = state.srError
      } else {
        err.hidden = true
      }
    }
  }

  function listenControlsHtml({ compact = false } = {}) {
    const tts = 'speechSynthesis' in window
    if (!tts) {
      return `<p class="spk-hint">${
        language === 'ja'
          ? 'このブラウザは読み上げに対応していません。'
          : "Your browser doesn't support text-to-speech."
      }</p>`
    }
    const playLabel = state.paused
      ? t('Resume', '再開', '继续')
      : t('Listen', '全文を聴く', '听全文')
    const pauseLabel = t('Pause', '一時停止', '暂停')
    const stopLabel = t('Stop', '停止', '停止')
    const iconSpeak = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm11.5-.9v2.05a2.5 2.5 0 0 1 0 3.7v2.05a4.5 4.5 0 0 0 0-7.8Zm2.5-2.6v2.12a6.5 6.5 0 0 1 0 8.76v2.12a8.5 8.5 0 0 0 0-13Z"/></svg>`
    const iconPause = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7V5Zm6.5 0H17v14h-3.5V5Z"/></svg>`
    const iconStop = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7V7Z"/></svg>`
    const rate = `
      <label class="spk-rate">
        <span>${t('Speed', '速度', '语速')}</span>
        <select id="spk-rate">
          <option value="0.8" ${state.rate === 0.8 ? 'selected' : ''}>0.8×</option>
          <option value="1" ${state.rate === 1 ? 'selected' : ''}>1×</option>
          <option value="1.15" ${state.rate === 1.15 ? 'selected' : ''}>1.15×</option>
        </select>
      </label>`
    if (compact) {
      return `
        ${
          !state.speaking || state.paused
            ? `<button type="button" class="practice-icon-btn spk-listen-icon ${state.speaking ? 'is-speaking' : ''}" id="spk-play" aria-label="${playLabel}" title="${playLabel}">${iconSpeak}</button>`
            : `<button type="button" class="practice-icon-btn spk-listen-icon is-speaking" id="spk-pause" aria-label="${pauseLabel}" title="${pauseLabel}">${iconPause}</button>`
        }
        <button type="button" class="practice-icon-btn spk-listen-icon" id="spk-stop" ${!state.speaking && !state.paused ? 'disabled' : ''} aria-label="${stopLabel}" title="${stopLabel}">${iconStop}</button>
        ${rate}
      `
    }
    return `
      ${
        !state.speaking || state.paused
          ? `<button type="button" class="ghost-chip" id="spk-play">▶ ${playLabel}</button>`
          : `<button type="button" class="ghost-chip" id="spk-pause">⏸ ${pauseLabel}</button>`
      }
      <button type="button" class="ghost-chip" id="spk-stop" ${!state.speaking && !state.paused ? 'disabled' : ''}>⏹ ${stopLabel}</button>
      ${rate}
    `
  }

  function articleHtmlSync() {
    let counter = -1
    const blocks = paragraphSentences()
      .map((sents) => {
        const spans = sents
          .map((s) => {
            counter += 1
            const i = counter
            return `<span class="spk-sent ${i === state.index ? 'is-active' : ''}" data-sent="${i}">${escapeHtml(s)} </span>`
          })
          .join('')
        return `<p>${spans}</p>`
      })
      .join('')
    return blocks
  }

  /**
   * @param {string} s
   */
  async function sentenceDisplayHtml(s) {
    if (language !== 'ja' || !settings.speakShowHiragana) return escapeHtml(s)
    if (furiganaCache.has(s)) return furiganaCache.get(s) || escapeHtml(s)
    try {
      const html = await toFuriganaHtml(s)
      let out = escapeHtml(s)
      if (html && /<ruby[\s>]/i.test(html)) out = html
      else if (html && /[\[(（]/.test(html) && !html.includes('<')) {
        // Unexpected raw okurigana string
        out = escapeHtml(s)
      }
      furiganaCache.set(s, out)
      return out
    } catch (err) {
      console.warn('Speaking furigana failed', err)
      return escapeHtml(s)
    }
  }

  async function articleHtml() {
    if (language !== 'ja' || !settings.speakShowHiragana) return articleHtmlSync()
    let counter = -1
    const blocks = []
    for (const sents of paragraphSentences()) {
      const spans = []
      for (const s of sents) {
        counter += 1
        const i = counter
        const inner = await sentenceDisplayHtml(s)
        spans.push(
          `<span class="spk-sent ${i === state.index ? 'is-active' : ''}" data-sent="${i}">${inner} </span>`,
        )
      }
      blocks.push(`<p>${spans.join('')}</p>`)
    }
    return blocks.join('')
  }

  /**
   * Paint furigana after the speaking shell is already visible.
   * Waiting on Kuroshiro before first paint left Japanese speaking blank.
   * @param {number} gen
   */
  async function enhanceArticleFurigana(gen) {
    if (language !== 'ja' || !settings.speakShowHiragana) return
    if (gen !== renderGen) return
    try {
      const html = await articleHtml()
      if (gen !== renderGen) return
      const host = root.querySelector('.spk-article')
      if (!host) return
      host.innerHTML = html
      host.classList.add('has-furigana')
      bindArticleClicks()
      scrollActiveSentenceIntoView()
    } catch (err) {
      console.warn('Speaking furigana enhance failed', err)
    }
  }

  function bindArticleClicks() {
    root.querySelectorAll('.spk-sent').forEach((el) => {
      el.addEventListener('click', () => {
        const i = Number(el.getAttribute('data-sent'))
        if (Number.isFinite(i)) setIndex(i, { readAloud: true })
      })
    })
  }

  /**
   * @param {import('./grade.js').DiffOp[] | undefined} ops
   * @param {'original' | 'heard'} side
   */
  function renderDiffLine(ops, side) {
    if (!ops?.length) return ''
    const gap = language === 'en' ? ' ' : ''
    const html = ops
      .map((op) => {
        if (side === 'original') {
          if (op.type === 'extra') return ''
          const tok = escapeHtml(op.original || '')
          if (op.type === 'match') return `<span class="spk-mark ok">${tok}</span>`
          if (op.type === 'miss') return `<mark class="spk-mark miss" title="${t('Missing', '抜け', '遗漏')}">${tok}</mark>`
          if (op.type === 'change')
            return `<mark class="spk-mark change" title="${t('Changed', '違い', '不同')}">${tok}</mark>`
          return tok
        }
        if (op.type === 'miss') return ''
        const tok = escapeHtml(op.said || '')
        if (op.type === 'match') return `<span class="spk-mark ok">${tok}</span>`
        if (op.type === 'extra')
          return `<mark class="spk-mark extra" title="${t('Extra', '余分', '多说')}">${tok}</mark>`
        if (op.type === 'change')
          return `<mark class="spk-mark change" title="${t('Changed', '違い', '不同')}">${tok}</mark>`
        return tok
      })
      .filter(Boolean)
      .join(gap)
    return html || `<span class="spk-mark muted">—</span>`
  }

  function feedbackDetailsHtml(fb) {
    const original = fb.original || fb.sentence || gradeTarget()
    const heard = fb.transcript || ''
    const diff =
      fb.diff ||
      (original && heard ? buildSpeakDiff(original, heard, language) : [])
    const hasMistakes = diff.some((op) => op.type !== 'match')

    return `
      <p class="spk-section-label">${t(
        'Compare original & heard',
        '原文と認識結果の比較',
        '原文与识别对比',
      )}</p>
      <div class="spk-diff" lang="${language}">
        <div class="spk-diff-row">
          <span class="spk-diff-label">${t('Original', '原文', '原文')}</span>
          <p class="spk-diff-line">${renderDiffLine(diff, 'original')}</p>
        </div>
        <div class="spk-diff-row">
          <span class="spk-diff-label">${t('Heard', '認識', '识别')}</span>
          <p class="spk-diff-line">${renderDiffLine(diff, 'heard')}</p>
        </div>
        <p class="spk-diff-legend">
          <span><mark class="spk-mark miss"> </mark> ${t('Missing', '抜け', '遗漏')}</span>
          <span><mark class="spk-mark change"> </mark> ${t('Changed', '違い', '不同')}</span>
          <span><mark class="spk-mark extra"> </mark> ${t('Extra', '余分', '多说')}</span>
        </p>
        ${
          !hasMistakes
            ? `<p class="spk-diff-ok">${t(
                'No mismatches spotted in the transcript.',
                '認識上の食い違いは見つかりませんでした。',
                '识别结果与原文基本一致。',
              )}</p>`
            : ''
        }
      </div>
      <p class="spk-section-label">${t('What to improve', '改善ポイント', '改进建议')}</p>
      <ul class="spk-improve">${(fb.improvements || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
    `
  }

  function feedbackHtml() {
    const fb = activeFeedback()
    if (!fb) {
      return `<div class="spk-feedback-slot" aria-hidden="true"></div>`
    }

    return `
      <div class="spk-feedback-slot">
        <div class="spk-feedback">
          <div class="spk-rating" aria-label="${fb.rating}/5">${ratingDots(fb.rating)} <span>${fb.rating}/5</span></div>
          <p class="spk-summary">${escapeHtml(fb.summary)}</p>
          ${feedbackDetailsHtml(fb)}
        </div>
      </div>
    `
  }

  function feedbackSheetHtml() {
    if (!isPhoneViewport()) return ''
    const open = state.feedbackSheetOpen
    const fb = activeFeedback()
    const sents = sentences()
    const canNext = state.index < sents.length - 1
    const expandLabel = state.feedbackSheetExpanded
      ? t('Hide details', '詳細を隠す', '收起详情')
      : t('See full feedback', '詳細を見る', '查看完整反馈')

    let body = ''
    if (state.grading) {
      body = `<p class="spk-hint spk-feedback-sheet-status">${t('Grading…', '採点中…', '评分中…')}</p>`
    } else if (fb) {
      const nextClass = Number(fb.rating) >= 5 ? 'primary' : 'ghost-chip'
      body = `
        <div class="spk-rating" aria-label="${fb.rating}/5">${ratingDots(fb.rating)} <span>${fb.rating}/5</span></div>
        <p class="spk-summary">${escapeHtml(fb.summary)}</p>
        <button type="button" class="ghost-chip spk-feedback-expand" id="spk-feedback-expand" aria-expanded="${state.feedbackSheetExpanded}">
          ${expandLabel}
        </button>
        <div class="spk-feedback-details" ${state.feedbackSheetExpanded ? '' : 'hidden'}>
          ${feedbackDetailsHtml(fb)}
        </div>
        <div class="spk-feedback-actions">
          <button type="button" class="ghost-chip" id="spk-feedback-retry">${t('Try again', 'もう一度', '再试一次')}</button>
          <button type="button" class="${nextClass}" id="spk-feedback-next" ${canNext ? '' : 'disabled'}>
            ${t('Next line', '次の行', '下一句')}
          </button>
        </div>
      `
    } else if (state.gradeError) {
      body = `<p class="error-text">${escapeHtml(state.gradeError)}</p>`
    } else {
      return ''
    }

    return `
      <div class="spk-feedback-sheet ${open ? 'is-open' : ''} ${state.feedbackSheetExpanded ? 'is-expanded' : ''}" id="spk-feedback-sheet" ${open ? '' : 'hidden'}>
        <div class="spk-feedback-sheet-backdrop" data-close-feedback-sheet></div>
        <div class="spk-feedback-sheet-panel" role="dialog" aria-label="${t('Feedback', 'フィードバック', '反馈')}">
          <div class="spk-feedback-sheet-handle" aria-hidden="true"></div>
          <div class="spk-feedback-sheet-head">
            <h2 class="spk-feedback-sheet-title">${t('Feedback', 'フィードバック', '反馈')}</h2>
            <button type="button" class="practice-icon-btn" id="spk-feedback-close" aria-label="${t('Close', '閉じる', '关闭')}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5Z"/></svg>
            </button>
          </div>
          ${body}
        </div>
      </div>
    `
  }

  function vocabHtml() {
    const words = state.lesson.words || []
    if (!words.length) return ''
    return `
      <section class="spk-vocab">
        <h3>${t('Words worth knowing', '覚えておきたい語', '值得记住的词')}</h3>
        <div class="spk-vocab-grid">
          ${words
            .map(
              (w, i) => `
            <div class="spk-vocab-item">
              <div class="spk-vocab-head">
                <span class="spk-word" lang="${language}">${escapeHtml(w.word)}</span>
                ${w.reading ? `<span class="spk-reading">${escapeHtml(w.reading)}</span>` : ''}
                <button type="button" class="icon-btn spk-word-speak" data-word="${i}" aria-label="Speak">🔊</button>
              </div>
              <p class="spk-meaning">${escapeHtml(w.meaning)}</p>
              <p class="spk-example" lang="${language}">${escapeHtml(w.example)}</p>
              ${
                w.exampleTranslation
                  ? `<p class="spk-translation">${escapeHtml(w.exampleTranslation)}</p>`
                  : ''
              }
            </div>`,
            )
            .join('')}
        </div>
      </section>
    `
  }

  async function render() {
    const gen = ++renderGen
    const sents = sentences()
    const gradedCount = state.results.filter(Boolean).length
    const avg = gradedCount
      ? state.results.reduce((sum, r) => sum + (r ? r.rating : 0), 0) / gradedCount
      : 0
    const phone = isPhoneViewport()
    const listenHtml = listenControlsHtml({ compact: phone })
    // Paint plaintext immediately — Japanese furigana is applied asynchronously
    // so the article never looks empty while Kuroshiro initializes.
    const articleBody = articleHtmlSync()

    const settingsDrawerHtml =
      state.drawer === 'settings'
        ? `<aside class="drawer" role="dialog" aria-label="${t('Settings', '設定', '设置')}">
        <div class="drawer-head">
          <h2>${t('Speaking settings', 'スピーキング設定', '口语设置')}</h2>
          <button type="button" class="drawer-close" id="btn-close-drawer" aria-label="Close">×</button>
        </div>
        <div class="drawer-body">
          <section class="drawer-section">
            <h3>${t('Playback', '読み上げ', '朗读')}</h3>
            <label class="opt-row">
              <input type="checkbox" id="set-speak-sentence" ${settings.speakOnSentenceClick ? 'checked' : ''} />
              <span>${
                t(
                  'Read when clicking on a sentence',
                  '文をクリックしたとき読み上げ',
                  '点击句子时朗读',
                )
              }</span>
            </label>
            ${
              language === 'ja'
                ? `<label class="opt-row">
              <input type="checkbox" id="set-speak-hiragana" ${settings.speakShowHiragana ? 'checked' : ''} />
              <span>${
                t(
                  'Show hiragana above kanji',
                  '漢字にひらがな（ふりがな）を表示',
                  '在汉字上方显示假名',
                )
              }</span>
            </label>`
                : ''
            }
          </section>
          <section class="drawer-section">
            <h3>${t('Article length', '文章の長さ', '文章长度')}</h3>
            <p class="drawer-lead">${
              t(
                'Use either time or word/character count — only one applies. Set a min and max.',
                '時間か文字数のどちらか一方だけ適用されます。最小と最大を設定します。',
                '时间与字数二选一，同时只生效一种。可设置最少和最多。',
              )
            }</p>
            <label class="opt-row">
              <input type="radio" name="speak-limit-mode" value="time" ${settings.speakLimitMode !== 'count' ? 'checked' : ''} />
              <span>${t('Time limit', '時間', '时间')}</span>
            </label>
            <label class="field-row field-row-unit">
              <span class="unit-prefix">${t('Min', '最小', '最少')}</span>
              <input type="number" id="set-speak-min-minutes" min="1" max="${settings.speakMaxMinutes}" value="${settings.speakMinMinutes}" ${settings.speakLimitMode === 'count' ? 'disabled' : ''} />
              <span class="unit">${t('min', '分', '分钟')}</span>
            </label>
            <label class="field-row field-row-unit">
              <span class="unit-prefix">${t('Max', '最大', '最多')}</span>
              <input type="number" id="set-speak-minutes" min="${settings.speakMinMinutes}" max="30" value="${settings.speakMaxMinutes}" ${settings.speakLimitMode === 'count' ? 'disabled' : ''} />
              <span class="unit">${t('min', '分', '分钟')}</span>
            </label>
            <label class="opt-row">
              <input type="radio" name="speak-limit-mode" value="count" ${settings.speakLimitMode === 'count' ? 'checked' : ''} />
              <span>${
                language === 'en'
                  ? 'Word count'
                  : t('Character count', '文字数', '字数')
              }</span>
            </label>
            <label class="field-row field-row-unit">
              <span class="unit-prefix">${t('Min', '最小', '最少')}</span>
              <input type="number" id="set-speak-min-count" min="10" max="${settings.speakMaxCount}" value="${settings.speakMinCount}" ${settings.speakLimitMode !== 'count' ? 'disabled' : ''} />
              <span class="unit">${language === 'en' ? 'words' : t('chars', '文字', '字')}</span>
            </label>
            <label class="field-row field-row-unit">
              <span class="unit-prefix">${t('Max', '最大', '最多')}</span>
              <input type="number" id="set-speak-count" min="${settings.speakMinCount}" max="2000" value="${settings.speakMaxCount}" ${settings.speakLimitMode !== 'count' ? 'disabled' : ''} />
              <span class="unit">${language === 'en' ? 'words' : t('chars', '文字', '字')}</span>
            </label>
            <p class="drawer-lead">${t(
              'Takes effect when you press Done.',
              '「完了」を押すと反映されます。',
              '点「完成」后立即生效。',
            )}</p>
          </section>
        </div>
      </aside>`
        : ''

    if (state.drawer === 'settings' && isPhoneViewport()) {
      document.body.classList.remove('spk-feedback-sheet-open')
      root.innerHTML = settingsDrawerHtml
      bindAll()
      syncBottomTabActive()
      return
    }

    root.innerHTML = `
      <div class="speaking-app">
        <header class="spk-top">
          <div>
            <p class="spk-kicker">${t('Speaking', 'スピーキング', '口语')} · ${
              t('Listen & repeat', '聞いて繰り返す', '听读跟说')
            }</p>
            <h1 class="spk-title">${escapeHtml(state.lesson.title)}</h1>
          </div>
          <div class="spk-top-actions">
            <span class="minutes-chip">~${state.lesson.estimatedMinutes || 5} min</span>
            ${
              phone
                ? `<div class="spk-top-line-nav" role="group" aria-label="${t('Line', '行', '句')}">
              <button type="button" class="practice-icon-btn spk-icon-nav" id="spk-prev" ${state.index === 0 ? 'disabled' : ''} aria-label="${t('Previous', '前の行', '上一句')}" title="${t('Previous', '前の行', '上一句')}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5.5 9 12l6.5 6.5 1.4-1.4L11.8 12l5.1-5.1-1.4-1.4Z"/></svg>
              </button>
              <button type="button" class="practice-icon-btn spk-icon-nav" id="spk-next-line" ${
                state.index >= sents.length - 1 ? 'disabled' : ''
              } aria-label="${t('Next line', '次の行', '下一句')}" title="${t('Next line', '次の行', '下一句')}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.5 5.5 6.5 6.5-6.5 6.5-1.4-1.4L12.2 12 7.1 6.9l1.4-1.4Z"/></svg>
              </button>
            </div>`
                : ''
            }
            <button type="button" class="practice-icon-btn spk-refresh" id="spk-next" aria-label="${
              t('Another article', '別の記事', '换一篇')
            }" title="${t('Another article', '別の記事', '换一篇')}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8S7.58 20 12 20a8 8 0 0 0 7.75-6h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z"/></svg>
            </button>
            ${
              phone
                ? `<div class="spk-listen spk-listen-compact">${listenHtml}</div>`
                : ''
            }
            ${
              phone
                ? `<span class="spk-counter spk-top-counter">${state.index + 1}/${sents.length} ${t('Line', '行', '句')}</span>`
                : ''
            }
            <button type="button" class="ghost-chip" id="spk-open-settings">${
              t('Settings', '設定', '设置')
            }</button>
          </div>
        </header>

        <section class="practice-card spk-card">
          <div class="spk-layout">
            <div class="spk-article-pane">
              <div class="spk-article${language === 'ja' && settings.speakShowHiragana ? ' has-furigana' : ''}" lang="${language}">${articleBody}</div>
            </div>

            <aside class="spk-side">
              <div class="spk-side-body">
              ${phone ? '' : `<div class="spk-listen">${listenHtml}</div>`}

              <div class="spk-practice">
                <div class="spk-repeat-head">
                  <h2>${
                    t(
                      'Your turn — repeat the highlighted line',
                      'ハイライトの文を声に出して繰り返す',
                      '请跟读高亮句子',
                    )
                  }</h2>
                  <div class="spk-repeat-meta">
                    <span class="spk-counter">${state.index + 1} / ${sents.length} ${t('Line', '行', '句')}</span>
                  </div>
                </div>

                ${
                  recognizer.supported
                    ? `<div class="spk-mic-block${state.listening ? ' is-listening' : ''}">
                        <div class="spk-transcribe-float" ${state.listening ? '' : 'hidden'} aria-live="polite">
                          <span class="spk-transcribe-label">${t('Auto transcribing', '自動文字起こし中', '自动转写中')}</span>
                          <p class="spk-transcribe-text">${escapeHtml(state.transcript || '…')}</p>
                        </div>
                        <button type="button" class="spk-mic ${state.listening ? 'is-listening' : ''}" id="spk-mic" aria-pressed="${state.listening}" aria-label="${
                          state.listening
                            ? t('Stop recording', '録音を停止', '停止录音')
                            : t('Start recording', '録音開始', '开始录音')
                        }">
                          ${micIconHtml(state.listening)}
                        </button>
                        <p class="spk-mic-status">${
                          state.listening
                            ? t('Listening… tap to stop', '聞き取り中…タップで停止', '正在听写…点按停止')
                            : t('Tap to start speaking', 'タップして話す', '点按开始说话')
                        }</p>
                        <p class="spk-sr-error error-text" ${state.srError ? '' : 'hidden'}>${escapeHtml(
                          state.srError,
                        )}</p>
                      </div>`
                    : `<div class="spk-manual">
                        <p class="spk-hint">${
                          language === 'ja'
                            ? '音声認識が使えません。話した内容を入力してください（Chrome 推奨）。'
                            : "Live speech recognition isn't supported here (try Chrome). Type what you said:"
                        }</p>
                        <textarea id="spk-manual" rows="3" placeholder="${
                          t('Type or paste what you said…', '話した内容を入力…', '输入你说的内容…')
                        }">${escapeHtml(state.manualText)}</textarea>
                        <button type="button" class="ghost-chip" id="spk-grade-manual" ${
                          state.grading ? 'disabled' : ''
                        }>${
                          state.grading
                            ? t('Grading…', '採点中…', '评分中…')
                            : t('Get feedback', 'フィードバック', '获取反馈')
                        }</button>
                      </div>`
                }

                ${state.grading && !phone ? `<p class="spk-hint">${t('Grading…', '採点中…', '评分中…')}</p>` : ''}
                ${state.gradeError && !phone ? `<p class="error-text">${escapeHtml(state.gradeError)}</p>` : ''}
                ${phone ? '' : feedbackHtml()}

                ${
                  gradedCount
                    ? `<p class="spk-avg">${
                        t('Session average', '平均', '平均分')
                      }: ${avg.toFixed(1)}/5 · ${gradedCount}/${sents.length}</p>`
                    : ''
                }
              </div>
              </div>
              <div class="spk-nav">
                ${
                  phone
                    ? ''
                    : `<button type="button" class="ghost-chip" id="spk-prev" ${state.index === 0 ? 'disabled' : ''}>
                  ← ${t('Previous', '前の行', '上一句')}
                </button>
                <button type="button" class="ghost-chip" id="spk-next-line" ${
                  state.index >= sents.length - 1 ? 'disabled' : ''
                }>
                  ${t('Next line', '次の行', '下一句')} →
                </button>`
                }
              </div>
            </aside>
          </div>
        </section>

        ${vocabHtml()}
        <p class="footer-note">${
          t(
            'Speaking · browser speech recognition',
            'スピーキング · ブラウザ音声認識',
            '口语 · 浏览器语音识别',
          )
        }</p>
        ${feedbackSheetHtml()}
      </div>
      ${
        state.drawer === 'settings'
          ? `<div class="drawer-backdrop" id="drawer-backdrop"></div>${settingsDrawerHtml}`
          : ''
      }
    `

    bindAll()
    syncArticlePaneHeight()
    scrollActiveSentenceIntoView()
    document.body.classList.toggle('spk-feedback-sheet-open', Boolean(state.feedbackSheetOpen && isPhoneViewport()))
    void enhanceArticleFurigana(gen)
    const side = root.querySelector('.spk-side')
    if (sideResizeObserver) {
      sideResizeObserver.disconnect()
      if (side) sideResizeObserver.observe(side)
    }
  }

  function syncArticlePaneHeight() {
    const side = root.querySelector('.spk-side')
    const pane = root.querySelector('.spk-article-pane')
    if (!side || !pane) return
    if (window.matchMedia('(max-width: 768px)').matches) {
      pane.style.height = ''
      pane.style.maxHeight = ''
      side.style.height = ''
      return
    }
    // Fixed paired height ≈ controls + reserved feedback so the card does not jump
    const FIXED = 680
    pane.style.height = `${FIXED}px`
    pane.style.maxHeight = `${FIXED}px`
    side.style.height = `${FIXED}px`
  }

  function scrollActiveSentenceIntoView() {
    const active = root.querySelector('.spk-sent.is-active')
    const pane = root.querySelector('.spk-article-pane')
    if (!active || !pane) return
    const idx = Number(active.getAttribute('data-sent'))
    const count = sentences().length
    if (isPhoneViewport() && idx > 0 && idx < count - 1) {
      active.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
      return
    }
    const a = active.getBoundingClientRect()
    const p = pane.getBoundingClientRect()
    if (a.top < p.top + 8 || a.bottom > p.bottom - 8) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }

  function startRecordingFromSheet() {
    if (!recognizer.supported) return
    requestAnimationFrame(() => {
      if (state.listening) return
      stopArticle()
      state.gradeError = ''
      recognizer.reset()
      recognizer.start()
      patchLive()
    })
  }

  function bindListen() {
    root.querySelector('#spk-play')?.addEventListener('click', playArticle)
    root.querySelector('#spk-pause')?.addEventListener('click', pauseArticle)
    root.querySelector('#spk-stop')?.addEventListener('click', stopArticle)
    root.querySelector('#spk-rate')?.addEventListener('change', (e) => {
      state.rate = Number(e.target.value) || 1
    })
  }

  function bindAll() {
    bindListen()
    root.querySelector('#spk-next')?.addEventListener('click', nextLesson)
    root.querySelector('#spk-open-settings')?.addEventListener('click', () => {
      openSpeakSettings()
    })
    root.querySelector('#drawer-backdrop')?.addEventListener('click', () => {
      closeSettingsApplyingLimits()
    })
    root.querySelectorAll('#btn-close-drawer').forEach((btn) =>
      btn.addEventListener('click', () => {
        closeSettingsApplyingLimits()
      }),
    )
    root.querySelector('#set-speak-sentence')?.addEventListener('change', (e) => {
      applySpeakSetting(e.target.checked)
    })
    root.querySelector('#set-speak-hiragana')?.addEventListener('change', (e) => {
      settings = saveJapaneseSettings({ speakShowHiragana: e.target.checked })
      furiganaCache.clear()
      // Full re-render so article body re-runs async furigana conversion
      void render()
    })
    root.querySelectorAll('input[name="speak-limit-mode"]').forEach((el) => {
      el.addEventListener('change', (e) => {
        if (!e.target.checked) return
        applySpeakLimitPatch({ speakLimitMode: e.target.value === 'count' ? 'count' : 'time' })
      })
    })
    root.querySelector('#set-speak-minutes')?.addEventListener('change', (e) => {
      applySpeakLimitPatch({ speakMaxMinutes: Number(e.target.value) || 5 })
    })
    root.querySelector('#set-speak-min-minutes')?.addEventListener('change', (e) => {
      applySpeakLimitPatch({ speakMinMinutes: Number(e.target.value) || 1 })
    })
    root.querySelector('#set-speak-count')?.addEventListener('change', (e) => {
      applySpeakLimitPatch({ speakMaxCount: Number(e.target.value) || (language === 'en' ? 150 : 200) })
    })
    root.querySelector('#set-speak-min-count')?.addEventListener('change', (e) => {
      applySpeakLimitPatch({ speakMinCount: Number(e.target.value) || (language === 'en' ? 40 : 60) })
    })
    root.querySelector('#spk-prev')?.addEventListener('click', () => setIndex(state.index - 1))
    root.querySelector('#spk-next-line')?.addEventListener('click', () => setIndex(state.index + 1))
    bindArticleClicks()
    root.querySelector('#spk-mic')?.addEventListener('click', () => {
      if (state.listening) {
        recognizer.stop()
        return
      }
      // Stop article / line pronunciation so recording isn't competing with TTS
      stopArticle()
      state.gradeError = ''
      clearActiveFeedback()
      const fb = root.querySelector('.spk-feedback')
      fb?.remove()
      syncArticlePaneHeight()
      recognizer.start()
      patchLive()
    })
    root.querySelector('[data-close-feedback-sheet]')?.addEventListener('click', () => {
      state.feedbackSheetOpen = false
      state.feedbackSheetExpanded = false
      render()
    })
    root.querySelector('#spk-feedback-close')?.addEventListener('click', () => {
      state.feedbackSheetOpen = false
      state.feedbackSheetExpanded = false
      render()
    })
    root.querySelector('#spk-feedback-expand')?.addEventListener('click', () => {
      state.feedbackSheetExpanded = !state.feedbackSheetExpanded
      render()
    })
    root.querySelector('#spk-feedback-retry')?.addEventListener('click', () => {
      clearActiveFeedback()
      stopArticle()
      state.gradeError = ''
      state.transcript = ''
      recognizer.reset()
      render()
      startRecordingFromSheet()
    })
    root.querySelector('#spk-feedback-next')?.addEventListener('click', () => {
      state.feedbackSheetOpen = false
      state.feedbackSheetExpanded = false
      stopArticle()
      setIndex(state.index + 1)
      startRecordingFromSheet()
    })
    root.querySelector('#spk-manual')?.addEventListener('input', (e) => {
      state.manualText = e.target.value
    })
    root.querySelector('#spk-grade-manual')?.addEventListener('click', () => {
      runGrade(state.manualText)
    })
    root.querySelectorAll('.spk-word-speak').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-word'))
        const w = state.lesson.words?.[i]
        if (w) speakText(w.word, language, 0.9)
      })
    })
  }

  window.addEventListener(
    'beforeunload',
    () => {
      cancelSpeech()
      recognizer.destroy()
    },
    { once: true },
  )

  const sideResizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          syncArticlePaneHeight()
        })
      : null

  window.addEventListener('resize', () => {
    syncArticlePaneHeight()
  })

  // Warm morphological dictionary so speaking furigana is ready
  if (language === 'ja') {
    void import('./furigana.js')
      .then((m) => m.getKuroshiro())
      .then(() => {
        if (settings.speakShowHiragana) void render()
      })
      .catch((err) => console.warn('Kuromoji warmup failed', err))
  }

  render()

  registerDrawerHandlers({
    open: (name) => {
      if (name === 'settings') openSpeakSettings()
      else if (name === 'mistakes') {
        // Mistakes live on typing — handled by mobileNav via pending + skill switch
      }
    },
    close: () => closeSettingsApplyingLimits(),
    getOpen: () => state.drawer,
  })
}
