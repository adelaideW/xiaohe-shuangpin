/**
 * Xiaohe (小鹤) Shuangpin encoder.
 * Converts a tone-less pinyin syllable into a 2-key code.
 */

const INITIAL_KEYS = {
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

const FINAL_KEYS = {
  a: 'a',
  o: 'o',
  e: 'e',
  i: 'i',
  u: 'u',
  v: 'v',
  ai: 'd',
  ei: 'w',
  ui: 'v',
  ao: 'c',
  ou: 'z',
  iu: 'q',
  ie: 'p',
  ue: 't',
  ve: 't',
  an: 'j',
  en: 'f',
  in: 'b',
  un: 'y',
  vn: 'y',
  ang: 'h',
  eng: 'g',
  ing: 'k',
  ong: 's',
  ian: 'm',
  iang: 'l',
  iao: 'n',
  iong: 's',
  uan: 'r',
  uang: 'l',
  uai: 'k',
  uo: 'o',
  ua: 'x',
  ia: 'x',
}

/** Keyboard legend: [display, initialLabel, finalLabel] */
export const KEYBOARD_LAYOUT = [
  [
    ['Q', 'q', 'iu'],
    ['W', 'w', 'ei'],
    ['E', 'e', 'e'],
    ['R', 'r', 'uan'],
    ['T', 't', 'üe'],
    ['Y', 'y', 'un'],
    ['U', 'sh', 'u'],
    ['I', 'ch', 'i'],
    ['O', 'o', 'uo'],
    ['P', 'p', 'ie'],
  ],
  [
    ['A', 'a', 'a'],
    ['S', 's', 'ong'],
    ['D', 'd', 'ai'],
    ['F', 'f', 'en'],
    ['G', 'g', 'eng'],
    ['H', 'h', 'ang'],
    ['J', 'j', 'an'],
    ['K', 'k', 'ing'],
    ['L', 'l', 'iang'],
    [';', ';', ';'],
  ],
  [
    ['Z', 'z', 'ou'],
    ['X', 'x', 'ia'],
    ['C', 'c', 'ao'],
    ['V', 'zh', 'ui'],
    ['B', 'b', 'in'],
    ['N', 'n', 'iao'],
    ['M', 'm', 'ian'],
  ],
]

const ZERO_TWO = new Set(['ai', 'an', 'ao', 'ei', 'en', 'er', 'ou'])

const TONE_MAP = {
  ā: 'a',
  á: 'a',
  ǎ: 'a',
  à: 'a',
  ē: 'e',
  é: 'e',
  ě: 'e',
  è: 'e',
  ī: 'i',
  í: 'i',
  ǐ: 'i',
  ì: 'i',
  ō: 'o',
  ó: 'o',
  ǒ: 'o',
  ò: 'o',
  ū: 'u',
  ú: 'u',
  ǔ: 'u',
  ù: 'u',
  ǖ: 'v',
  ǘ: 'v',
  ǚ: 'v',
  ǜ: 'v',
  ü: 'v',
}

export function normalizePinyin(raw) {
  if (!raw) return ''
  let s = String(raw).trim().toLowerCase().replace(/[0-5]$/, '')
  s = [...s].map((ch) => TONE_MAP[ch] ?? ch).join('')
  s = s.replace(/ü/g, 'v')
  return s
}

/**
 * @param {string} py
 * @returns {{ initial: string, final: string }}
 */
export function splitSyllable(py) {
  const s = normalizePinyin(py)
  if (!s) return { initial: '', final: '' }

  if (s.startsWith('zh') || s.startsWith('ch') || s.startsWith('sh')) {
    return { initial: s.slice(0, 2), final: s.slice(2) || '' }
  }

  // Zero-initial syllables begin with a/o/e (no y/w)
  if (/^[aoe]/.test(s)) {
    return { initial: '', final: s }
  }

  const first = s[0]
  if (INITIAL_KEYS[first]) {
    return { initial: first, final: s.slice(1) }
  }

  return { initial: '', final: s }
}

/** j/q/x/y + u… is ü in pinyin spelling */
function normalizeFinal(initial, final) {
  let f = final
  if ((initial === 'y' || 'jqx'.includes(initial)) && f.startsWith('u')) {
    // yu → v, yue → ue, yuan → uan, yun → un
    if (f === 'u') f = 'v'
    else if (f === 'ue') f = 'ue'
    // uan / un stay — same FINAL_KEYS as üan / ün
  }
  if (initial === 'y' && f === '') f = 'i' // y alone shouldn't happen
  // ye keeps final e → ye (E key). Do not remap to ie/p; jie/xie stay on p.
  // yuan etc already fine
  // ju → jv already handled
  // n/l + ü: nv, lv written as nv/lv or nü/lü
  if ((initial === 'n' || initial === 'l') && f.startsWith('v')) {
    // keep v / ve
  }
  return f
}

/**
 * Encode one pinyin syllable to Xiaohe 2-key code.
 * @param {string} pinyin
 * @returns {string}
 */
export function toXiaohe(pinyin) {
  const py = normalizePinyin(pinyin)
  if (!py) return ''
  if (py === 'er') return 'er'

  let { initial, final } = splitSyllable(py)

  if (!initial) {
    if (py.length === 1) return py + py
    if (ZERO_TWO.has(py)) return py
    const fKey = FINAL_KEYS[py]
    if (fKey) return py[0] + fKey
    return py.slice(0, 2)
  }

  final = normalizeFinal(initial, final)
  const initKey = INITIAL_KEYS[initial] || initial[0]
  let finalKey = FINAL_KEYS[final]

  if (!finalKey && final) {
    finalKey = FINAL_KEYS[final.replace(/^u/, 'v')] || FINAL_KEYS[final.replace(/^v/, 'u')]
  }

  if (!finalKey) {
    console.warn('Unknown final', { py, initial, final })
    return initKey + (final[0] || initKey)
  }

  return initKey + finalKey
}

export function keysForCode(code) {
  if (!code || code.length < 2) return { initial: '', final: '' }
  return { initial: code[0], final: code[1] }
}

/** Quick self-check used in console during development */
export function selfTest() {
  const cases = [
    ['zhong', 'vs'],
    ['guo', 'go'],
    ['shuang', 'ul'],
    ['pin', 'pb'],
    ['a', 'aa'],
    ['ai', 'ai'],
    ['ang', 'ah'],
    ['eng', 'eg'],
    ['er', 'er'],
    ['yu', 'yv'],
    ['yue', 'yt'],
    ['yuan', 'yr'],
    ['yun', 'yy'],
    ['ye', 'ye'],
    ['jie', 'jp'],
    ['xie', 'xp'],
    ['ying', 'yk'],
    ['yin', 'yb'],
    ['wu', 'wu'],
    ['wo', 'wo'],
    ['wei', 'ww'],
    ['xiong', 'xs'],
    ['lü', 'lv'],
    ['nü', 'nv'],
    ['jue', 'jt'],
    ['chi', 'ii'],
    ['shi', 'ui'],
    ['zhi', 'vi'],
    ['qiu', 'qq'],
    ['lv', 'lv'],
  ]
  return cases.map(([py, expect]) => {
    const got = toXiaohe(py)
    return { py, expect, got, ok: got === expect }
  })
}
