/**
 * Japanese passages as surface + hiragana reading segments.
 * Type romaji for each segment; hint shows ひらがな.
 *
 * Sentence bank includes examples adapted from https://j-nihongo.com/
 * (grammar 例文 with readings).
 */

import { punctTypingKey } from '../punct.js'

/** @typedef {{ surface: string, kana: string | null }} JpSegment */
/** @typedef {{ title: string, segments: JpSegment[] }} JpPassage */

export { JP_SENTENCES } from './sentences.generated.js'

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

/** @type {JpPassage[]} */
export const JP_ARTICLES = [
  {
    title: '春の朝',
    segments: [
      { surface: '朝', kana: 'あさ' },
      { surface: 'の', kana: 'の' },
      { surface: '光', kana: 'ひかり' },
      { surface: 'が', kana: 'が' },
      { surface: '窓', kana: 'まど' },
      { surface: 'から', kana: 'から' },
      { surface: '差し込み', kana: 'さしこみ' },
      { surface: '、', kana: null },
      { surface: '桜', kana: 'さくら' },
      { surface: 'の', kana: 'の' },
      { surface: '花びら', kana: 'はなびら' },
      { surface: 'が', kana: 'が' },
      { surface: 'ゆっくり', kana: 'ゆっくり' },
      { surface: 'と', kana: 'と' },
      { surface: '舞い落ちる', kana: 'まいおちる' },
      { surface: '。', kana: null },
      { surface: '深呼吸', kana: 'しんこきゅう' },
      { surface: 'を', kana: 'を' },
      { surface: 'すると', kana: 'すると' },
      { surface: '、', kana: null },
      { surface: '新しい', kana: 'あたらしい' },
      { surface: '一日', kana: 'いちにち' },
      { surface: 'が', kana: 'が' },
      { surface: '始まる', kana: 'はじまる' },
      { surface: '気配', kana: 'けはい' },
      { surface: 'が', kana: 'が' },
      { surface: 'した', kana: 'した' },
      { surface: '。', kana: null },
    ],
  },
  {
    title: '駅の風景',
    segments: [
      { surface: '電車', kana: 'でんしゃ' },
      { surface: 'が', kana: 'が' },
      { surface: 'ホーム', kana: 'ほーむ' },
      { surface: 'に', kana: 'に' },
      { surface: '滑り込む', kana: 'すべりこむ' },
      { surface: '。', kana: null },
      { surface: '人々', kana: 'ひとびと' },
      { surface: 'は', kana: 'は' },
      { surface: '急ぎ足', kana: 'いそぎあし' },
      { surface: 'で', kana: 'で' },
      { surface: '乗り換える', kana: 'のりかえる' },
      { surface: '。', kana: null },
      { surface: '私も', kana: 'わたしも' },
      { surface: '鞄', kana: 'かばん' },
      { surface: 'を', kana: 'を' },
      { surface: '抱えて', kana: 'かかえて' },
      { surface: '、', kana: null },
      { surface: '次', kana: 'つぎ' },
      { surface: 'の', kana: 'の' },
      { surface: '予定', kana: 'よてい' },
      { surface: 'へ', kana: 'へ' },
      { surface: '向かう', kana: 'むかう' },
      { surface: '。', kana: null },
    ],
  },
  {
    title: 'ことわざ',
    segments: [
      { surface: '急がば', kana: 'いそがば' },
      { surface: '回れ', kana: 'まわれ' },
      { surface: '。', kana: null },
      { surface: '石', kana: 'いし' },
      { surface: 'の', kana: 'の' },
      { surface: '上', kana: 'うえ' },
      { surface: 'にも', kana: 'にも' },
      { surface: '三年', kana: 'さんねん' },
      { surface: '。', kana: null },
      { surface: '習う', kana: 'ならう' },
      { surface: 'より', kana: 'より' },
      { surface: '慣れよ', kana: 'なれよ' },
      { surface: '。', kana: null },
    ],
  },
  {
    title: '学びについて',
    segments: [
      { surface: '言葉', kana: 'ことば' },
      { surface: 'を', kana: 'を' },
      { surface: '覚える', kana: 'おぼえる' },
      { surface: 'とき', kana: 'とき' },
      { surface: 'は', kana: 'は' },
      { surface: '、', kana: null },
      { surface: '完璧', kana: 'かんぺき' },
      { surface: 'を', kana: 'を' },
      { surface: '目指す', kana: 'めざす' },
      { surface: 'より', kana: 'より' },
      { surface: '、', kana: null },
      { surface: '毎日', kana: 'まいにち' },
      { surface: '少し', kana: 'すこし' },
      { surface: 'ずつ', kana: 'ずつ' },
      { surface: '触れる', kana: 'ふれる' },
      { surface: 'こと', kana: 'こと' },
      { surface: 'が', kana: 'が' },
      { surface: '大切', kana: 'たいせつ' },
      { surface: 'です', kana: 'です' },
      { surface: '。', kana: null },
      { surface: '間違えて', kana: 'まちがえて' },
      { surface: 'も', kana: 'も' },
      { surface: '気にせず', kana: 'きにせず' },
      { surface: '、', kana: null },
      { surface: 'もう', kana: 'もう' },
      { surface: '一度', kana: 'いちど' },
      { surface: '試せば', kana: 'ためせば' },
      { surface: 'いい', kana: 'いい' },
      { surface: '。', kana: null },
    ],
  },
  {
    title: '夏目漱石 · こころ（冒頭）',
    segments: [
      { surface: '私', kana: 'わたくし' },
      { surface: 'は', kana: 'は' },
      { surface: 'その', kana: 'その' },
      { surface: '人', kana: 'ひと' },
      { surface: 'を', kana: 'を' },
      { surface: '常', kana: 'つね' },
      { surface: 'に', kana: 'に' },
      { surface: '先生', kana: 'せんせい' },
      { surface: 'と呼んで', kana: 'とよんで' },
      { surface: 'いた', kana: 'いた' },
      { surface: '。', kana: null },
      { surface: 'だから', kana: 'だから' },
      { surface: 'ここ', kana: 'ここ' },
      { surface: 'でも', kana: 'でも' },
      { surface: 'ただ', kana: 'ただ' },
      { surface: '先生', kana: 'せんせい' },
      { surface: 'と', kana: 'と' },
      { surface: '書く', kana: 'かく' },
      { surface: 'だけ', kana: 'だけ' },
      { surface: 'で', kana: 'で' },
      { surface: '本名', kana: 'ほんみょう' },
      { surface: 'は', kana: 'は' },
      { surface: '打ち明けない', kana: 'うちあけない' },
      { surface: '。', kana: null },
    ],
  },
]

/**
 * @param {JpPassage} passage
 * @returns {{ surface: string, kana: string | null, expectedKey?: string, index: number, spanStart: number, spanEnd: number, kind: 'kana' | 'punct' }[]}
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
          kind: 'punct',
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

export function countJapaneseUnits(passage) {
  return (passage.segments || []).filter((s) => s.kana).length
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
 * Hiragana/katakana keep themselves as reading; others skipped for typing.
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
      segments.push({ surface: ch, kana: ch })
    } else if (/[\u30A0-\u30FF]/.test(ch)) {
      // katakana surface, convert later to hiragana in practice via wanakana
      segments.push({ surface: ch, kana: ch })
    } else if (/[\u4E00-\u9FFF]/.test(ch)) {
      // Kanji without reading — skip typing, display only
      segments.push({ surface: ch, kana: null })
    } else {
      segments.push({ surface: ch, kana: null })
    }
  }
  if (!segments.some((s) => s.kana)) throw new Error('ひらがな / カタカナが見つかりません')
  return { title: title || 'アップロード', segments }
}
