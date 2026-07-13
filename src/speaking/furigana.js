/**
 * Japanese furigana (hiragana over kanji) via Kuroshiro + Kuromoji.
 * Dict served from public/kuromoji/dict.
 *
 * Also fills missing readings on typing segments when the source
 * (e.g. Aozora) omitted 漢字（よみ） annotations.
 */

let readyPromise = null
let kuroshiro = null

const KANJI_RE = /[\u4E00-\u9FFF々〆ヵヶ]/
const HIRA_RE = /^[\u3040-\u309Fー]+$/

function dictPath() {
  const base =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : '/'
  return `${String(base).replace(/\/?$/, '/') }kuromoji/dict`
}

async function getKuroshiro() {
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

/**
 * Kuroshiro okurigana form: 漢字[かんじ] → ruby HTML
 * @param {string} okurigana
 */
function okuriganaToRubyHtml(okurigana) {
  const raw = String(okurigana || '')
  if (!raw) return ''
  let out = ''
  let i = 0
  while (i < raw.length) {
    const open = raw.indexOf('[', i)
    if (open < 0) {
      out += escapeHtml(raw.slice(i))
      break
    }
    let start = open
    while (start > i && KANJI_RE.test(raw[start - 1])) start -= 1
    out += escapeHtml(raw.slice(i, start))
    const close = raw.indexOf(']', open + 1)
    if (close < 0) {
      out += escapeHtml(raw.slice(start))
      break
    }
    const kanji = raw.slice(start, open)
    const reading = raw.slice(open + 1, close)
    if (kanji && reading) {
      out += `<ruby>${escapeHtml(kanji)}<rt>${escapeHtml(reading)}</rt></ruby>`
    } else {
      out += escapeHtml(raw.slice(start, close + 1))
    }
    i = close + 1
  }
  return out
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Extract reading for a leading kanji run from okurigana markup.
 * e.g. surface "激怒", ok "激怒[げきど]した" → "げきど"
 * e.g. surface "必", ok "必[かなら]ず" → "かなら"
 * @param {string} surface
 * @param {string} okurigana
 */
function readingForSurface(surface, okurigana) {
  const surf = String(surface || '')
  const ok = String(okurigana || '')
  if (!surf || !ok) return ''

  const exact = ok.match(new RegExp(`^${escapeRegExp(surf)}\\[([^\\]]+)\\]`))
  if (exact?.[1]) return toHira(exact[1])

  let si = 0
  let oi = 0
  let reading = ''
  while (si < surf.length && oi < ok.length) {
    if (ok[oi] === '[') {
      const close = ok.indexOf(']', oi + 1)
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
  if (si === surf.length && ok[oi] === '[') {
    const close = ok.indexOf(']', oi + 1)
    if (close > oi) reading += ok.slice(oi + 1, close)
  }
  return reading ? toHira(reading) : ''
}

/**
 * Fill kana on segments that have kanji but no source reading.
 * One Kuroshiro pass over the full passage (with morphological context).
 * @param {{ surface: string, kana: string | null }[]} segments
 * @returns {Promise<{ surface: string, kana: string | null }[]>}
 */
export async function enrichSegmentsWithReadings(segments) {
  const list = (segments || []).map((s) => ({
    surface: s.surface,
    kana: s.kana == null ? null : s.kana,
  }))
  if (!list.some((s) => !s.kana && hasKanji(s.surface))) return list

  try {
    const k = await getKuroshiro()
    const text = list.map((s) => s.surface).join('')
    const ok = await k.convert(text, { mode: 'okurigana', to: 'hiragana' })

    let oi = 0
    for (let i = 0; i < list.length; i++) {
      const seg = list[i]
      const surf = seg.surface || ''
      if (!surf) continue

      if (!seg.kana && hasKanji(surf)) {
        const sliced = ok.slice(oi)
        let reading = readingForSurface(surf, sliced)
        if (!reading) {
          // Peek following hiragana for okurigana verbs (必ず, 除く…)
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
              reading = toHira(await k.convert(surf, { mode: 'normal', to: 'hiragana' }))
            }
          } catch {
            /* ignore */
          }
        }
        if (reading && reading !== surf && !hasKanji(reading)) {
          list[i].kana = reading
        }
      }

      // Advance cursor through okurigana aligned to this surface
      const before = oi
      let si = 0
      while (si < surf.length && oi < ok.length) {
        if (ok[oi] === '[') {
          const close = ok.indexOf(']', oi + 1)
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
      if (si >= surf.length && ok[oi] === '[') {
        const close = ok.indexOf(']', oi + 1)
        if (close > oi) oi = close + 1
      }
      // If alignment failed, don't wedge — leave oi and fall back to local only next time
      if (si < surf.length) oi = before + surf.length
    }
    return list
  } catch (err) {
    console.warn('Reading enrichment failed', err)
    return list
  }
}

/**
 * @param {{ title?: string, segments: { surface: string, kana: string | null }[], _readingsEnriched?: boolean }} passage
 */
export async function enrichPassageWithReadings(passage) {
  if (!passage) return passage
  if (passage._readingsEnriched) return passage
  const segments = passage.segments || []
  if (!segments.some((s) => !s.kana && hasKanji(s.surface))) {
    return { ...passage, _readingsEnriched: true }
  }
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
    if (okurigana && okurigana.includes('[')) {
      return okuriganaToRubyHtml(okurigana)
    }
    return escapeHtml(raw)
  } catch (err) {
    console.warn('Furigana convert failed', err)
    return escapeHtml(raw)
  }
}
