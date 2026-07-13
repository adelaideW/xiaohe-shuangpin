/**
 * Japanese furigana (hiragana over kanji) via Kuromoji.
 * Dict served from /kuromoji/dict (copied under public/).
 */

import { toHiragana } from 'wanakana'

let tokenizerPromise = null

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * @returns {Promise<import('kuromoji').Tokenizer>}
 */
async function getTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = (async () => {
      const kuromojiMod = await import('kuromoji')
      const kuromoji = kuromojiMod.default || kuromojiMod
      const dictPaths = ['/kuromoji/dict', '/kuromoji/dict/', './kuromoji/dict']
      let lastErr = null
      for (const dictPath of dictPaths) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const tokenizer = await new Promise((resolve, reject) => {
            kuromoji.builder({ dicPath: dictPath }).build((err, tokenizer) => {
              if (err) reject(err)
              else resolve(tokenizer)
            })
          })
          return tokenizer
        } catch (err) {
          lastErr = err
        }
      }
      throw lastErr || new Error('Kuromoji dict failed to load')
    })().catch((err) => {
      tokenizerPromise = null
      throw err
    })
  }
  return tokenizerPromise
}

/**
 * Build <ruby> HTML for kanji tokens; leave kana/punct as-is.
 * @param {string} text
 */
function tokensToFuriganaHtml(tokens) {
  return tokens
    .map((t) => {
      const surface = t.surface_form || ''
      if (!surface) return ''
      const reading = t.reading && t.reading !== '*' ? t.reading : ''
      const hasKanji = /[\u4E00-\u9FFF々〆ヵヶ]/.test(surface)
      if (hasKanji && reading) {
        let hira = reading
        try {
          hira = toHiragana(reading)
        } catch {
          /* keep katakana reading */
        }
        if (hira && hira !== surface) {
          return `<ruby>${escapeHtml(surface)}<rt>${escapeHtml(hira)}</rt></ruby>`
        }
      }
      return escapeHtml(surface)
    })
    .join('')
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
    const tokenizer = await getTokenizer()
    const tokens = tokenizer.tokenize(raw)
    const html = tokensToFuriganaHtml(tokens)
    if (html.includes('<ruby>')) return html
    // Fallback: try Kuroshiro if token path produced no ruby
    try {
      const KuroshiroMod = await import('kuroshiro')
      const AnalyzerMod = await import('kuroshiro-analyzer-kuromoji')
      const Kuroshiro = KuroshiroMod.default?.default || KuroshiroMod.default || KuroshiroMod
      const KuromojiAnalyzer =
        AnalyzerMod.default?.default || AnalyzerMod.default || AnalyzerMod
      const instance = new Kuroshiro()
      await instance.init(new KuromojiAnalyzer({ dictPath: '/kuromoji/dict' }))
      const converted = await instance.convert(raw, { mode: 'furigana', to: 'hiragana' })
      if (converted && String(converted).includes('<ruby>')) return String(converted)
    } catch {
      /* ignore */
    }
    return html || escapeHtml(raw)
  } catch (err) {
    console.warn('Furigana convert failed', err)
    return escapeHtml(raw)
  }
}
