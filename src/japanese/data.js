/**
 * Japanese passages as surface + hiragana reading segments.
 * Type romaji for each segment; hint shows ひらがな.
 *
 * Article bank is shared with speaking (`articleBank.js`).
 * Sentence bank includes examples adapted from https://j-nihongo.com/
 * (grammar 例文 with readings).
 */

import { punctTypingKey } from '../punct.js'
import { JA_ARTICLE_BANK } from './articleBank.js'
import { segmentsFromAozoraText } from './aozoraBank.js'

/** @typedef {{ surface: string, kana: string | null }} JpSegment */
/** @typedef {{ title: string, segments: JpSegment[] }} JpPassage */

export { JP_SENTENCES } from './sentences.generated.js'
export { AOZORA_PASSAGES } from './aozoraBank.js'
export { JA_ARTICLE_BANK } from './articleBank.js'

/** @type {JpPassage[]} */
export const JP_WORDS = [
  { title: '単語', segments: [{ surface: '猫', kana: 'ねこ' }] },
  { title: '単語', segments: [{ surface: '犬', kana: 'いぬ' }] },
  { title: '単語', segments: [{ surface: '本', kana: 'ほん' }] },
  { title: '単語', segments: [{ surface: '水', kana: 'みず' }] },
  { title: '単語', segments: [{ surface: '火', kana: 'ひ' }] },
  { title: '単語', segments: [{ surface: '山', kana: 'やま' }] },
  { title: '単語', segments: [{ surface: '川', kana: 'かわ' }] },
  { title: '単語', segments: [{ surface: '花', kana: 'はな' }] },
  { title: '単語', segments: [{ surface: '空', kana: 'そら' }] },
  { title: '単語', segments: [{ surface: '海', kana: 'うみ' }] },
  { title: '単語', segments: [{ surface: '今日', kana: 'きょう' }] },
  { title: '単語', segments: [{ surface: '明日', kana: 'あした' }] },
  { title: '単語', segments: [{ surface: '昨日', kana: 'きのう' }] },
  { title: '単語', segments: [{ surface: '友達', kana: 'ともだち' }] },
  { title: '単語', segments: [{ surface: '先生', kana: 'せんせい' }] },
  { title: '単語', segments: [{ surface: '学生', kana: 'がくせい' }] },
  { title: '単語', segments: [{ surface: '電車', kana: 'でんしゃ' }] },
  { title: '単語', segments: [{ surface: '駅', kana: 'えき' }] },
  { title: '単語', segments: [{ surface: '時間', kana: 'じかん' }] },
  { title: '単語', segments: [{ surface: '練習', kana: 'れんしゅう' }] },
]

/** Shared library (≥30) for typing articles — same titles as speaking. */
/** @type {JpPassage[]} */
export const JP_ARTICLES = JA_ARTICLE_BANK.map(({ title, text }) => ({
  title,
  segments: segmentsFromAozoraText(text),
}))

/**
 * @param {JpPassage} passage
 * @returns {{ surface: string, kana: string | null, expectedKey?: string, index: number, spanStart: number, spanEnd: number, kind: 'kana' | 'punct' | 'space' }[]}
 */
export function buildJapaneseUnits(passage) {
  const units = []
  let cursor = 0
  const segs = passage.segments || []
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    const surface = seg.surface || ''
    const spanStart = cursor
    const spanEnd = cursor + [...surface].length - 1
    cursor += [...surface].length
    if (seg.kana) {
      units.push({
        surface,
        kana: seg.kana,
        index: i,
        spanStart,
        spanEnd,
        kind: 'kana',
      })
    } else if (/[\u4E00-\u9FFF々〆ヵヶ]/.test(surface)) {
      // Kanji without reading yet — still typeable after enrichment; skip if still null
      // (enrichment fills kana). If left null, treat surface as skip-display only.
    } else {
      const key = punctTypingKey(surface)
      if (key) {
        units.push({
          surface,
          kana: null,
          expectedKey: key,
          index: i,
          spanStart,
          spanEnd,
          kind: key === ' ' ? 'space' : 'punct',
        })
      }
    }
  }
  return units
}

/** Flat display string from segments. */
export function passageDisplayText(passage) {
  return (passage.segments || []).map((s) => s.surface).join('')
}

/**
 * Article length for Japanese: 1 character (kanji/kana/punct) = 1 word.
 * Spaces are ignored; matches speaking measure for ja.
 * @param {JpPassage | string} passageOrText
 */
export function countJapaneseChars(passageOrText) {
  const text =
    typeof passageOrText === 'string' ? passageOrText : passageDisplayText(passageOrText)
  return [...String(text || '')].filter((ch) => !/\s/.test(ch)).length
}

export function countJapaneseUnits(passage) {
  return (passage.segments || []).filter((s) => s.kana).length
}

/**
 * Trim a single Japanese passage to at most maxChars (never concatenates others).
 * @param {JpPassage} passage
 * @param {number} minChars unused — kept for call-site compatibility
 * @param {number} maxChars
 * @param {JpPassage[]} [_extraPassages] ignored
 * @returns {JpPassage}
 */
export function fitJapanesePassage(passage, minChars, maxChars, _extraPassages = []) {
  void minChars
  const max = Math.max(1, Math.floor(Number(maxChars) || 1))
  /** @type {JpSegment[]} */
  let segments = [...(passage?.segments || [])]
  while (segments.length > 1 && countJapaneseChars({ segments }) > max) {
    segments.pop()
  }
  return {
    title: passage?.title || '文章',
    segments,
  }
}

/**
 * @param {{ index: number }[]} units
 * @param {number} charsPerPage
 */
export function buildJapanesePages(units, charsPerPage = 40) {
  const size = Math.max(10, Math.min(120, Number(charsPerPage) || 40))
  if (!units.length) return [{ start: 0, end: 0 }]
  const pages = []
  for (let i = 0; i < units.length; i += size) {
    pages.push({ start: i, end: Math.min(units.length, i + size) })
  }
  return pages
}

export function pageIndexForUnit(pages, unitIndex) {
  for (let i = 0; i < pages.length; i++) {
    if (unitIndex >= pages[i].start && unitIndex < pages[i].end) return i
  }
  return Math.max(0, pages.length - 1)
}

/**
 * Build a passage from plain text by treating each char as its own segment.
 * Hiragana/katakana keep themselves as reading; kanji filled later for typing.
 * @param {string} title
 * @param {string} text
 * @returns {JpPassage}
 */
export function passageFromJapaneseText(title, text) {
  const cleaned = String(text || '').replace(/\r\n/g, '\n').trim()
  /** @type {JpSegment[]} */
  const segments = []
  for (const ch of cleaned) {
    if (/[\u3040-\u309F]/.test(ch)) {
      segments.push({ surface: ch, kana: ch, kanaFromSource: false })
    } else if (/[\u30A0-\u30FF]/.test(ch)) {
      segments.push({ surface: ch, kana: ch, kanaFromSource: false })
    } else if (/[\u4E00-\u9FFF]/.test(ch)) {
      segments.push({ surface: ch, kana: null, kanaFromSource: false })
    } else {
      segments.push({ surface: ch, kana: null, kanaFromSource: false })
    }
  }
  if (!segments.some((s) => s.kana || /[\u4E00-\u9FFF]/.test(s.surface || ''))) {
    throw new Error('ひらがな / カタカナ / 漢字が見つかりません')
  }
  return { title: title || 'アップロード', segments }
}
