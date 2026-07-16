/**
 * Input schemes: Xiaohe / Ziranma / Sogou (双拼) and Quanpin (全拼).
 */

import {
  normalizePinyin,
  splitSyllable,
  toXiaohe,
  withUvCodeAliases,
  KEYBOARD_LAYOUT as XIAOHE_LAYOUT,
  selfTest as xiaoheSelfTest,
} from './xiaohe.js'

export { normalizePinyin, splitSyllable, withUvCodeAliases }

/** Plain QWERTY — no 声母/韵母 overlays (used by 全拼). */
export const QUANPIN_LAYOUT = []

/**
 * Full pinyin syllable (tone-less). ü is normalized to v for typing.
 * @param {string} pinyin
 */
export function toQuanpin(pinyin) {
  return normalizePinyin(pinyin)
}

/**
 * Accepted full-pinyin spellings. ü is stored as v; also accept ju/qu/xu/yu for jü…
 * @param {string} pinyin
 * @returns {string[]}
 */
export function quanpinOptions(pinyin) {
  const code = toQuanpin(pinyin)
  if (!code) return []
  const opts = new Set([code])
  // Only ü-family syllables: ju/jue/juan/jun (and q/x/y). Not you/yong/etc.
  const ueFamily = /^[jqxy](u|v)(e|an|n)?$/
  if (ueFamily.test(code)) {
    opts.add(code.replace(/^([jqxy])v/, '$1u'))
    opts.add(code.replace(/^([jqxy])u/, '$1v'))
  }
  return [...opts]
}

export const SCHEMES = {
  xiaohe: {
    id: 'xiaohe',
    label: '小鹤双拼',
    layout: XIAOHE_LAYOUT,
    encode: toXiaohe,
  },
  ziranma: {
    id: 'ziranma',
    label: '自然码',
    layout: [
      [
        ['Q', 'q', 'iu'],
        ['W', 'w', 'ia'],
        ['E', 'e', 'e'],
        ['R', 'r', 'uan'],
        ['T', 't', 'üe'],
        ['Y', 'y', 'ing'],
        ['U', 'sh', 'u'],
        ['I', 'ch', 'i'],
        ['O', 'o', 'uo'],
        ['P', 'p', 'un'],
      ],
      [
        ['A', 'a', 'a'],
        ['S', 's', 'ong'],
        ['D', 'd', 'iang'],
        ['F', 'f', 'en'],
        ['G', 'g', 'eng'],
        ['H', 'h', 'ang'],
        ['J', 'j', 'an'],
        ['K', 'k', 'ao'],
        ['L', 'l', 'ai'],
        [';', ';', 'ing'],
      ],
      [
        ['Z', 'z', 'ei'],
        ['X', 'x', 'ie'],
        ['C', 'c', 'iao'],
        ['V', 'zh', 'ui'],
        ['B', 'b', 'ou'],
        ['N', 'n', 'in'],
        ['M', 'm', 'ian'],
      ],
    ],
    encode: toZiranma,
  },
  sogou: {
    id: 'sogou',
    label: '搜狗双拼',
    layout: [
      [
        ['Q', 'q', 'iu'],
        ['W', 'w', 'ia'],
        ['E', 'e', 'e'],
        ['R', 'r', 'er'],
        ['T', 't', 'üe'],
        ['Y', 'y', 'uai'],
        ['U', 'zh', 'u'],
        ['I', 'ch', 'i'],
        ['O', 'o', 'uo'],
        ['P', 'p', 'un'],
      ],
      [
        ['A', 'a', 'a'],
        ['S', 's', 'ong'],
        ['D', 'd', 'iang'],
        ['F', 'f', 'en'],
        ['G', 'g', 'eng'],
        ['H', 'h', 'ang'],
        ['J', 'j', 'an'],
        ['K', 'k', 'ao'],
        ['L', 'l', 'ai'],
        [';', ';', 'ing'],
      ],
      [
        ['Z', 'z', 'ei'],
        ['X', 'x', 'ie'],
        ['C', 'c', 'iao'],
        ['V', 'sh', 'ui'],
        ['B', 'b', 'ou'],
        ['N', 'n', 'in'],
        ['M', 'm', 'ian'],
      ],
    ],
    encode: toSogou,
  },
  quanpin: {
    id: 'quanpin',
    label: '全拼',
    layout: QUANPIN_LAYOUT,
    encode: toQuanpin,
  },
}

const ZERO_TWO = new Set(['ai', 'an', 'ao', 'ei', 'en', 'er', 'ou'])

const ZIRANMA_INIT = {
  b: 'b',
  p: 'p',
  m: 'm',
  f: 'f',
  d: 'd',
  t: 't',
  n: 'n',
  l: 'l',
  g: 'g',
  k: 'k',
  h: 'h',
  j: 'j',
  q: 'q',
  x: 'x',
  zh: 'v',
  ch: 'i',
  sh: 'u',
  r: 'r',
  z: 'z',
  c: 'c',
  s: 's',
  y: 'y',
  w: 'w',
}

const ZIRANMA_FINAL = {
  a: 'a',
  o: 'o',
  e: 'e',
  i: 'i',
  u: 'u',
  v: 'v',
  ai: 'l',
  ei: 'z',
  ui: 'v',
  ao: 'k',
  ou: 'b',
  iu: 'q',
  ie: 'x',
  ue: 't',
  ve: 't',
  an: 'j',
  en: 'f',
  in: 'n',
  un: 'p',
  vn: 'p',
  ang: 'h',
  eng: 'g',
  ing: ';',
  ong: 's',
  iong: 's',
  ian: 'm',
  iang: 'd',
  iao: 'c',
  uan: 'r',
  uang: 'd',
  uai: 'y',
  uo: 'o',
  ua: 'w',
  ia: 'w',
}

const SOGOU_INIT = {
  b: 'b',
  p: 'p',
  m: 'm',
  f: 'f',
  d: 'd',
  t: 't',
  n: 'n',
  l: 'l',
  g: 'g',
  k: 'k',
  h: 'h',
  j: 'j',
  q: 'q',
  x: 'x',
  zh: 'u',
  ch: 'i',
  sh: 'v',
  r: 'r',
  z: 'z',
  c: 'c',
  s: 's',
  y: 'y',
  w: 'w',
}

const SOGOU_FINAL = {
  a: 'a',
  o: 'o',
  e: 'e',
  i: 'i',
  u: 'u',
  v: 'y',
  ai: 'l',
  ei: 'z',
  ui: 'v',
  ao: 'k',
  ou: 'b',
  iu: 'q',
  ie: 'x',
  ue: 't',
  ve: 't',
  an: 'j',
  en: 'f',
  in: 'n',
  un: 'p',
  vn: 'p',
  ang: 'h',
  eng: 'g',
  ing: ';',
  ong: 's',
  iong: 's',
  ian: 'm',
  iang: 'd',
  iao: 'c',
  uan: 'r',
  uang: 'd',
  uai: 'y',
  uo: 'o',
  ua: 'w',
  ia: 'w',
}

function normalizeFinal(initial, final) {
  let f = final
  if ((initial === 'y' || 'jqx'.includes(initial)) && f.startsWith('u')) {
    if (f === 'u') f = 'v'
  }
  if (initial === 'y' && f === 'e') f = 'ie'
  return f
}

function encodeWithMaps(pinyin, initMap, finalMap, opts = {}) {
  const py = normalizePinyin(pinyin)
  if (!py) return ''
  if (py === 'er') {
    if (opts.erCode) return opts.erCode
    return 'er'
  }

  let { initial, final } = splitSyllable(py)

  if (!initial) {
    if (py.length === 1) return py + py
    if (ZERO_TWO.has(py)) return py
    // Three-letter zero-initial: first letter + final key
    const fKey = finalMap[py]
    if (fKey) return py[0] + fKey
    return py.slice(0, 2)
  }

  final = normalizeFinal(initial, final)
  const initKey = initMap[initial] || initial[0]
  let finalKey = finalMap[final]
  if (!finalKey && final) {
    finalKey = finalMap[final.replace(/^u/, 'v')] || finalMap[final.replace(/^v/, 'u')]
  }
  if (!finalKey) return initKey + (final[0] || initKey)
  return initKey + finalKey
}

export function toZiranma(pinyin) {
  return encodeWithMaps(pinyin, ZIRANMA_INIT, ZIRANMA_FINAL)
}

export function toSogou(pinyin) {
  // Sogou: er → er (r as second? often "er" as ee or er — use er)
  return encodeWithMaps(pinyin, SOGOU_INIT, SOGOU_FINAL, { erCode: 'er' })
}

/**
 * @param {string} schemeId
 * @param {string} pinyin
 */
export function encode(schemeId, pinyin) {
  const scheme = SCHEMES[schemeId] || SCHEMES.xiaohe
  return scheme.encode(pinyin)
}

/**
 * All accepted key sequences for a syllable.
 * @param {string} schemeId
 * @param {string} pinyin
 * @returns {string[]}
 */
export function encodeOptions(schemeId, pinyin) {
  if (schemeId === 'quanpin') return quanpinOptions(pinyin)
  const code = encode(schemeId, pinyin)
  return withUvCodeAliases(pinyin, code)
}

/**
 * @param {string} schemeId
 */
export function getLayout(schemeId) {
  return (SCHEMES[schemeId] || SCHEMES.xiaohe).layout
}

/**
 * @param {string} schemeId
 */
export function getSchemeLabel(schemeId) {
  return (SCHEMES[schemeId] || SCHEMES.xiaohe).label
}

/** True when the scheme expects full pinyin (variable length), not 2-key 双拼. */
export function isQuanpinScheme(schemeId) {
  return schemeId === 'quanpin'
}

export function selfTestScheme(schemeId) {
  if (schemeId === 'xiaohe') return xiaoheSelfTest()
  if (schemeId === 'quanpin') {
    const samples = ['zhong', 'guo', 'a', 'ai', 'yu', 'shi', 'nü', 'lü']
    return samples.map((py) => {
      const got = toQuanpin(py)
      const expect = normalizePinyin(py)
      return { py, expect, got, ok: got === expect && got.length >= 1 }
    })
  }
  // Spot-check shared syllables for other schemes
  const encodeFn = SCHEMES[schemeId]?.encode
  if (!encodeFn) return []
  const samples = ['zhong', 'guo', 'a', 'ai', 'yu', 'shi']
  return samples.map((py) => {
    const got = encodeFn(py)
    return { py, expect: got, got, ok: got.length === 2 }
  })
}
