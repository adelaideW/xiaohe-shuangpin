import { defineConfig, loadEnv } from 'vite'
import { synthesizeElevenLabs } from './api/tts.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    server: {
      host: '127.0.0.1',
      port: 5179,
    },
    resolve: {
      // kuromoji DictionaryLoader uses path.join; Vite would otherwise externalize Node "path"
      alias: {
        path: 'path-browserify',
      },
    },
    optimizeDeps: {
      include: ['kuroshiro', 'kuroshiro-analyzer-kuromoji', 'kuromoji', 'path-browserify'],
    },
    build: {
      commonjsOptions: {
        include: [/kuroshiro/, /kuromoji/, /path-browserify/, /node_modules/],
        transformMixedEsModules: true,
      },
    },
    plugins: [
      {
        name: 'local-tts-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const path = req.url?.split('?')[0]
            if (path !== '/api/tts') return next()
            if (req.method === 'OPTIONS') {
              res.statusCode = 204
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
              res.end()
              return
            }
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }
            const apiKey = env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY
            if (!apiKey) {
              res.statusCode = 503
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'ELEVENLABS_API_KEY is not configured' }))
              return
            }
            try {
              const chunks = []
              for await (const chunk of req) chunks.push(chunk)
              const raw = Buffer.concat(chunks).toString('utf8')
              const body = raw ? JSON.parse(raw) : {}
              const audio = await synthesizeElevenLabs(body, apiKey)
              res.statusCode = 200
              res.setHeader('Content-Type', 'audio/mpeg')
              res.setHeader('Cache-Control', 'no-store')
              res.end(audio)
            } catch (err) {
              res.statusCode = err?.status || 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err?.message || 'TTS failed' }))
            }
          })
        },
      },
    ],
  }
})
