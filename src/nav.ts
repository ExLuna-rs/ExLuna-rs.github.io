// Two ways to move around, same destination:
//  - Neovim-style modal keys + a `:` command line in the statusline
//  - plain buttons, clickable planet labels and prev/next arrows

import { profile, projects } from './content'
import { lang, onLang, t } from './i18n'
import type { App } from './terminal/commands'
import { esc } from './terminal/terminal'

type Mode = 'normal' | 'command' | 'search' | 'insert'

export function setupNav(app: App) {
  const { world, term } = app
  const status = document.querySelector<HTMLElement>('.statusline')!
  const modeEl = status.querySelector<HTMLElement>('.mode')!
  const pathEl = status.querySelector<HTMLElement>('.path')!
  const infoEl = status.querySelector<HTMLElement>('.info')!
  const cmdForm = status.querySelector<HTMLFormElement>('.cmdline')!
  const cmdInput = cmdForm.querySelector('input')!
  const cmdPrefix = cmdForm.querySelector<HTMLElement>('.prefix')!
  const msgEl = status.querySelector<HTMLElement>('.msg')!
  const labels = document.getElementById('labels')!
  const pager = document.querySelector<HTMLElement>('.pager')!

  let mode: Mode = 'normal'
  let pending = ''
  let lastSearch = ''

  // ── mode handling ──────────────────────────────────────────────
  const setMode = (m: Mode) => {
    mode = m
    status.dataset.mode = m
    modeEl.textContent = `-- ${t(m === 'insert' ? 'status.insert' : m === 'command' ? 'status.command' : m === 'search' ? 'status.search' : 'status.normal')} --`
    cmdForm.hidden = !(m === 'command' || m === 'search')
    pathEl.hidden = !cmdForm.hidden
    if (!cmdForm.hidden) {
      cmdPrefix.textContent = m === 'command' ? ':' : '/'
      cmdInput.value = ''
      cmdInput.focus()
    }
  }

  const flash = (s: string) => {
    msgEl.textContent = s
    msgEl.classList.add('show')
    clearTimeout((flash as any).t)
    ;(flash as any).t = setTimeout(() => msgEl.classList.remove('show'), 2200)
  }

  term.el.querySelector('input')!.addEventListener('focus', () => setMode('insert'))
  term.el.querySelector('input')!.addEventListener('blur', () => { if (mode === 'insert') setMode('normal') })

  const search = (q: string, from = world.current) => {
    const n = world.bodies.length
    for (let k = 1; k <= n; k++) {
      const i = (from + k) % n
      const b = world.bodies[i]
      const p = projects.find(p => p.id === b.id)
      const hay = `${b.name} ${b.id} ${p?.stack.join(' ') ?? ''} ${p ? p.summary[lang()] : ''}`.toLowerCase()
      if (hay.includes(q.toLowerCase())) return i
    }
    return -1
  }

  cmdForm.addEventListener('submit', e => {
    e.preventDefault()
    const v = cmdInput.value.trim()
    const was = mode
    setMode('normal')
    cmdInput.blur()
    if (!v) return
    if (was === 'search') {
      lastSearch = v
      const i = search(v)
      if (i < 0) flash(`E486: Pattern not found: ${v}`)
      else world.goto(i)
      return
    }
    // Vim-flavoured aliases, everything else goes to the shell.
    if (/^q(uit)?!?$|^wq$|^x$/.test(v)) { app.setTerminal('min'); flash(':q — terminal minimisé / minimized'); return }
    if (/^\d+$/.test(v)) { world.goto(Number(v)); return }
    if (v === 'e' || v === 'e!') { world.goto(world.current); return }
    app.setTerminal('open')
    term.exec(v, true)
  })
  cmdInput.addEventListener('blur', () => { if (mode === 'command' || mode === 'search') setMode('normal') })
  cmdInput.addEventListener('keydown', e => {
    if (e.key === 'Escape' || (e.key === 'Backspace' && !cmdInput.value)) {
      e.preventDefault()
      setMode('normal')
      cmdInput.blur()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const opts = mode === 'search' ? world.bodies.map(b => b.id) : term.list().map(c => c.name)
      const hit = opts.find(o => o.startsWith(cmdInput.value))
      if (hit) cmdInput.value = hit
    }
  })

  // ── normal mode keys ───────────────────────────────────────────
  addEventListener('keydown', e => {
    if (document.getElementById('boot')) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (mode === 'insert') {
      if (e.key === 'Escape') { term.blur(); setMode('normal') }
      return
    }
    if (mode !== 'normal') return
    const k = e.key
    const seq = pending + k
    pending = ''
    const handled = () => e.preventDefault()

    if (seq === 'gg') { handled(); world.goto(0); return }
    if (k === 'g') { pending = 'g'; handled(); return }

    switch (k) {
      case 'j': case 'ArrowRight': case 'ArrowDown': case 'PageDown': handled(); world.goto(world.current + 1); break
      case 'k': case 'ArrowLeft': case 'ArrowUp': case 'PageUp': handled(); world.goto(world.current - 1); break
      case 'h': handled(); world.push(-0.5, 0); break
      case 'l': handled(); world.push(0.5, 0); break
      case 'J': handled(); world.push(0, 0.25); break
      case 'K': handled(); world.push(0, -0.25); break
      case '+': case '=': handled(); world.push(0, 0, -0.35); break
      case '-': case '_': handled(); world.push(0, 0, 0.35); break
      case 'G': handled(); world.goto(world.bodies.length - 1); break
      case 'Home': handled(); world.goto(0); break
      case ':': handled(); setMode('command'); break
      case '/': handled(); setMode('search'); break
      case 'n': if (lastSearch) { handled(); const i = search(lastSearch); if (i >= 0) world.goto(i) } break
      case '?': handled(); app.setTerminal('open'); term.exec('keys', true); break
      case 'i': case 't': case '`': case 'Enter': handled(); app.setTerminal('open'); term.focus(); break
      case 'q': handled(); app.setTerminal('toggle'); break
      case 'o': handled(); app.setTerminal('open'); term.exec('open', true); break
      case 'a': handled(); world.ascii.enabled = !world.ascii.enabled; flash(`ascii ${world.ascii.enabled ? 'on' : 'off'}`); break
      default:
        if (/^[0-9]$/.test(k) && Number(k) < world.bodies.length) { handled(); world.goto(Number(k)) }
    }
  })

  // ── labels, pager, nav bar ─────────────────────────────────────
  const labelEls = world.bodies.map((b, i) => {
    const el = document.createElement('button')
    el.className = 'label'
    el.innerHTML = `<span class="idx">${i}</span><span class="nm">${esc(i === 0 ? profile.handle : b.name)}</span>`
    el.addEventListener('click', () => world.goto(i))
    labels.appendChild(el)
    return el
  })

  pager.innerHTML = `<button class="prev" aria-label="${t('nav.prev')}">‹</button><div class="dots">${world.bodies
    .map((b, i) => `<button data-i="${i}" title="${esc(b.name)}" aria-label="${esc(b.name)}"></button>`).join('')}</div><button class="next" aria-label="${t('nav.next')}">›</button>`
  pager.querySelector('.prev')!.addEventListener('click', () => world.goto(world.current - 1))
  pager.querySelector('.next')!.addEventListener('click', () => world.goto(world.current + 1))
  pager.querySelectorAll<HTMLElement>('.dots button').forEach(b => b.addEventListener('click', () => world.goto(Number(b.dataset.i))))

  const menu = document.querySelector<HTMLElement>('.menu')!
  const menuBtn = document.querySelector<HTMLElement>('[data-nav="projects"]')!
  menu.innerHTML = projects.map((p, i) => `<button data-i="${i + 1}"><span class="idx">${i + 1}</span>${esc(p.name)}</button>`).join('')
  menu.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')
    if (b) { world.goto(Number(b.dataset.i)); menu.hidden = true }
  })
  menuBtn.addEventListener('click', e => { e.stopPropagation(); menu.hidden = !menu.hidden })
  addEventListener('click', () => { menu.hidden = true })

  document.querySelectorAll<HTMLElement>('[data-nav]').forEach(btn => {
    const act = btn.dataset.nav!
    if (act === 'projects') return
    btn.addEventListener('click', () => {
      if (act === 'home') world.goto(0)
      else if (act === 'terminal') app.setTerminal('toggle')
      else if (act === 'lang') term.exec(`lang ${lang() === 'fr' ? 'en' : 'fr'}`, true)
      else { app.setTerminal('open'); term.exec(act, true) }
    })
  })

  const relabel = () => {
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n as any) })
    document.querySelector('[data-nav="lang"]')!.textContent = lang() === 'fr' ? 'EN' : 'FR'
    setMode(mode)
  }
  onLang(relabel)
  relabel()

  // Click on a planet (a click, not a drag).
  const canvas = world.renderer.domElement
  let down: { x: number; y: number } | null = null
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY } })
  canvas.addEventListener('pointerup', e => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
      const i = world.pick(e.clientX, e.clientY)
      if (i >= 0 && i !== world.current) world.goto(i)
    }
    down = null
    if (mode === 'insert') term.blur()
  })

  // Per-frame UI sync.
  world.onFrame(() => {
    world.bodies.forEach((_, i) => {
      const p = world.project(i)
      const el = labelEls[i]
      if (!p || p.x < -50 || p.x > innerWidth + 50 || p.y < -50 || p.y > innerHeight + 50) { el.hidden = true; return }
      el.hidden = false
      el.style.transform = `translate(${p.x}px, ${p.y - Math.max(p.r, 8) - 14}px) translate(-50%, -100%)`
      el.classList.toggle('current', i === world.current && !world.flying)
    })
    const b = world.bodies[world.current]
    const d = world.camera.position.distanceTo(b.object.position)
    infoEl.textContent = `${world.current + 1}/${world.bodies.length}  ${d.toFixed(1)}u  ${lang()}  ${Math.round(world.fps)}fps`
  })

  const sync = (i: number) => {
    const b = world.bodies[i]
    pathEl.textContent = i === 0 ? '~/luna' : `~/projects/${b.id}`
    pager.querySelectorAll('.dots button').forEach((d, k) => d.classList.toggle('on', k === i))
    document.querySelector('.hud-target')!.textContent = i === 0 ? t('body.home') : b.name
  }
  world.on('depart', sync)
  sync(0)
  setMode('normal')
}
