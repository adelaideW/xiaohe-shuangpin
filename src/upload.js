import JSZip from 'jszip'
import { createWorker } from 'tesseract.js'
import * as pdfjs from 'pdfjs-dist'

// Vite-friendly worker for pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

/**
 * @param {File} file
 * @param {{ ocrLang?: string, requireHanzi?: boolean }} [opts]
 * @returns {Promise<{ title: string, text: string }>}
 */
export async function extractFromFile(file, opts = {}) {
  const ocrLang = opts.ocrLang || 'chi_sim'
  const requireHanzi = opts.requireHanzi !== false
  const name = file.name || '上传文档'
  const title = name.replace(/\.[^.]+$/, '') || '上传文档'
  const ext = (name.split('.').pop() || '').toLowerCase()
  const type = file.type || ''

  if (ext === 'txt' || ext === 'md' || type.startsWith('text/')) {
    return { title, text: await file.text() }
  }

  if (ext === 'pdf' || type === 'application/pdf') {
    return { title, text: await extractPdf(file, requireHanzi) }
  }

  if (ext === 'epub' || type === 'application/epub+zip') {
    return { title, text: await extractEpub(file, requireHanzi) }
  }

  if (
    ext === 'png' ||
    ext === 'jpg' ||
    ext === 'jpeg' ||
    ext === 'webp' ||
    ext === 'gif' ||
    type.startsWith('image/')
  ) {
    return { title, text: await extractImageOcr(file, ocrLang, requireHanzi) }
  }

  // Fallback: try as text
  try {
    const t = await file.text()
    if (requireHanzi) {
      if (t && /[\u4e00-\u9fff]/.test(t)) return { title, text: t }
    } else if (t && /[A-Za-z]/.test(t)) {
      return { title, text: t }
    }
  } catch {
    /* ignore */
  }
  throw new Error(`暂不支持该格式：.${ext || type || 'unknown'}`)
}

async function extractPdf(file, requireHanzi = true) {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buf }).promise
  const parts = []
  const maxPages = Math.min(pdf.numPages, 40)
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const line = content.items.map((it) => ('str' in it ? it.str : '')).join('')
    if (line.trim()) parts.push(line)
  }
  const text = parts.join('\n')
  if (requireHanzi && !/[\u4e00-\u9fff]/.test(text)) {
    throw new Error('PDF 中未提取到汉字（扫描版请用图片 OCR 上传）')
  }
  if (!requireHanzi && !/[A-Za-z]/.test(text)) {
    throw new Error('No extractable text found in PDF')
  }
  return text
}

async function extractEpub(file, requireHanzi = true) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const names = Object.keys(zip.files)
    .filter((n) => /\.(xhtml|html|htm|xml)$/i.test(n) && !n.includes('META-INF'))
    .sort()
  const chunks = []
  for (const n of names.slice(0, 60)) {
    const html = await zip.files[n].async('string')
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim()
    if (text) chunks.push(text)
  }
  const text = chunks.join('\n')
  if (requireHanzi && !/[\u4e00-\u9fff]/.test(text)) throw new Error('EPUB 中未找到汉字')
  if (!requireHanzi && !/[A-Za-z]/.test(text)) throw new Error('No English text found in EPUB')
  return text
}

async function extractImageOcr(file, ocrLang = 'chi_sim', requireHanzi = true) {
  const worker = await createWorker(ocrLang)
  try {
    const {
      data: { text },
    } = await worker.recognize(file)
    const cleaned = requireHanzi
      ? (text || '').replace(/\s+/g, '')
      : String(text || '').replace(/\s+/g, ' ').trim()
    if (requireHanzi && !/[\u4e00-\u9fff]/.test(cleaned)) {
      throw new Error('图片中未识别到汉字')
    }
    if (!requireHanzi && !/[A-Za-z]/.test(cleaned)) {
      throw new Error('No English letters recognized in image')
    }
    return cleaned
  } finally {
    await worker.terminate()
  }
}
