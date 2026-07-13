/** Heuristic grading for spoken repeats (browser STT transcript vs original). */

/** @typedef {'en' | 'ja' | 'zh'} SpeakLang */

/**
 * @typedef {{ type: 'match' | 'miss' | 'extra' | 'change', original?: string, said?: string }} DiffOp
 */

/**
 * @param {string} text
 * @param {SpeakLang} language
 */
export function tokenize(text, language) {
  if (language === 'ja') {
    return Array.from(text).filter((ch) => /[ぁ-ゟァ-ヿ㐀-鿿ｦ-ﾟ]/.test(ch))
  }
  if (language === 'zh') {
    return Array.from(text).filter((ch) => /[\u4e00-\u9fff]/.test(ch))
  }
  return (text.toLowerCase().match(/[a-z']+/g) || []).filter((w) => w.length > 1)
}

/**
 * @param {string[]} a
 * @param {string[]} b
 */
export function lcsLength(a, b) {
  const n = a.length
  const m = b.length
  if (!n || !m) return 0
  let prev = new Array(m + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    const curr = new Array(m + 1).fill(0)
    for (let j = 1; j <= m; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1])
    }
    prev = curr
  }
  return prev[m]
}

/**
 * Align original vs heard tokens (edit script) for mistake highlighting.
 * @param {string[]} originalTokens
 * @param {string[]} saidTokens
 * @returns {DiffOp[]}
 */
export function alignSpeakTokens(originalTokens, saidTokens) {
  const a = originalTokens
  const b = saidTokens
  const n = a.length
  const m = b.length
  /** @type {number[][]} */
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 0; i <= n; i++) dp[i][0] = i
  for (let j = 0; j <= m; j++) dp[0][j] = j
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }

  /** @type {DiffOp[]} */
  const ops = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      ops.push({ type: 'match', original: a[i - 1], said: b[j - 1] })
      i -= 1
      j -= 1
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      ops.push({ type: 'change', original: a[i - 1], said: b[j - 1] })
      i -= 1
      j -= 1
    } else if (j > 0 && (i === 0 || dp[i][j] === dp[i][j - 1] + 1)) {
      ops.push({ type: 'extra', said: b[j - 1] })
      j -= 1
    } else if (i > 0) {
      ops.push({ type: 'miss', original: a[i - 1] })
      i -= 1
    } else {
      break
    }
  }
  return ops.reverse()
}

/**
 * @param {string} original
 * @param {string} transcript
 * @param {SpeakLang} language
 * @returns {DiffOp[]}
 */
export function buildSpeakDiff(original, transcript, language) {
  return alignSpeakTokens(tokenize(original, language), tokenize(transcript, language))
}

/**
 * @param {string} original
 * @param {string} transcript
 * @param {SpeakLang} language
 */
export function algorithmicGrade(original, transcript, language) {
  const origTokens = tokenize(original, language)
  const saidTokens = tokenize(transcript, language)
  const diff = alignSpeakTokens(origTokens, saidTokens)

  if (!saidTokens.length) {
    const empty = {
      en: {
        summary: "We didn't catch anything — try again a bit louder or closer to the mic.",
        tip: 'Make sure your microphone is on and speak a bit louder or closer to the mic.',
      },
      ja: {
        summary: '音声がうまく取れませんでした。もう一度試してみてください。',
        tip: 'マイクの許可を確認し、はっきりめに話してください。',
      },
      zh: {
        summary: '没有识别到内容，请靠近麦克风再试一次。',
        tip: '请确认已允许麦克风权限，并稍微大声、清晰地朗读。',
      },
    }[language]
    return {
      rating: 1,
      summary: empty.summary,
      improvements: [empty.tip],
      source: 'heuristic',
      diff,
      original,
      transcript,
    }
  }

  const saidCounts = new Map()
  saidTokens.forEach((w) => saidCounts.set(w, (saidCounts.get(w) || 0) + 1))
  const missing = []
  let hits = 0
  const seen = new Map()
  origTokens.forEach((w) => {
    const used = seen.get(w) || 0
    if (used < (saidCounts.get(w) || 0)) {
      hits += 1
      seen.set(w, used + 1)
    } else {
      missing.push(w)
    }
  })
  const recall = hits / Math.max(1, origTokens.length)
  const order = lcsLength(origTokens, saidTokens) / Math.max(1, origTokens.length)
  const composite = order * 0.65 + recall * 0.35

  let rating
  if (composite >= 0.82) rating = 5
  else if (composite >= 0.62) rating = 4
  else if (composite >= 0.42) rating = 3
  else if (composite >= 0.22) rating = 2
  else rating = 1

  const uniqueMissing = [...new Set(missing)]
    .filter((w) => (language === 'en' ? w.length > 3 : true))
    .sort((a, b) => b.length - a.length)
    .slice(0, 6)

  const summaries = {
    en: {
      5: 'Excellent — your repeat closely matched the original passage.',
      4: 'Good effort — you covered most of the passage with only small gaps.',
      3: "You got the gist, but there's a fair amount missing or out of order.",
      2: 'Only part of the passage came through — worth another attempt.',
      1: 'Most of the original content is missing from your repeat.',
    },
    ja: {
      5: 'とても良い再現です。原文にかなり近づいています。',
      4: '良くできています。ほぼカバーできていて、小さな抜けのみです。',
      3: 'だいたいの意味は伝わっていますが、抜けや順序の狂いが目立ちます。',
      2: '一部しか取れませんでした。もう一度挑戦してみましょう。',
      1: '原文の内容がほぼ欠落しています。',
    },
    zh: {
      5: '非常好，复述与原文高度一致。',
      4: '不错，大部分内容都说到了，只有少量遗漏。',
      3: '大意基本正确，但遗漏或顺序偏差比较明显。',
      2: '只覆盖了一部分内容，建议再练一轮。',
      1: '原文信息大部分缺失。',
    },
  }[language]

  const improvements = []
  if (uniqueMissing.length) {
    improvements.push(
      language === 'ja'
        ? `この言葉が抜けていました: ${uniqueMissing.join('、')}`
        : language === 'zh'
          ? `这些字词缺失或发生变化：${uniqueMissing.join('、')}`
          : `Missing or changed words: ${uniqueMissing.join(', ')}`,
    )
  }
  if (order < 0.6) {
    improvements.push(
      language === 'ja'
        ? '言い換えすぎず、原文の文順に近づけると良いです。'
        : language === 'zh'
          ? '尽量按原文顺序复述，少做自由转述。'
          : 'Try to follow the original sentence order more closely rather than paraphrasing freely.',
    )
  }
  if (recall < 0.5) {
    improvements.push(
      language === 'ja'
        ? '全体の雰囲気だけでなく、具体的な語や細部も入れてみましょう。'
        : language === 'zh'
          ? '不只说大意，尽量带上原文中的具体用词和细节。'
          : 'Aim to include more of the specific details from the passage, not just the general idea.',
    )
  }
  if (!improvements.length) {
    improvements.push(
      language === 'ja'
        ? 'この調子で、次は少し速めのリスニングにも挑戦してみましょう。'
        : language === 'zh'
          ? '保持这个水平，下次可以试着稍快一点跟读。'
          : 'Keep practicing at this level — try a faster listen-through next time.',
    )
  }

  return {
    rating,
    summary: summaries[rating],
    improvements: improvements.slice(0, 4),
    source: 'heuristic',
    diff,
    original,
    transcript,
  }
}

/**
 * Grade via optional API, else local heuristic.
 * @param {SpeakLang} language
 * @param {string} original
 * @param {string} transcript
 */
export async function gradeRepeat(language, original, transcript) {
  const local = algorithmicGrade(original, transcript, language)
  try {
    const res = await fetch('/api/grade-repeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, original, transcript }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data && data.summary) {
        return {
          ...data,
          source: 'ai',
          diff: local.diff,
          original,
          transcript,
        }
      }
    }
  } catch {
    /* offline / no API */
  }
  return local
}
