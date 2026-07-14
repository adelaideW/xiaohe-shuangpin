/**
 * Oral speaking practice — listen, repeat line-by-line, get feedback.
 * Ported from daily-language-practice into the typing app shell.
 */

import { gradeRepeat, buildSpeakDiff } from './grade.js'
import { pickLesson } from './lessons.js'
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

const ICON_RECORD = `<svg class="spk-mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11.25a6.5 6.5 0 0 0 13 0"/><path d="M12 17.75V21"/><path d="M9.25 21h5.5"/></svg>`
const ICON_STOP = `<svg class="spk-mic-icon spk-stop-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="2" fill="currentColor"/></svg>`

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

  function applySpeakLimitPatch(patch) {
    settings =
      language === 'ja'
        ? saveJapaneseSettings(patch)
        : language === 'zh'
          ? saveSettings(patch)
          : saveEnglishSettings(patch)
    const source = {
      ...state.lesson,
      article: state.lesson.sourceArticle || state.lesson.article,
    }
    state.lesson = fitLessonToSpeakLimit(source, language, settings)
    saveJSON(`${storagePrefix}-lesson`, state.lesson)
    state.index = 0
    state.results = []
    persistResults()
    state.manualText = ''
    state.transcript = ''
    state.gradeError = ''
    render()
  }

  function chooseLesson(avoidTitles = []) {
    return fitLessonToSpeakLimit(pickLesson(language, avoidTitles), language, settings)
  }

  function lessonHasArticle(raw) {
    if (!raw || typeof raw !== 'object') return false
    const text = String(raw.sourceArticle || raw.article || raw.text || '').trim()
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
      article: lesson.sourceArticle || lesson.article || lesson.text || '',
    }
    lesson = fitLessonToSpeakLimit(source, language, settings)
    saveJSON(`${storagePrefix}-lesson`, lesson)
  }

  const state = {
    lesson,
    rate: 1,
    speaking: false,
    paused: false,
    index: 0,
    results: /** @type {any[]} */ (loadJSON(`${storagePrefix}-results`, [])),
    manualText: '',
    grading: false,
    gradeError: '',
    transcript: '',
    listening: false,
    srError: '',
    drawer: /** @type {null | 'settings'} */ (null),
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
      state.transcript = transcript
      state.listening = listening
      state.srError = error
      patchLive()
      if (!listening && transcript && !state.grading && !state.results[state.index]) {
        runGrade(transcript)
      }
    },
  })

  function currentSentence() {
    return sentences()[state.index] || ''
  }

  function persistResults() {
    saveJSON(`${storagePrefix}-results`, state.results)
  }

  async function runGrade(transcript) {
    if (!transcript?.trim()) {
      state.gradeError =
        t(
          'Nothing to grade yet — try recording or typing what you said.',
          '採点する内容がありません。録音するか入力してください。',
          '还没有可评分的内容，请先录音或输入。',
        )
      render()
      return
    }
    state.grading = true
    state.gradeError = ''
    render()
    try {
      const result = await gradeRepeat(language, currentSentence(), transcript)
      state.results[state.index] = { ...result, transcript, sentence: currentSentence() }
      persistResults()
    } catch {
      state.gradeError =
        t(
          'Something went wrong grading your attempt. Please try again.',
          '採点中に問題が発生しました。もう一度お試しください。',
          '评分出错了，请再试一次。',
        )
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
    saveJSON(`${storagePrefix}-results`, [])
    state.index = 0
    state.manualText = ''
    state.gradeError = ''
    state.transcript = ''
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
    state.speaking = true
    state.paused = false
    speakText(state.lesson.article, language, state.rate, () => {
      state.speaking = false
      state.paused = false
      patchListen()
    })
    patchListen()
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
    recognizer.reset()
    render()
    if (readAloud && settings.speakOnSentenceClick) {
      const line = currentSentence()
      if (line) speakText(line, language, state.rate)
    }
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
    host.innerHTML = listenControlsHtml()
    bindListen()
  }

  function patchLive() {
    const status = root.querySelector('.spk-mic-status')
    const live = root.querySelector('.spk-live')
    const err = root.querySelector('.spk-sr-error')
    const mic = root.querySelector('.spk-mic')
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
    if (live) {
      if (state.transcript || state.listening) {
        live.hidden = false
        live.textContent = state.transcript || '…'
      } else {
        live.hidden = true
      }
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

  function listenControlsHtml() {
    const tts = typeof Audio !== 'undefined' || 'speechSynthesis' in window
    if (!tts) {
      return `<p class="spk-hint">${
        language === 'ja'
          ? 'このブラウザは読み上げに対応していません。'
          : "Your browser doesn't support text-to-speech."
      }</p>`
    }
    const playLabel =
      state.paused
        ? t('Resume', '再開', '继续')
        : t('Listen', '全文を聴く', '听全文')
    const pauseLabel = t('Pause', '一時停止', '暂停')
    const stopLabel = t('Stop', '停止', '停止')
    return `
      ${
        !state.speaking || state.paused
          ? `<button type="button" class="ghost-chip" id="spk-play">▶ ${playLabel}</button>`
          : `<button type="button" class="ghost-chip" id="spk-pause">⏸ ${pauseLabel}</button>`
      }
      <button type="button" class="ghost-chip" id="spk-stop" ${!state.speaking && !state.paused ? 'disabled' : ''}>⏹ ${stopLabel}</button>
      <label class="spk-rate">
        <span>${t('Speed', '速度', '语速')}</span>
        <select id="spk-rate">
          <option value="0.8" ${state.rate === 0.8 ? 'selected' : ''}>0.8×</option>
          <option value="1" ${state.rate === 1 ? 'selected' : ''}>1×</option>
          <option value="1.15" ${state.rate === 1.15 ? 'selected' : ''}>1.15×</option>
        </select>
      </label>
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

  function feedbackHtml() {
    const fb = state.results[state.index]
    if (!fb) {
      return `<div class="spk-feedback-slot" aria-hidden="true"></div>`
    }
    const original = fb.original || fb.sentence || currentSentence()
    const heard = fb.transcript || ''
    const diff =
      fb.diff ||
      (original && heard ? buildSpeakDiff(original, heard, language) : [])
    const hasMistakes = diff.some((op) => op.type !== 'match')

    return `
      <div class="spk-feedback-slot">
        <div class="spk-feedback">
          <div class="spk-rating" aria-label="${fb.rating}/5">${ratingDots(fb.rating)} <span>${fb.rating}/5</span></div>
          <p class="spk-summary">${escapeHtml(fb.summary)}</p>
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
    const ttsOk = typeof Audio !== 'undefined' || 'speechSynthesis' in window
    // Paint plaintext immediately — Japanese furigana is applied asynchronously
    // so the article never looks empty while Kuroshiro initializes.
    const articleBody = articleHtmlSync()

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
            <button type="button" class="ghost-chip" id="spk-open-settings">${
              t('Settings', '設定', '设置')
            }</button>
            <button type="button" class="ghost-chip" id="spk-next">${
              t('Another article', '別の記事', '换一篇')
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
              <div class="spk-listen">${listenControlsHtml()}</div>

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
                    ${
                      ttsOk
                        ? `<button type="button" class="icon-btn" id="spk-line" title="${
                            t('Hear this line', 'この行を聴く', '听这一句')
                          }">🔊</button>`
                        : ''
                    }
                    <span class="spk-counter">${state.index + 1} / ${sents.length} ${t('Line', '行', '句')}</span>
                  </div>
                </div>

                ${
                  recognizer.supported
                    ? `<div class="spk-mic-block">
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
                        <p class="spk-live" ${state.transcript || state.listening ? '' : 'hidden'}>${escapeHtml(
                          state.transcript || '…',
                        )}</p>
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

                ${state.grading ? `<p class="spk-hint">${t('Grading…', '採点中…', '评分中…')}</p>` : ''}
                ${state.gradeError ? `<p class="error-text">${escapeHtml(state.gradeError)}</p>` : ''}
                ${feedbackHtml()}

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
                <button type="button" class="ghost-chip" id="spk-prev" ${state.index === 0 ? 'disabled' : ''}>
                  ← ${t('Previous', '前の行', '上一句')}
                </button>
                <button type="button" class="ghost-chip" id="spk-next-line" ${
                  state.index >= sents.length - 1 ? 'disabled' : ''
                }>
                  ${t('Next line', '次の行', '下一句')} →
                </button>
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
      </div>
      ${
        state.drawer === 'settings'
          ? `<div class="drawer-backdrop" id="drawer-backdrop"></div>
      <aside class="drawer" role="dialog" aria-label="${t('Settings', '設定', '设置')}">
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
            <p class="drawer-lead">${t('Applies on Next lesson.', '「次のレッスン」で反映されます。', '点「下一篇」后生效。')}</p>
          </section>
        </div>
        <div class="drawer-foot">
          <button type="button" class="primary" id="btn-close-drawer">${t('Done', '完了', '完成')}</button>
        </div>
      </aside>`
          : ''
      }
    `

    bindAll()
    syncArticlePaneHeight()
    scrollActiveSentenceIntoView()
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
    if (window.matchMedia('(max-width: 900px)').matches) {
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
    const a = active.getBoundingClientRect()
    const p = pane.getBoundingClientRect()
    if (a.top < p.top + 8 || a.bottom > p.bottom - 8) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
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
      settings =
        language === 'ja'
          ? loadJapaneseSettings()
          : language === 'zh'
            ? loadSettings()
            : loadEnglishSettings()
      state.drawer = 'settings'
      render()
    })
    root.querySelector('#drawer-backdrop')?.addEventListener('click', () => {
      state.drawer = null
      render()
    })
    root.querySelectorAll('#btn-close-drawer').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.drawer = null
        render()
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
    root.querySelector('#spk-line')?.addEventListener('click', () => {
      speakText(currentSentence(), language, state.rate)
    })
    root.querySelector('#spk-prev')?.addEventListener('click', () => setIndex(state.index - 1))
    root.querySelector('#spk-next-line')?.addEventListener('click', () => setIndex(state.index + 1))
    bindArticleClicks()
    root.querySelector('#spk-mic')?.addEventListener('click', () => {
      if (state.listening) {
        recognizer.stop()
        return
      }
      state.gradeError = ''
      state.results[state.index] = undefined
      persistResults()
      const fb = root.querySelector('.spk-feedback')
      fb?.remove()
      syncArticlePaneHeight()
      recognizer.start()
      patchLive()
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
}
