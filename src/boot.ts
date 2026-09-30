import { profile, projects } from './content'
import { t } from './i18n'

const LOGO = String.raw`
 _____      _
| ____|_  _| |   _   _ _ __   __ _       _ __ ___
|  _| \ \/ / |  | | | | '_ \ / _' |_____| '__/ __|
| |___ >  <| |__| |_| | | | | (_| |_____| |  \__ \
|_____/_/\_\_____\__,_|_| |_|\__,_|     |_|  |___/
                                  ExLunaOS 1.0`

// Fake boot log. Any key or click skips it.
export function boot(): Promise<void> {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const el = document.createElement('div')
  el.id = 'boot'
  el.innerHTML = `<pre class="boot-log"></pre><div class="boot-skip">${t(matchMedia('(pointer: coarse)').matches ? 'boot.skip.touch' : 'boot.skip')}</div>`
  document.body.appendChild(el)
  const log = el.querySelector('pre')!

  const lines = [
    'ExLuna BIOS v2.6 — (c) baguette Land Systems',
    'CPU: SHA-warma Quantum Kebab @ 4.20 GHz ............ [ OK ]',
    'Memory test: 384400 km ............................. [ OK ]',
    'Mounting /dev/moon on / ............................. [ OK ]',
    'Loading three.js renderer .......................... [ OK ]',
    'Compiling ASCII shader " .\'`:-~=+*o#%&@" ............ [ OK ]',
    `Calibrating orbits (${projects.length + 1} bodies) ...................... [ OK ]`,
    'Starting exsh ...................................... [ OK ]',
    LOGO,
    `  ${profile.name} — ${profile.handle}`,
  ]

  return new Promise(resolve => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      removeEventListener('keydown', finish)
      el.removeEventListener('pointerdown', finish)
      el.classList.add('out')
      setTimeout(() => { el.remove(); resolve() }, reduced ? 0 : 450)
    }
    addEventListener('keydown', finish)
    el.addEventListener('pointerdown', finish)

    if (reduced) { log.textContent = lines.join('\n'); setTimeout(finish, 400); return }
    let i = 0
    const next = () => {
      if (done) return
      if (i >= lines.length) { setTimeout(finish, 700); return }
      log.textContent += (i ? '\n' : '') + lines[i++]
      setTimeout(next, i < 8 ? 90 + Math.random() * 120 : 40)
    }
    next()
  })
}
