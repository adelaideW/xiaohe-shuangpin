/**
 * Fit speaking lessons to time OR count limit (mutually exclusive modes).
 * Max caps length; min floors it when the source article is long enough.
 */

import { countEnglishWords } from '../english/data.js'

/** @typedef {'time' | 'count'} SpeakLimitMode */

/**
 * @param {string} text
 * @param {'en' | 'ja' | 'zh'} language
 */
export function speakMeasure(text, language) {
  if (language === 'en') return countEnglishWords(text)
  return [...String(text || '')].filter((ch) => !/\s/.test(ch)).length
}

/**
 * Rough speaking budget from minutes.
 * @param {'en' | 'ja' | 'zh'} language
 * @param {number} minutes
 */
export function speakBudgetFromMinutes(language, minutes) {
  const m = Math.max(1, Math.min(30, Number(minutes) || 5))
  if (language === 'en') return Math.round(m * 140) // ~words / min spoken
  return Math.round(m * 220) // ~chars / min
}

/**
 * @param {string} text
 * @param {'en' | 'ja' | 'zh'} language
 */
export function splitSpeakChunks(text, language) {
  const raw = String(text || '').trim()
  if (!raw) return []
  if (language === 'en') {
    return raw.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) || [raw]
  }
  return raw.match(/[^。！？\n]+[。！？]?|[^\n]+/g)?.map((s) => s.trim()).filter(Boolean) || [raw]
}

/**
 * Trim at sentence boundaries up to a measure budget.
 * @param {string} text
 * @param {'en' | 'ja' | 'zh'} language
 * @param {number} budget
 */
export function trimSpeakText(text, language, budget) {
  const limit = Math.max(1, Math.floor(Number(budget) || 1))
  const chunks = splitSpeakChunks(text, language)
  if (!chunks.length) return ''
  if (speakMeasure(text, language) <= limit) return String(text || '').trim()

  let acc = ''
  let used = 0
  for (const chunk of chunks) {
    const m = speakMeasure(chunk, language)
    if (acc && used + m > limit) break
    if (!acc && m > limit) {
      // Oversized single chunk: hard-trim by measure units
      if (language === 'en') {
        const words = chunk.match(/[A-Za-z0-9']+|\s+|[^\sA-Za-z0-9']+/g) || []
        let wAcc = ''
        let wCount = 0
        for (const part of words) {
          const isWord = /^[A-Za-z0-9']+$/.test(part)
          if (isWord && wCount >= limit) break
          wAcc += part
          if (isWord) wCount += 1
        }
        return wAcc.replace(/\s+$/g, '').trim()
      }
      const chars = [...chunk].filter((ch) => !/\s/.test(ch))
      return chars.slice(0, limit).join('')
    }
    acc = language === 'en' ? (acc ? `${acc} ${chunk}` : chunk) : `${acc}${chunk}`
    used += m
    if (used >= limit) break
  }
  return (acc || chunks[0]).trim()
}

/**
 * Grow to at least `minBudget` (capped by source length), preferring sentence boundaries.
 * @param {string} text
 * @param {'en' | 'ja' | 'zh'} language
 * @param {number} minBudget
 */
export function ensureMinSpeakText(text, language, minBudget) {
  const target = Math.max(1, Math.floor(Number(minBudget) || 1))
  const full = String(text || '').trim()
  if (!full) return ''
  if (speakMeasure(full, language) <= target) return full

  const chunks = splitSpeakChunks(full, language)
  let acc = ''
  let used = 0
  for (const chunk of chunks) {
    acc = language === 'en' ? (acc ? `${acc} ${chunk}` : chunk) : `${acc}${chunk}`
    used += speakMeasure(chunk, language)
    if (used >= target) break
  }
  return (acc || chunks[0] || full).trim()
}

/**
 * @param {{ article: string, estimatedMinutes?: number, [k: string]: any }} lesson
 * @param {'en' | 'ja' | 'zh'} language
 * @param {{
 *   speakLimitMode?: SpeakLimitMode,
 *   speakMaxMinutes?: number,
 *   speakMaxCount?: number,
 *   speakMinMinutes?: number,
 *   speakMinCount?: number,
 * }} settings
 */
export function fitLessonToSpeakLimit(lesson, language, settings) {
  const mode = settings.speakLimitMode === 'count' ? 'count' : 'time'
  const defaultMaxCount = language === 'en' ? 150 : 200
  const defaultMinCount = language === 'en' ? 40 : 60

  let maxBudget =
    mode === 'count'
      ? Math.max(1, Number(settings.speakMaxCount) || defaultMaxCount)
      : speakBudgetFromMinutes(language, settings.speakMaxMinutes || 5)
  let minBudget =
    mode === 'count'
      ? Math.max(1, Number(settings.speakMinCount) || defaultMinCount)
      : speakBudgetFromMinutes(language, settings.speakMinMinutes || 1)
  if (minBudget > maxBudget) minBudget = maxBudget

  const source = lesson.sourceArticle || lesson.article || ''
  let article = trimSpeakText(source, language, maxBudget)
  if (speakMeasure(article, language) < minBudget) {
    article = ensureMinSpeakText(source, language, minBudget)
    if (speakMeasure(article, language) > maxBudget) {
      article = trimSpeakText(article, language, maxBudget)
    }
  }

  const measure = speakMeasure(article, language)
  const estimatedMinutes =
    mode === 'time'
      ? Math.max(
          1,
          Math.min(30, Number(settings.speakMaxMinutes) || 5),
        )
      : Math.max(1, Math.ceil(measure / (language === 'en' ? 140 : 220)))

  return {
    ...lesson,
    sourceArticle: source,
    article,
    estimatedMinutes,
    speakMeasure: measure,
    speakLimitMode: mode,
  }
}

/** Defaults shared across EN / JA / ZH settings objects. */
export const DEFAULT_SPEAK_LIMIT = {
  speakLimitMode: /** @type {SpeakLimitMode} */ ('time'),
  speakMinMinutes: 1,
  speakMaxMinutes: 5,
  speakMinCount: 40,
  speakMaxCount: 150,
}

/**
 * @param {Record<string, any>} base
 * @param {'en' | 'ja' | 'zh'} language
 */
export function normalizeSpeakLimitSettings(base, language) {
  const mode = base.speakLimitMode === 'count' ? 'count' : 'time'
  const defaultMaxCount = language === 'en' ? 150 : 200
  const defaultMinCount = language === 'en' ? 40 : 60

  let speakMinMinutes = Math.max(1, Math.min(30, Number(base.speakMinMinutes) || 1))
  let speakMaxMinutes = Math.max(1, Math.min(30, Number(base.speakMaxMinutes) || 5))
  // Max must never be below Min — raise Max when needed
  if (speakMaxMinutes < speakMinMinutes) speakMaxMinutes = speakMinMinutes

  let speakMinCount = Math.max(10, Math.min(2000, Number(base.speakMinCount) || defaultMinCount))
  let speakMaxCount = Math.max(10, Math.min(2000, Number(base.speakMaxCount) || defaultMaxCount))
  if (speakMaxCount < speakMinCount) speakMaxCount = speakMinCount

  return {
    speakLimitMode: mode,
    speakMinMinutes,
    speakMaxMinutes,
    speakMinCount,
    speakMaxCount,
  }
}
