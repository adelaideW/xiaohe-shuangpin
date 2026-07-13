/**
 * Japanese furigana (hiragana over kanji) via Kuroshiro + Kuromoji.
 * Dict served from public/kuromoji/dict.
 *
 * Kuroshiro okurigana mode emits 漢字(よみ) with parentheses (not brackets).
 */

let readyPromise = null
let kuroshiro = null

const KANJI_RE = /[\u4E00-\u9FFF々〆ヵヶ]/
const HIRA_RE = /^[\u3040-\u309Fー]+$/
/** Open/close for readings: [よみ] or (よみ) or （よみ） */
const READ_OPEN = '[\\[(（]'
const READ_CLOSE = '[\\])）]'

function dictPath() {
  const base =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : '/'
  return `${String(base).replace(/\/?$/, '/') }kuromoji/dict`
}

export async function getKuroshiro() {
  if (kuroshiro) return kuroshiro
  if (!readyPromise) {
    readyPromise = (async () => {
      const KuroshiroMod = await import('kuroshiro')
      const AnalyzerMod = await import('kuroshiro-analyzer-kuromoji')
      const Kuroshiro = KuroshiroMod.default?.default || KuroshiroMod.default || KuroshiroMod
      const KuromojiAnalyzer =
        AnalyzerMod.default?.default || AnalyzerMod.default || AnalyzerMod
      const instance = new Kuroshiro()
      await instance.init(
        new KuromojiAnalyzer({
          dictPath: dictPath(),
        }),
      )
      kuroshiro = instance
      return instance
    })().catch((err) => {
      readyPromise = null
      throw err
    })
  }
  return readyPromise
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function hasKanji(s) {
  return KANJI_RE.test(String(s || ''))
}

function toHira(s) {
  return String(s || '').replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  )
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isReadOpen(ch) {
  return ch === '[' || ch === '(' || ch === '（'
}

function matchingClose(open) {
  if (open === '[') return ']'
  if (open === '（') return '）'
  return ')'
}

/**
 * Kuroshiro okurigana → ruby HTML. Supports 漢字[よみ] and 漢字(よみ).
 * @param {string} okurigana
 */
function okuriganaToRubyHtml(okurigana) {
  const raw = String(okurigana || '')
  if (!raw) return ''
  let out = ''
  let i = 0
  while (i < raw.length) {
    let openAt = -1
    let openCh = ''
    for (let j = i; j < raw.length; j++) {
      if (isReadOpen(raw[j])) {
        openAt = j
        openCh = raw[j]
        break
      }
    }
    if (openAt < 0) {
      out += escapeHtml(raw.slice(i))
      break
    }
    let start = openAt
    while (start > i && KANJI_RE.test(raw[start - 1])) start -= 1
    out += escapeHtml(raw.slice(i, start))
    const closeCh = matchingClose(openCh)
    const close = raw.indexOf(closeCh, openAt + 1)
    if (close < 0) {
      out += escapeHtml(raw.slice(start))
      break
    }
    const kanji = raw.slice(start, openAt)
    const reading = raw.slice(openAt + 1, close)
    if (kanji && reading) {
      out += `<ruby>${escapeHtml(kanji)}<rt>${escapeHtml(toHira(reading))}</rt></ruby>`
    } else {
      out += escapeHtml(raw.slice(start, close + 1))
    }
    i = close + 1
  }
  return out
}

/**
 * Extract reading for a leading kanji run from okurigana markup.
 * Supports 激怒[げきど] / 激怒(げきど) / 必(かなら)ず
 * @param {string} surface
 * @param {string} okurigana
 */
export function readingForSurface(surface, okurigana) {
  const surf = String(surface || '')
  const ok = String(okurigana || '')
  if (!surf || !ok) return ''

  const exact = ok.match(
    new RegExp(`^${escapeRegExp(surf)}${READ_OPEN}([^\\]\\)）]+)${READ_CLOSE}`),
  )
  if (exact?.[1]) return toHira(exact[1])

  let si = 0
  let oi = 0
  let reading = ''
  while (si < surf.length && oi < ok.length) {
    if (isReadOpen(ok[oi])) {
      const closeCh = matchingClose(ok[oi])
      const close = ok.indexOf(closeCh, oi + 1)
      if (close < 0) return ''
      reading += ok.slice(oi + 1, close)
      oi = close + 1
      continue
    }
    if (ok[oi] === surf[si]) {
      oi += 1
      si += 1
      continue
    }
    return ''
  }
  if (si === surf.length && isReadOpen(ok[oi])) {
    const closeCh = matchingClose(ok[oi])
    const close = ok.indexOf(closeCh, oi + 1)
    if (close > oi) reading += ok.slice(oi + 1, close)
  }
  return reading ? toHira(reading) : ''
}

/**
 * Advance past surface in okurigana string (skips reading annotations).
 * @param {string} ok
 * @param {number} oi
 * @param {string} surf
 */
function advancePastSurface(ok, oi, surf) {
  const before = oi
  let si = 0
  while (si < surf.length && oi < ok.length) {
    if (isReadOpen(ok[oi])) {
      const closeCh = matchingClose(ok[oi])
      const close = ok.indexOf(closeCh, oi + 1)
      oi = close < 0 ? ok.length : close + 1
      continue
    }
    if (ok[oi] === surf[si]) {
      oi += 1
      si += 1
      continue
    }
    break
  }
  if (si >= surf.length && isReadOpen(ok[oi])) {
    const closeCh = matchingClose(ok[oi])
    const close = ok.indexOf(closeCh, oi + 1)
    if (close > oi) oi = close + 1
  }
  if (si < surf.length) return before + [...surf].length
  return oi
}

/**
 * Fill kana on kanji segments missing a reading. Generated readings are for
 * typing; mark kanaFromSource: false so UI can hide ruby.
 * @param {{ surface: string, kana: string | null, kanaFromSource?: boolean }[]} segments
 */
export async function enrichSegmentsWithReadings(segments) {
  const list = (segments || []).map((s) => ({
    surface: s.surface,
    kana: s.kana == null ? null : s.kana,
    kanaFromSource: Boolean(s.kanaFromSource),
  }))
  if (!list.some((s) => !s.kana && hasKanji(s.surface))) return list

  try {
    const k = await getKuroshiro()
    const text = list.map((s) => s.surface).join('')
    let ok = ''
    try {
      ok = await k.convert(text, { mode: 'okurigana', to: 'hiragana' })
    } catch {
      ok = ''
    }

    let oi = 0
    for (let i = 0; i < list.length; i++) {
      const seg = list[i]
      const surf = seg.surface || ''
      if (!surf) continue

      if (!seg.kana && hasKanji(surf)) {
        let reading = ok ? readingForSurface(surf, ok.slice(oi)) : ''
        if (!reading) {
          let context = surf
          let j = i + 1
          let budget = 0
          while (j < list.length && HIRA_RE.test(list[j].surface) && budget < 6) {
            context += list[j].surface
            budget += [...list[j].surface].length
            j += 1
          }
          try {
            const localOk = await k.convert(context, { mode: 'okurigana', to: 'hiragana' })
            reading = readingForSurface(surf, localOk)
            if (!reading) {
              const normal = toHira(await k.convert(context, { mode: 'normal', to: 'hiragana' }))
              // If we appended okurigana, trim trailing hiragana that matches context tail
              if (context.length > surf.length && normal.endsWith(toHira(context.slice(surf.length)))) {
                reading = normal.slice(0, normal.length - toHira(context.slice(surf.length)).length)
              } else {
                reading = toHira(await k.convert(surf, { mode: 'normal', to: 'hiragana' }))
              }
            }
          } catch {
            try {
              reading = toHira(await k.convert(surf, { mode: 'normal', to: 'hiragana' }))
            } catch {
              reading = ''
            }
          }
        }
        if (reading && reading !== surf && !hasKanji(reading)) {
          list[i].kana = reading
          list[i].kanaFromSource = false
        }
      }

      if (ok) oi = advancePastSurface(ok, oi, surf)
    }
    return list
  } catch (err) {
    console.warn('Reading enrichment failed', err)
    return list
  }
}

/**
 * @param {{ title?: string, segments: { surface: string, kana: string | null, kanaFromSource?: boolean }[], _readingsEnriched?: boolean }} passage
 */
export async function enrichPassageWithReadings(passage) {
  if (!passage) return passage
  const segments = passage.segments || []
  const needs = segments.some((s) => !s.kana && hasKanji(s.surface))
  if (!needs) {
    return { ...passage, _readingsEnriched: true }
  }
  // Re-run even if previously marked enriched but readings still missing
  const next = await enrichSegmentsWithReadings(segments)
  return { ...passage, segments: next, _readingsEnriched: true }
}

/**
 * Convert Japanese text to HTML with <ruby> furigana.
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function toFuriganaHtml(text) {
  const raw = String(text || '')
  if (!raw.trim()) return ''
  try {
    const k = await getKuroshiro()
    const furigana = await k.convert(raw, { mode: 'furigana', to: 'hiragana' })
    if (furigana && /<ruby[\s>]/i.test(furigana)) return furigana

    const okurigana = await k.convert(raw, { mode: 'okurigana', to: 'hiragana' })
    if (okurigana && /[\[(（]/.test(okurigana)) {
      return okuriganaToRubyHtml(okurigana)
    }

    // Last resort: wrap each kanji run from normal convert is hard; return escaped
    return escapeHtml(raw)
  } catch (err) {
    console.warn('Furigana convert failed', err)
    return escapeHtml(raw)
  }
}
