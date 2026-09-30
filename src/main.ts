import './style.css'
import { boot } from './boot'
import { projects } from './content'
import { setupNav } from './nav'
import { World } from './scene/world'
import { homeCard, projectCard, registerCommands, THEMES, type App, type ThemeName } from './terminal/commands'
import { md, Terminal } from './terminal/terminal'
import { t } from './i18n'

async function main() {
  // The glyph atlas is drawn with this font, wait for it.
  await Promise.race([document.fonts.load('600 16px "JetBrains Mono"'), new Promise(r => setTimeout(r, 1500))])

  const world = new World(document.getElementById('scene') as HTMLCanvasElement)
  const term = new Terminal(document.getElementById('term')!)
  const termEl = term.el

  const app: App = {
    world,
    term,
    theme: 'teal',
    setTheme(name: ThemeName) {
      app.theme = name
      document.documentElement.style.setProperty('--accent', THEMES[name])
      world.ascii.setTint(THEMES[name])
      try { localStorage.setItem('exluna.theme', name) } catch { /* storage blocked */ }
    },
    setTerminal(state) {
      const min = termEl.classList.contains('min')
      termEl.classList.remove('max')
      if (state === 'toggle') termEl.classList.toggle('min', !min)
      else if (state === 'min') termEl.classList.add('min')
      else { termEl.classList.remove('min'); if (state === 'max') termEl.classList.add('max') }
      if (termEl.classList.contains('min')) term.blur()
      reframe()
    },
    async reboot() {
      term.clear()
      await boot()
      welcome()
    },
  }

  // Keep the current body visible beside (desktop) or above (compact) the open terminal.
  const compact = matchMedia('(max-width: 720px), (orientation: portrait) and (max-width: 1100px)')
  const reframe = () => {
    const open = !termEl.classList.contains('min') && !termEl.classList.contains('max')
    if (!open) world.setShift(0)
    else if (compact.matches) world.setShift(0, (termEl.offsetHeight + 40) / 2)
    else world.setShift((termEl.offsetWidth + 22) / 2)
  }
  compact.addEventListener('change', reframe)
  addEventListener('resize', reframe)

  try {
    const saved = localStorage.getItem('exluna.theme') as ThemeName | null
    app.setTheme(saved && saved in THEMES ? saved : 'teal')
  } catch { app.setTheme('teal') }

  termEl.querySelectorAll<HTMLElement>('[data-act]').forEach(b =>
    b.addEventListener('click', () => {
      const act = b.dataset.act
      if (act === 'max') app.setTerminal(termEl.classList.contains('max') ? 'open' : 'max')
      else app.setTerminal(act === 'min' && termEl.classList.contains('min') ? 'open' : 'min')
    }),
  )
  termEl.querySelector('.term-bar')!.addEventListener('dblclick', () => app.setTerminal(termEl.classList.contains('max') ? 'open' : 'max'))

  registerCommands(app)
  setupNav(app)

  // Arriving somewhere prints its card: the terminal doubles as an info panel.
  world.on('arrive', i => {
    const b = world.bodies[i]
    term.setHost(i === 0 ? 'luna' : b.id, i === 0 ? '~' : `~/projects/${b.id}`)
    history.replaceState(null, '', i === 0 ? location.pathname : `#${b.id}`)
    if (world.aboutMode) return
    // On small screens the terminal is the info panel: bring it up with the card.
    if (compact.matches && termEl.classList.contains('min')) app.setTerminal('open')
    const p = projects.find(p => p.id === b.id)
    term.print('')
    term.lines(p ? projectCard(p) : homeCard())
  })

  const welcome = () => {
    term.lines(homeCard())
    term.print('')
    term.print(md(t('term.welcome')))
  }

  reframe()
  // The boot log plays once per session; `reboot` replays it.
  let booted = false
  try { booted = sessionStorage.getItem('exluna.booted') === '1'; sessionStorage.setItem('exluna.booted', '1') } catch { /* storage blocked */ }
  if (!booted) await boot()
  welcome()

  // Deep links: exluna-rs.github.io/#g-lib
  const deep = world.indexOf(decodeURIComponent(location.hash.slice(1)))
  if (deep > 0) world.goto(deep)
  addEventListener('hashchange', () => {
    const i = world.indexOf(decodeURIComponent(location.hash.slice(1)))
    if (i > 0 && i !== world.current) world.goto(i)
  })
}

main()
