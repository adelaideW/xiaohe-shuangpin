import './style.css'
import { loadTrack, mountLanguageShell } from './track.js'
import { loadSkill, mountSkillShell } from './skill.js'

async function boot() {
  const track = loadTrack()
  const app = document.querySelector('#app')
  const practiceRoot = mountLanguageShell(app, track)

  const skill = loadSkill(track)
  const skillHost = mountSkillShell(practiceRoot, track, skill)

  if (skill === 'speaking') {
    const { bootSpeaking } = await import('./speaking/practice.js')
    const language = track === 'japanese' ? 'ja' : track === 'shuangpin' ? 'zh' : 'en'
    bootSpeaking(skillHost, { language })
    return
  }

  if (track === 'english') {
    const { bootEnglish } = await import('./english/practice.js')
    bootEnglish(skillHost)
    return
  }
  if (track === 'japanese') {
    const { bootJapanese } = await import('./japanese/practice.js')
    bootJapanese(skillHost)
    return
  }

  const { bootShuangpin } = await import('./shuangpinPractice.js')
  bootShuangpin(skillHost)
}

boot()
