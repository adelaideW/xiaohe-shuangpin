/**
 * Vercel serverless: ElevenLabs text-to-speech proxy.
 * Keeps ELEVENLABS_API_KEY server-side. Client posts { text, language, rate }.
 */

/** @typedef {'en' | 'ja' | 'zh'} SpeakLang */

const MODEL = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'

/** Stock multilingual-friendly defaults (override with ELEVENLABS_VOICE_*). */
const DEFAULT_VOICES = {
  en: process.env.ELEVENLABS_VOICE_EN || '21m00Tcm4TlvDq8ikWAM', // Rachel
  ja: process.env.ELEVENLABS_VOICE_JA || 'EXAVITQu4vr4xnSDxMaL', // Sarah
  zh: process.env.ELEVENLABS_VOICE_ZH || 'EXAVITQu4vr4xnSDxMaL', // Sarah (multilingual)
}

/**
 * @param {SpeakLang | string} language
 */
export function voiceForLanguage(language) {
  if (language === 'ja') return DEFAULT_VOICES.ja
  if (language === 'zh') return DEFAULT_VOICES.zh
  return DEFAULT_VOICES.en
}

/**
 * @param {{ text: string, language?: string, rate?: number }} body
 * @param {string} apiKey
 */
export async function synthesizeElevenLabs(body, apiKey) {
  const text = String(body?.text || '').trim()
  if (!text) {
    const err = new Error('Missing text')
    err.status = 400
    throw err
  }
  const language = body.language === 'ja' || body.language === 'zh' ? body.language : 'en'
  const voiceId = voiceForLanguage(language)
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: text.slice(0, 4500),
      model_id: MODEL,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.2,
        use_speaker_boost: true,
      },
    }),
  })

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    const err = new Error(detail || `ElevenLabs HTTP ${upstream.status}`)
    err.status = upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502
    throw err
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())
  return buffer
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'ELEVENLABS_API_KEY is not configured' })
    return
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const audio = await synthesizeElevenLabs(body, apiKey)
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).send(audio)
  } catch (err) {
    const status = err?.status || 500
    res.status(status).json({ error: err?.message || 'TTS failed' })
  }
}
