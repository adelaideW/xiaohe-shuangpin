/**
 * English practice content — words, sentences, quotes / short essays.
 * Typing includes punctuation; length metrics still count letters/digits only.
 * Article bank is shared with speaking (`ENGLISH_ARTICLES`).
 */

import { isTypablePunct, isTypableSpace } from '../punct.js'
import { ENGLISH_ESSAYS } from './essays.js'

/** @typedef {{ title: string, text: string }} Passage */

export const ENGLISH_WORDS = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
  'practice', 'typing', 'keyboard', 'accuracy', 'speed', 'rhythm', 'focus', 'breath',
  'morning', 'coffee', 'window', 'quiet', 'steady', 'flight', 'harbor', 'bridge',
  'garden', 'story', 'letter', 'music', 'ocean', 'silver', 'golden', 'simple',
]

/** @type {Passage[]} */
export const ENGLISH_SENTENCES = [
  { title: 'Warm-up', text: 'The quick brown fox jumps over the lazy dog.' },
  { title: 'Warm-up', text: 'Pack my box with five dozen liquor jugs.' },
  { title: 'Warm-up', text: 'How vexingly quick daft zebras jump!' },
  { title: 'Daily', text: 'Please send the draft before lunch so we can review it together.' },
  { title: 'Daily', text: 'A short walk after writing often clears the mind.' },
  { title: 'Daily', text: 'She left the notes on the table and locked the door behind her.' },
  { title: 'Daily', text: 'If you practice a little every day, progress feels almost inevitable.' },
  { title: 'Daily', text: 'Rain tapped softly against the window while the kettle began to sing.' },
  { title: 'Work', text: 'We need an accurate estimate by Friday, not a hopeful guess.' },
  { title: 'Work', text: 'Document the edge cases so the next person does not rediscover them.' },
  { title: 'Work', text: 'Clarity beats cleverness when you explain a complicated idea.' },
  { title: 'Design', text: 'Good design disappears when the task feels natural in your hands.' },
  { title: 'Design', text: 'Whitespace is not empty; it is the pause that makes meaning readable.' },
  { title: 'Morning', text: 'Before sunrise, the bakery lights glowed warmly across the quiet street.' },
  { title: 'Morning', text: 'He opened the curtains and watched fog lift slowly from the river.' },
  { title: 'Morning', text: 'Fresh coffee and an open notebook made the early hour feel generous.' },
  { title: 'Travel', text: 'Our train crossed the valley just as the mountains turned gold.' },
  { title: 'Travel', text: 'Keep your ticket nearby because the conductor will check it after departure.' },
  { title: 'Travel', text: 'The narrow road curved through olive groves before reaching the coast.' },
  { title: 'Travel', text: 'She packed lightly, carrying only what she could lift without help.' },
  { title: 'Nature', text: 'A heron stood perfectly still at the edge of the marsh.' },
  { title: 'Nature', text: 'Wind moved through the tall grass like a hand across water.' },
  { title: 'Nature', text: 'By evening, the first stars appeared above the darkening orchard.' },
  { title: 'Nature', text: 'The tide erased every footprint we had left along the shore.' },
  { title: 'City', text: 'Bicycles gathered outside the station as the evening commute began.' },
  { title: 'City', text: 'Someone was playing a violin beneath the old stone bridge.' },
  { title: 'City', text: 'The corner shop stayed open late for neighbors returning from work.' },
  { title: 'City', text: 'Neon signs reflected in puddles left by the afternoon storm.' },
  { title: 'Home', text: 'The soup tasted better after it had rested for an hour.' },
  { title: 'Home', text: 'They moved the table closer to the window to catch more light.' },
  { title: 'Home', text: 'A handwritten recipe fell from the back of the kitchen drawer.' },
  { title: 'Home', text: 'Please water the basil before the soil becomes completely dry.' },
  { title: 'Learning', text: 'A useful question can reveal more than a confident answer.' },
  { title: 'Learning', text: 'She reread the difficult paragraph until its structure became clear.' },
  { title: 'Learning', text: 'Mistakes become valuable when you pause long enough to examine them.' },
  { title: 'Learning', text: 'Explain the idea in plain language before adding technical detail.' },
  { title: 'People', text: 'The new neighbor remembered every name after meeting us only once.' },
  { title: 'People', text: 'He listened without interrupting, then asked exactly the right question.' },
  { title: 'People', text: 'We shared an umbrella and laughed when the rain grew heavier.' },
  { title: 'People', text: 'Her calm reply changed the tone of the entire conversation.' },
  { title: 'Ideas', text: 'A small constraint sometimes leads to the most inventive solution.' },
  { title: 'Ideas', text: 'The simplest explanation was hidden beneath several clever assumptions.' },
  { title: 'Ideas', text: 'Write the conclusion first if you are unsure where to begin.' },
  { title: 'Ideas', text: 'Good questions remain useful long after their first answers fade.' },
  { title: 'Time', text: 'Ten quiet minutes can be enough to reset a crowded mind.' },
  { title: 'Time', text: 'The old clock lost a minute each week but nobody replaced it.' },
  { title: 'Time', text: 'We arrived early and had the platform almost entirely to ourselves.' },
  { title: 'Food', text: 'Lemon zest gave the simple cake a bright and unexpected flavor.' },
  { title: 'Food', text: 'The market vendor offered us a peach before we chose a basket.' },
  { title: 'Food', text: 'Warm bread disappeared from the table before dinner officially began.' },
  { title: 'Weather', text: 'Thunder rolled beyond the hills while sunlight remained in the garden.' },
  { title: 'Weather', text: 'The temperature dropped quickly once the clouds covered the moon.' },
  { title: 'Weather', text: 'Snow softened the familiar sounds of traffic and closing doors.' },
  { title: 'Craft', text: 'Measure the board twice before making the first cut.' },
  { title: 'Craft', text: 'The potter centered the clay with steady hands and patient pressure.' },
  { title: 'Craft', text: 'Each repaired seam made the old jacket more distinctly her own.' },
  { title: 'Reflection', text: 'Not every unfinished plan needs to become a source of regret.' },
  { title: 'Reflection', text: 'He changed his mind after noticing what his first argument ignored.' },
  { title: 'Reflection', text: 'Rest is part of sustained effort, not a reward for exhaustion.' },
]

/** @type {Passage[]} */
export const ENGLISH_ARTICLES = [
  {
    title: 'Quote · Hemingway',
    text: 'There is nothing to writing. All you do is sit down at a typewriter and bleed. The first draft of anything is shit, but the work still has to be finished.',
  },
  {
    title: 'Quote · Maya Angelou',
    text: 'You may not control all the events that happen to you, but you can decide not to be reduced by them. Have enough courage to trust love one more time and always one more time.',
  },
  {
    title: 'Quote · Toni Morrison',
    text: 'If there is a book that you want to read but it has not been written yet, then you must write it. We die. That may be the meaning of life. But we do language. That may be the measure of our lives.',
  },
  {
    title: 'Quote · Neil Gaiman',
    text: 'The one thing that you have that nobody else has is you. Your voice, your mind, your story, your vision. So write and draw and build and play and dance and live as only you can.',
  },
  {
    title: 'Gettysburg Address (excerpt)',
    text: 'Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal. Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure.',
  },
  {
    title: 'I Have a Dream (excerpt) · King',
    text: 'I have a dream that my four little children will one day live in a nation where they will not be judged by the color of their skin but by the content of their character. I have a dream today.',
  },
  {
    title: 'Pride and Prejudice (opening)',
    text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.',
  },
  {
    title: 'Walden (excerpt) · Thoreau',
    text: 'I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived.',
  },
  {
    title: 'On Typing',
    text: 'Typing well is less about speed contests and more about quiet accuracy. When your fingers know the landscape of the keys, attention returns to the sentence you meant to write. Rhythm arrives later, as a side effect of trust.',
  },
  {
    title: 'The Little Prince (excerpt)',
    text: 'And now here is my secret, a very simple secret: It is only with the heart that one can see rightly; what is essential is invisible to the eye.',
  },
  ...ENGLISH_ESSAYS,
]

/** Letters & digits for word/length metrics. */
export function isEnglishLetterOrDigit(ch) {
  return /[A-Za-z0-9]/.test(ch)
}

/** Typable practice keys: letters, digits, punctuation, and spaces. */
export function isEnglishTypeChar(ch) {
  return isEnglishLetterOrDigit(ch) || isTypablePunct(ch) || isTypableSpace(ch)
}

/**
 * Build typing units: letters/digits/punctuation/spaces (newlines skipped).
 * @param {string} text
 * @returns {{ char: string, index: number }[]}
 */
export function buildEnglishUnits(text) {
  const units = []
  const chars = [...text]
  for (let i = 0; i < chars.length; i++) {
    if (isEnglishTypeChar(chars[i])) units.push({ char: chars[i], index: i })
  }
  return units
}

/**
 * Build pages by approximate word count (letters/digits form words).
 * @param {{ char: string, index: number }[]} units
 * @param {number} wordsPerPage
 */
export function buildEnglishPages(units, wordsPerPage = 80) {
  const size = Math.max(5, Math.min(500, Number(wordsPerPage) || 80))
  if (!units.length) return [{ start: 0, end: 0 }]
  const pages = []
  let start = 0
  let words = 0
  let inWord = false
  for (let i = 0; i < units.length; i++) {
    const isWordChar = /[A-Za-z0-9']/.test(units[i].char)
    if (isWordChar && !inWord) {
      words += 1
      inWord = true
      if (words > size && i > start) {
        pages.push({ start, end: i })
        start = i
        words = 1
      }
    } else if (!isWordChar) {
      inWord = false
    }
  }
  pages.push({ start, end: units.length })
  return pages
}

export function pageIndexForUnit(pages, unitIndex) {
  for (let i = 0; i < pages.length; i++) {
    if (unitIndex >= pages[i].start && unitIndex < pages[i].end) return i
  }
  return Math.max(0, pages.length - 1)
}

/** Count letters/digits only (like Chinese 字数). */
export function countEnglishChars(text) {
  let n = 0
  for (const ch of String(text || '')) if (isEnglishLetterOrDigit(ch)) n += 1
  return n
}

/** Word count for speaking length limits. */
export function countEnglishWords(text) {
  return (String(text || '').toLowerCase().match(/[a-z0-9']+/g) || []).length
}

/**
 * Trim a single English article to at most maxWords (never concatenates other passages).
 * @param {{ title: string, text: string }} passage
 * @param {number} minWords unused — kept for call-site compatibility
 * @param {number} maxWords
 * @param {{ title: string, text: string }[]} [_extraPassages] ignored
 */
export function fitEnglishPassage(passage, minWords, maxWords, _extraPassages = []) {
  void minWords
  const max = Math.max(1, Math.floor(Number(maxWords) || 1))
  let text = String(passage?.text || '').trim()
  if (!text) return { title: passage?.title || 'Article', text: '' }

  if (countEnglishWords(text) > max) {
    const parts = text.match(/[A-Za-z0-9']+|\s+|[^\sA-Za-z0-9']+/g) || []
    let acc = ''
    let count = 0
    for (const part of parts) {
      const isWord = /^[A-Za-z0-9']+$/.test(part)
      if (isWord && count >= max) break
      acc += part
      if (isWord) count += 1
    }
    text = acc.replace(/\s+$/g, '')
  }

  return { title: passage?.title || 'Article', text }
}
