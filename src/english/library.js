/**
 * Uploaded English passages — separate from 双拼 user library.
 */

const STORAGE_KEY = 'english-user-library'

/**
 * @typedef {{ id: string, title: string, text: string, addedAt: number }} EnglishDoc
 */

/** @returns {EnglishDoc[]} */
export function loadEnglishLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** @param {EnglishDoc[]} list */
function save(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-40)))
}

/** @param {{ title: string, text: string }} doc */
export function addEnglishDoc(doc) {
  const list = loadEnglishLibrary()
  const entry = {
    id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: doc.title,
    text: doc.text,
    addedAt: Date.now(),
  }
  list.push(entry)
  save(list)
  return entry
}

/** @param {string} id */
export function removeEnglishDoc(id) {
  save(loadEnglishLibrary().filter((d) => d.id !== id))
}
