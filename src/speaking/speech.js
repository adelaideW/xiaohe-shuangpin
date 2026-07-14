/** Text-to-speech (ElevenLabs via /api/tts) + Web Speech recognition helpers. */

/** @typedef {'en' | 'ja' | 'zh'} SpeakLang */

/**
 * @param {SpeakLang} language
 */
function bcp47(language) {
  if (language === 'ja') return 'ja-JP'
  if (language === 'zh') return 'zh-CN'
  return 'en-US'
}

/**
 * @param {SpeakLang} language
 */
function langPrefix(language) {
  if (language === 'ja') return 'ja'
  if (language === 'zh') return 'zh'
  return 'en'
}

/** @type {HTMLAudioElement | null} */
let currentAudio = null
/** @type {string | null} */
let currentObjectUrl = null
/** @type {SpeechSynthesisUtterance | null} */
let currentUtter = null
let usingBrowser = false

function clearAudio() {
  if (currentAudio) {
    currentAudio.onended = null
    currentAudio.onerror = null
    try {
      currentAudio.pause()
    } catch {
      /* ignore */
    }
    currentAudio = null
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
}

/**
 * Browser Web Speech API fallback.
 * @param {string} text
 * @param {SpeakLang} language
 * @param {number} [rate]
 * @param {(() => void) | null} [onEnd]
 */
function speakBrowser(text, language, rate = 1, onEnd = null) {
  if (!('speechSynthesis' in window)) {
    onEnd?.()
    return null
  }
  window.speechSynthesis.cancel()
  usingBrowser = true
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = bcp47(language)
  utter.rate = rate
  const voices = window.speechSynthesis.getVoices()
  const prefix = langPrefix(language)
  const match =
    voices.find((v) => v.lang === utter.lang) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix))
  if (match) utter.voice = match
  utter.onend = () => {
    currentUtter = null
    usingBrowser = false
    onEnd?.()
  }
  currentUtter = utter
  window.speechSynthesis.speak(utter)
  return utter
}

/**
 * Prefer ElevenLabs (/api/tts); fall back to browser speechSynthesis.
 * @param {string} text
 * @param {SpeakLang} language
 * @param {number} [rate]
 * @param {(() => void) | null} [onEnd]
 */
export async function speakText(text, language, rate = 1, onEnd = null) {
  const trimmed = String(text || '').trim()
  if (!trimmed) {
    onEnd?.()
    return null
  }

  cancelSpeech()
  usingBrowser = false

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed, language, rate }),
    })
    if (!res.ok) throw new Error(`TTS ${res.status}`)
    const blob = await res.blob()
    if (!blob.size) throw new Error('Empty audio')
    const url = URL.createObjectURL(blob)
    currentObjectUrl = url
    const audio = new Audio(url)
    audio.playbackRate = Math.min(1.5, Math.max(0.7, Number(rate) || 1))
    currentAudio = audio
    audio.onended = () => {
      clearAudio()
      onEnd?.()
    }
    audio.onerror = () => {
      clearAudio()
      speakBrowser(trimmed, language, rate, onEnd)
    }
    await audio.play()
    return audio
  } catch {
    return speakBrowser(trimmed, language, rate, onEnd)
  }
}

export function cancelSpeech() {
  clearAudio()
  currentUtter = null
  usingBrowser = false
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export function pauseSpeech() {
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause()
    return
  }
  if (usingBrowser && 'speechSynthesis' in window) window.speechSynthesis.pause()
}

export function resumeSpeech() {
  if (currentAudio && currentAudio.paused) {
    void currentAudio.play()
    return
  }
  if (usingBrowser && 'speechSynthesis' in window) window.speechSynthesis.resume()
}

export function isSpeechPaused() {
  if (currentAudio) return currentAudio.paused && !currentAudio.ended && currentAudio.currentTime > 0
  if (usingBrowser && 'speechSynthesis' in window) return window.speechSynthesis.paused
  return false
}

export function isSpeechPlaying() {
  if (currentAudio) return !currentAudio.paused && !currentAudio.ended
  if (usingBrowser && 'speechSynthesis' in window) {
    return window.speechSynthesis.speaking && !window.speechSynthesis.paused
  }
  return false
}

/**
 * Create a continuous speech recognizer controller.
 * @param {SpeakLang} language
 * @param {{
 *   onUpdate?: (payload: { transcript: string, interim: string, listening: boolean, error: string }) => void
 * }} [opts]
 */
export function createSpeechRecognizer(language, opts = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  const supported = !!SR
  /** @type {InstanceType<NonNullable<typeof SR>> | null} */
  let rec = null
  let listening = false
  let finalText = ''
  let interimText = ''
  let error = ''

  function micBlockedMsg() {
    if (language === 'ja') return 'マイクの使用がブロックされています。'
    if (language === 'zh') return '麦克风权限被拒绝。'
    return 'Microphone access was blocked.'
  }

  function emit() {
    opts.onUpdate?.({
      transcript: `${finalText}${interimText}`.trim(),
      interim: interimText,
      listening,
      error,
    })
  }

  function start() {
    if (!supported) return
    error = ''
    finalText = ''
    interimText = ''
    rec = new SR()
    rec.lang = bcp47(language)
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) final += `${r[0].transcript} `
        else interim += r[0].transcript
      }
      finalText = final
      interimText = interim
      emit()
    }
    rec.onerror = (e) => {
      error = e.error === 'not-allowed' ? micBlockedMsg() : `Recognition error: ${e.error}`
      listening = false
      emit()
    }
    rec.onend = () => {
      listening = false
      emit()
    }
    rec.start()
    listening = true
    emit()
  }

  function stop() {
    if (rec) rec.stop()
    listening = false
    emit()
  }

  function reset() {
    finalText = ''
    interimText = ''
    error = ''
    emit()
  }

  function destroy() {
    if (rec) {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    }
    rec = null
    listening = false
  }

  return {
    supported,
    start,
    stop,
    reset,
    destroy,
    get listening() {
      return listening
    },
    get transcript() {
      return `${finalText}${interimText}`.trim()
    },
    get error() {
      return error
    },
  }
}

/**
 * @param {string} text
 * @param {SpeakLang} language
 */
export function splitSentences(text, language) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const parts =
    language === 'ja' || language === 'zh'
      ? clean.split(/(?<=[。！？])/)
      : clean.split(/(?<=[.!?])\s+/)
  return parts.map((s) => s.trim()).filter(Boolean)
}
