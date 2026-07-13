import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5179,
  },
  optimizeDeps: {
    include: ['kuroshiro', 'kuroshiro-analyzer-kuromoji', 'kuromoji'],
  },
  build: {
    commonjsOptions: {
      include: [/kuroshiro/, /kuromoji/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
})
