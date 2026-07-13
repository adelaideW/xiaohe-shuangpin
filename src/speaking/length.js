/**
 * Fit speaking lessons to time OR count limit (mutually exclusive modes).
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
    acc = language === 'en' ? (acc ? `${acc} ${chunk}` : chunk) : `${acc}${chunk}`
    used += m
    if (used >= limit) break
  }
  return (acc || chunks[0]).trim()
}

/**
 * @param {{ article: string, estimatedMinutes?: number, [k: string]: any }} lesson
 * @param {'en' | 'ja' | 'zh'} language
 * @param {{ speakLimitMode?: SpeakLimitMode, speakMaxMinutes?: number, speakMaxCount?: number }} settings
 */
export function fitLessonToSpeakLimit(lesson, language, settings) {
  const mode = settings.speakLimitMode === 'count' ? 'count' : 'time'
  const budget =
    mode === 'count'
      ? Math.max(1, Number(settings.speakMaxCount) || (language === 'en' ? 150 : 200))
      : speakBudgetFromMinutes(language, settings.speakMaxMinutes || 5)

  const article = trimSpeakText(lesson.article || '', language, budget)
  const measure = speakMeasure(article, language)
  const estimatedMinutes =
    mode === 'time'
      ? Math.max(1, Math.min(30, Number(settings.speakMaxMinutes) || 5))
      : Math.max(1, Math.ceil(measure / (language === 'en' ? 140 : 220)))

  return { ...lesson, article, estimatedMinutes, speakMeasure: measure, speakLimitMode: mode }
}

/** Defaults shared across EN / JA / ZH settings objects. */
export const DEFAULT_SPEAK_LIMIT = {
  speakLimitMode: /** @type {SpeakLimitMode} */ ('time'),
  speakMaxMinutes: 5,
  speakMaxCount: 150,
}

/**
 * @param {Record<string, any>} base
 * @param {'en' | 'ja' | 'zh'} language
 */
export function normalizeSpeakLimitSettings(base, language) {
  const mode = base.speakLimitMode === 'count' ? 'count' : 'time'
  const speakMaxMinutes = Math.max(1, Math.min(30, Number(base.speakMaxMinutes) || 5))
  const defaultCount = language === 'en' ? 150 : 200
  const speakMaxCount = Math.max(
    10,
    Math.min(language === 'en' ? 2000 : 2000, Number(base.speakMaxCount) || defaultCount),
  )
  return { speakLimitMode: mode, speakMaxMinutes, speakMaxCount }
}
