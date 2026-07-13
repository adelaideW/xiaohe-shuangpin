import './style.css'
import { loadTrack } from './track.js'

const app = document.querySelector('#app')

async function boot() {
  const track = loadTrack()
  if (track === 'english') {
    const { bootEnglish } = await import('./english/practice.js')
    bootEnglish(app)
    return
  }
  const { bootShuangpin } = await import('./shuangpinPractice.js')
  bootShuangpin()
}

boot()
