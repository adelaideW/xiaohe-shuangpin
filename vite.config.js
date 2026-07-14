import { defineConfig } from 'vite'

export default defineConfig({
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
})
