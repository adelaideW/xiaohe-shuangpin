/**
 * Vercel serverless TTS proxy.
 * Tries ElevenLabs first, then xAI Grok TTS. Keys stay server-side.
 * Client posts { text, language, rate }.
 */

/** @typedef {'en' | 'ja' | 'zh'} SpeakLang */

const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'

/** Stock multilingual-friendly defaults (override with ELEVENLABS_VOICE_*). */
const ELEVEN_VOICES = {
  en: process.env.ELEVENLABS_VOICE_EN || '21m00Tcm4TlvDq8ikWAM', // Rachel
  ja: process.env.ELEVENLABS_VOICE_JA || 'EXAVITQu4vr4xnSDxMaL', // Sarah
  zh: process.env.ELEVENLABS_VOICE_ZH || 'EXAVITQu4vr4xnSDxMaL',
}

const XAI_VOICE = process.env.XAI_VOICE_ID || 'eve'

/**
 * @param {SpeakLang | string} language
 */
function elevenVoice(language) {
  if (language === 'ja') return ELEVEN_VOICES.ja
  if (language === 'zh') return ELEVEN_VOICES.zh
  return ELEVEN_VOICES.en
}

/**
 * @param {SpeakLang | string} language
 */
function xaiLanguage(language) {
  if (language === 'ja') return 'ja'
  if (language === 'zh') return 'zh'
  return 'en'
}

/**
 * @param {{ text: string, language?: string, rate?: number }} body
 */
function normalizeBody(body) {
  const text = String(body?.text || '').trim()
  if (!text) {
    const err = new Error('Missing text')
    err.status = 400
    throw err
  }
  const language = body.language === 'ja' || body.language === 'zh' ? body.language : 'en'
  return { text, language }
}

/**
 * @param {{ text: string, language: string }} body
 * @param {string} apiKey
 */
export async function synthesizeElevenLabs(body, apiKey) {
  const { text, language } = normalizeBody(body)
  const voiceId = elevenVoice(language)
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
      model_id: ELEVEN_MODEL,
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
    err.provider = 'elevenlabs'
    throw err
  }

  return Buffer.from(await upstream.arrayBuffer())
}

/**
 * xAI / Grok TTS — https://api.x.ai/v1/tts
 * @param {{ text: string, language?: string, rate?: number }} body
 * @param {string} apiKey
 */
export async function synthesizeXai(body, apiKey) {
  const { text, language } = normalizeBody(body)
  const upstream = await fetch('https://api.x.ai/v1/tts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: text.slice(0, 14000),
      voice_id: XAI_VOICE,
      language: xaiLanguage(language),
    }),
  })

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    const err = new Error(detail || `xAI TTS HTTP ${upstream.status}`)
    err.status = upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502
    err.provider = 'xai'
    throw err
  }

  const contentType = upstream.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    // Some deployments return JSON errors with 200 — treat as failure
    const detail = await upstream.text().catch(() => '')
    const err = new Error(detail || 'xAI returned JSON instead of audio')
    err.status = 502
    err.provider = 'xai'
    throw err
  }

  return Buffer.from(await upstream.arrayBuffer())
}

/**
 * ElevenLabs first, then xAI. Throws if both unavailable / fail.
 * @param {{ text: string, language?: string, rate?: number }} body
 * @param {{ elevenLabsKey?: string, xaiKey?: string }} keys
 * @returns {Promise<{ audio: Buffer, provider: 'elevenlabs' | 'xai' }>}
 */
export async function synthesizeTts(body, keys = {}) {
  const elevenLabsKey = keys.elevenLabsKey || process.env.ELEVENLABS_API_KEY
  const xaiKey = keys.xaiKey || process.env.XAI_API_KEY
  /** @type {Error | null} */
  let lastErr = null

  if (elevenLabsKey) {
    try {
      const audio = await synthesizeElevenLabs(body, elevenLabsKey)
      if (audio?.length) return { audio, provider: 'elevenlabs' }
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      console.warn('[tts] ElevenLabs failed, trying xAI…', lastErr.message?.slice?.(0, 180) || lastErr)
    }
  }

  if (xaiKey) {
    try {
      const audio = await synthesizeXai(body, xaiKey)
      if (audio?.length) return { audio, provider: 'xai' }
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      console.warn('[tts] xAI failed', lastErr.message?.slice?.(0, 180) || lastErr)
    }
  }

  if (!elevenLabsKey && !xaiKey) {
    const err = new Error('No TTS API key configured (ELEVENLABS_API_KEY or XAI_API_KEY)')
    err.status = 503
    throw err
  }

  const err = lastErr || new Error('TTS failed')
  if (!err.status) err.status = 502
  throw err
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

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const { audio, provider } = await synthesizeTts(body, {
      elevenLabsKey: process.env.ELEVENLABS_API_KEY,
      xaiKey: process.env.XAI_API_KEY,
    })
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-TTS-Provider', provider)
    res.status(200).send(audio)
  } catch (err) {
    const status = err?.status || 500
    res.status(status).json({ error: err?.message || 'TTS failed' })
  }
}
