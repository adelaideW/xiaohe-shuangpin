/**
 * Speaking lesson banks — same built-in articles as typing article mode.
 * EN → ENGLISH_ARTICLES · JA → JA_ARTICLE_BANK · ZH → ARTICLES + LIBRARY_TEXTS
 */

import { ARTICLES as ZH_ARTICLES } from '../data.js'
import { LIBRARY_TEXTS } from '../library.js'
import { ENGLISH_ARTICLES } from '../english/data.js'
import { bankAsSpeakLessons } from '../japanese/articleBank.js'

function countHanzi(text) {
  return [...String(text || '')].filter((c) => /[\u4e00-\u9fff]/.test(c)).length
}

function countWords(text) {
  return (String(text || '').toLowerCase().match(/[a-z0-9']+/g) || []).length
}

/**
 * @param {{ title: string, text?: string, article?: string, words?: any[] }[]} passages
 * @param {'en' | 'ja' | 'zh'} language
 */
function asSpeakLessons(passages, language) {
  return passages.map((p) => {
    const article = String(p.article || p.text || '').trim()
    let estimatedMinutes = 2
    if (language === 'zh') {
      estimatedMinutes = Math.max(1, Math.ceil(countHanzi(article) / 35))
    } else if (language === 'en') {
      estimatedMinutes = Math.max(1, Math.ceil(countWords(article) / 140))
    }
    return {
      title: p.title,
      article,
      estimatedMinutes,
      words: Array.isArray(p.words) ? p.words : [],
    }
  })
}

/**
 * Built-in article bank for a language (matches typing article sources, minus user uploads).
 * @param {'en' | 'ja' | 'zh'} language
 */
export function builtInSpeakBank(language) {
  if (language === 'ja') return bankAsSpeakLessons()
  if (language === 'zh') {
    const poems = ZH_ARTICLES.map(({ title, text }) => ({ title, text }))
    return asSpeakLessons([...poems, ...LIBRARY_TEXTS], 'zh')
  }
  return asSpeakLessons(ENGLISH_ARTICLES, 'en')
}

/** Convenience map — same content as {@link builtInSpeakBank}. */
export const FALLBACK_LESSONS = {
  get en() {
    return builtInSpeakBank('en')
  },
  get ja() {
    return builtInSpeakBank('ja')
  },
  get zh() {
    return builtInSpeakBank('zh')
  },
}

/**
 * @param {'en' | 'ja' | 'zh'} language
 * @param {string[]} [avoidTitles]
 */
export function pickLesson(language, avoidTitles = []) {
  const bank = builtInSpeakBank(language)
  const avoidSet = new Set(avoidTitles)
  const candidates = bank.filter((l) => !avoidSet.has(l.title))
  const pool = candidates.length ? candidates : bank
  const pick = pool[Math.floor(Math.random() * pool.length)]
  return { ...pick, language, source: 'bank' }
}
