/**
 * Japanese furigana (hiragana over kanji) via Kuroshiro + Kuromoji.
 * Dict served from /kuromoji/dict.
 */

let readyPromise = null
let kuroshiro = null

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
          dictPath: '/kuromoji/dict',
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
    return await k.convert(raw, { mode: 'furigana', to: 'hiragana' })
  } catch (err) {
    console.warn('Furigana convert failed', err)
    return ''
  }
}
