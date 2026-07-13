/**
 * Vercel serverless: grades a learner's spoken repeat/shadow attempt against the original passage.
 * Input is a speech-recognition transcript (text), not audio — the client does STT via the
 * browser's Web Speech API. Requires ANTHROPIC_API_KEY (optional — client falls back to a
 * local word-overlap heuristic).
 */

function buildPrompt(language, original, transcript) {
  const langLabel = language === 'ja' ? 'Japanese' : 'English';
  return [
    `You are a supportive oral ${langLabel} language coach.`,
    'A learner listened to the ORIGINAL passage below, then tried to repeat/shadow it aloud from memory.',
    'Their speech was auto-transcribed by browser speech recognition, so minor transcription noise is possible',
    '(especially around homophones, names, or punctuation) — be lenient about ambiguous mismatches that could be',
    'transcription artifacts, and focus on genuine differences: missing content, added content, wrong words, word order,',
    'and any clear grammar issues visible in the transcript. You cannot hear actual pronunciation or accent from text alone,',
    'so do not claim to assess pronunciation directly — focus feedback on content accuracy, completeness, word choice, and fluency cues',
    '(filler words, repeated words, obviously broken phrasing) visible in the transcript.',
    '',
    `ORIGINAL:\n"""${original}"""`,
    '',
    `LEARNER TRANSCRIPT:\n"""${transcript}"""`,
    '',
    'Rate the repeat attempt on a single 1-5 scale (5 = excellent, thorough and accurate repetition; 3 = partial, gets the gist with',
    'notable gaps; 1 = very little of the original was reproduced).',
    'Respond with strict JSON only (no markdown fence, no commentary). Schema:',
    '{"rating": integer 1-5, "summary": string (1-2 sentence overall assessment, encouraging but honest), "improvements": [string, ...] (2-4 short, specific, actionable bullet points on what to improve next time)}',
  ].join('\n');
}

function parseGrade(raw) {
  const cleaned = String(raw || '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const parsed = JSON.parse(cleaned);
  const rating = Math.max(1, Math.min(5, Math.round(Number(parsed.rating) || 3)));
  const improvements = Array.isArray(parsed.improvements)
    ? parsed.improvements.map((s) => String(s).trim()).filter(Boolean).slice(0, 4)
    : [];
  return {
    rating,
    summary: String(parsed.summary || '').trim(),
    improvements,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const language = body?.language === 'ja' ? 'ja' : 'en';
  const original = String(body?.original || '').trim();
  const transcript = String(body?.transcript || '').trim();

  if (!original || !transcript) {
    return res.status(400).json({ error: 'original and transcript are required' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: buildPrompt(language, original, transcript) }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic error', response.status, errText);
      return res.status(502).json({ error: 'AI request failed' });
    }

    const data = await response.json();
    const text = data?.content?.find((c) => c.type === 'text')?.text || '';
    const grade = parseGrade(text);

    if (!grade.summary) {
      return res.status(502).json({ error: 'AI returned an incomplete grade' });
    }

    return res.status(200).json(grade);
  } catch (err) {
    console.error('grade-repeat failed', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}
