import { pinyin, customPinyin } from 'pinyin-pro'
import { isHanzi, makePassage } from './data.js'

/**
 * Context-sensitive polyphone overrides (查阅汉典 https://zdic.net/ ).
 * Full-phrase pinyin-pro already handles most cases (传记/传说、了解/去了);
 * these cover common misses.
 */
customPinyin({
  // 还 huán vs hái — 汉典：归还义读 huán
  还给: 'huan gei',
  还书: 'huan shu',
  还钱: 'huan qian',
  还债: 'huan zhai',
  还贷: 'huan dai',
  还款: 'huan kuan',
  还原: 'huan yuan',
  还击: 'huan ji',
  还价: 'huan jia',
  还手: 'huan shou',
  还礼: 'huan li',
  还愿: 'huan yuan',
  归还: 'gui huan',
  偿还: 'chang huan',
  交还: 'jiao huan',
  退还: 'tui huan',
  奉还: 'feng huan',
  讨还: 'tao huan',
  索还: 'suo huan',
  璧还: 'bi huan',
  返还: 'fan huan',
  清还: 'qing huan',
  // 传 chuán vs zhuàn — 汉典：传记/经传读 zhuàn；传递/传说读 chuán（库已覆盖，加固）
  传记: 'zhuan ji',
  自传: 'zi zhuan',
  列传: 'lie zhuan',
  评传: 'ping zhuan',
  外传: 'wai zhuan',
  正传: 'zheng zhuan',
  小传: 'xiao zhuan',
  别传: 'bie zhuan',
  经传: 'jing zhuan',
  传略: 'zhuan lue',
  左传: 'zuo zhuan',
  水滸传: 'shui hu zhuan',
  水浒传: 'shui hu zhuan',
  // 行 xíng vs háng / hàng
  银行: 'yin hang',
  行业: 'hang ye',
  行列: 'hang lie',
  行当: 'hang dang',
  行情: 'hang qing',
  行家: 'hang jia',
  内行: 'nei hang',
  外行: 'wai hang',
  排行: 'pai hang',
  同行: 'tong hang',
  // 乐 lè vs yuè
  音乐: 'yin yue',
  乐器: 'yue qi',
  乐曲: 'yue qu',
  乐章: 'yue zhang',
  乐队: 'yue dui',
  声乐: 'sheng yue',
  器乐: 'qi yue',
  奏乐: 'zou yue',
  民乐: 'min yue',
  // 长 cháng vs zhǎng
  长大: 'zhang da',
  长相: 'zhang xiang',
  长辈: 'zhang bei',
  家长: 'jia zhang',
  成长: 'cheng zhang',
  生长: 'sheng zhang',
  酋长: 'qiu zhang',
  队长: 'dui zhang',
  校长: 'xiao zhang',
  局长: 'ju zhang',
  // 重 zhòng vs chóng
  重复: 'chong fu',
  重新: 'chong xin',
  重叠: 'chong die',
  重申: 'chong shen',
  重阳: 'chong yang',
  重逢: 'chong feng',
  // 着 zhe / zhuó / zháo / zhāo
  着急: 'zhao ji',
  着凉: 'zhao liang',
  着火: 'zhao huo',
  睡着: 'shui zhao',
  着落: 'zhuo luo',
  着力: 'zhuo li',
  着想: 'zhuo xiang',
  着手: 'zhuo shou',
  衣着: 'yi zhuo',
  沉着: 'chen zhuo',
  // 得 dé / de / děi
  得亏: 'dei kui',
  总得: 'zong dei',
  必得: 'bi dei',
  // 空 kōng vs kòng
  空白: 'kong bai',
  空闲: 'kong xian',
  空缺: 'kong que',
  空隙: 'kong xi',
  // 调 tiáo vs diào
  调查: 'diao cha',
  调动: 'diao dong',
  调度: 'diao du',
  曲调: 'qu diao',
  腔调: 'qiang diao',
  论调: 'lun diao',
  // 省 shěng vs xǐng
  反省: 'fan xing',
  省悟: 'xing wu',
  省亲: 'xing qin',
  // 差 chā / chà / chāi / cī
  差不多: 'cha bu duo',
  差劲: 'cha jing',
  出差: 'chu chai',
  差使: 'chai shi',
  差事: 'chai shi',
  参差: 'cen ci',
})

/**
 * Normalize one syllable for scheme encoding (ü → v, lowercase).
 * @param {string} py
 */
function normalizeSyllable(py) {
  return String(py || '')
    .toLowerCase()
    .replace(/ü/g, 'v')
    .replace(/[^a-z]/g, '')
}

/**
 * Contextual pinyin for every字符 in text (punctuation kept in alignment array).
 * Prefer whole-string conversion so 多音字 follow phrase context (汉典 sense).
 * @param {string} text
 * @returns {string[]} tone-less syllables aligned 1:1 with [...text]
 */
export function contextualPinyinArray(text) {
  const chars = [...text]
  if (!chars.length) return []

  /** @type {string[]} */
  let raw = []
  try {
    raw = pinyin(text, {
      toneType: 'none',
      type: 'array',
      v: true,
      nonZh: 'consecutive',
    })
  } catch {
    raw = []
  }

  // Length mismatch → fall back to shorter phrase windows (keeps most context)
  if (raw.length !== chars.length) {
    raw = []
    const windowSize = 80
    for (let i = 0; i < chars.length; i += windowSize) {
      const slice = chars.slice(i, i + windowSize).join('')
      const part = pinyin(slice, {
        toneType: 'none',
        type: 'array',
        v: true,
        nonZh: 'consecutive',
      })
      if (part.length === [...slice].length) {
        raw.push(...part)
      } else {
        for (const ch of slice) {
          raw.push(
            isHanzi(ch)
              ? pinyin(ch, { toneType: 'none', type: 'string', v: true })
              : ch,
          )
        }
      }
    }
  }

  return chars.map((ch, i) => {
    if (!isHanzi(ch)) return String(raw[i] ?? ch)
    const syl = normalizeSyllable(raw[i])
    if (syl) return syl
    return normalizeSyllable(pinyin(ch, { toneType: 'none', type: 'string', v: true })) || 'a'
  })
}

/**
 * Convert Chinese text into a passage with context-aware pinyin.
 * @param {string} title
 * @param {string} text
 */
export function passageFromText(title, text) {
  const cleaned = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim()
  if (!cleaned) throw new Error('文本为空')

  const chars = [...cleaned]
  const aligned = contextualPinyinArray(cleaned)
  const syllables = []
  for (let i = 0; i < chars.length; i++) {
    if (!isHanzi(chars[i])) continue
    syllables.push(aligned[i] || 'a')
  }
  if (!syllables.length) throw new Error('未识别到汉字')
  return makePassage(title || '未命名', cleaned, syllables)
}

export function countHanzi(text) {
  let n = 0
  for (const ch of text) if (isHanzi(ch)) n += 1
  return n
}

/**
 * Grow/trim a Chinese typing passage to [minChars, maxChars] hanzi.
 * @param {{ title: string, text: string, pinyin?: (string|null)[] }} passage
 * @param {number} minChars
 * @param {number} maxChars
 * @param {{ title: string, text: string, pinyin?: (string|null)[] }[]} [extraPassages]
 */
export function fitChinesePassage(passage, minChars, maxChars, extraPassages = []) {
  let min = Math.max(1, Math.floor(Number(minChars) || 1))
  let max = Math.max(1, Math.floor(Number(maxChars) || min))
  if (min > max) min = max

  const pool = [passage, ...extraPassages].filter((p) => p?.text && countHanzi(p.text) > 0)
  if (!pool.length) {
    return passage || { title: '文章', text: '', pinyin: [] }
  }

  let text = String(passage?.text || '')
  const extrasFirst = pool.filter((p) => p !== passage)
  const cycle = extrasFirst.length ? [...extrasFirst, passage] : pool
  let guard = 0
  let idx = 0
  while (countHanzi(text) < min && guard < 40) {
    const next = cycle[idx % cycle.length]
    idx += 1
    guard += 1
    const chunk = String(next?.text || '').trim()
    if (!chunk) continue
    text = text ? `${text}${/[。！？\n]$/.test(text) ? '' : '。'}${chunk}` : chunk
  }

  if (countHanzi(text) > max) {
    let count = 0
    let acc = ''
    for (const ch of text) {
      if (isHanzi(ch) && count >= max) break
      acc += ch
      if (isHanzi(ch)) count += 1
    }
    text = acc
  }

  try {
    return passageFromText(passage?.title || '文章', text)
  } catch {
    return { title: passage?.title || '文章', text, pinyin: [] }
  }
}

/**
 * Split units into pages by hanzi count.
 * @param {{ index: number }[]} units
 * @param {number} charsPerPage
 * @returns {{ start: number, end: number }[]} unit index ranges [start, end)
 */
export function buildPages(units, charsPerPage = 80) {
  const size = Math.max(20, Math.min(300, Number(charsPerPage) || 80))
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
