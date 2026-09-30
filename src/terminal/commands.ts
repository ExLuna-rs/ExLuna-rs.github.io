import { profile, projects, skills, type Lang, type Project } from '../content'
import { lang, setLang, t } from '../i18n'
import { RAMP } from '../scene/ascii'
import type { World } from '../scene/world'
import { acc, cmd, dim, esc, link, md, warn, type Terminal } from './terminal'

export const THEMES = { teal: '#3ee6c1', amber: '#ffb454', green: '#6bff8f', mono: '#e8e8e8', lunar: '#9fb7ff' } as const
export type ThemeName = keyof typeof THEMES

export interface App {
  world: World
  term: Terminal
  theme: ThemeName
  setTheme(name: ThemeName): void
  setTerminal(state: 'open' | 'min' | 'max' | 'toggle'): void
  reboot(): void
}

const L = <T>(v: Record<Lang, T>) => v[lang()]
const fr = () => lang() === 'fr'
const bodyIds = () => ['luna', 'home', ...projects.map(p => p.id)]
const findProject = (q: string) => projects.find(p => p.id === q.toLowerCase() || p.name.toLowerCase() === q.toLowerCase())

// Small lit sphere in the site's own ramp, for neofetch.
function asciiMoon(w = 26, h = 13) {
  const rows: string[] = []
  const lx = 0.75, ly = 0.35, lz = 0.56
  const craters = [[-0.3, -0.2, 0.25], [0.35, 0.3, 0.2], [0.1, -0.5, 0.15], [-0.45, 0.4, 0.12]]
  for (let y = 0; y < h; y++) {
    let row = ''
    for (let x = 0; x < w; x++) {
      const nx = (x - w / 2 + 0.5) / (w / 2), ny = (y - h / 2 + 0.5) / (h / 2)
      const d = nx * nx + ny * ny
      if (d > 1) { row += ' '; continue }
      const nz = Math.sqrt(1 - d)
      let l = Math.max(0, nx * lx - ny * ly + nz * lz)
      for (const [cx, cy, r] of craters) if ((nx - cx) ** 2 + (ny - cy) ** 2 < r * r) l *= 0.6
      row += RAMP[Math.min(RAMP.length - 1, Math.floor(l * RAMP.length))]
    }
    rows.push(row)
  }
  return rows
}

export function projectCard(p: Project) {
  const idx = projects.indexOf(p) + 1
  const out = [
    `<span class="card-title">── ${esc(p.name)} ${'─'.repeat(Math.max(4, 34 - p.name.length))}</span>`,
    acc(L(p.summary)),
    ...L(p.details).map(d => `  ${dim('›')} ${md(d)}`),
    `  ${dim('stack')} ${p.stack.map(s => `<span class="tag">${esc(s)}</span>`).join(' ')}`,
    `  ${dim(fr() ? 'année' : 'year')}  ${esc(p.year)}${p.note ? '  ' + warn(L(p.note)) : ''}`,
    [
      p.repo ? cmd(fr() ? '↗ voir le code' : '↗ view code', `open ${p.id}`) : '',
      cmd(fr() ? '← précédent' : '← prev', `goto ${idx - 1}`),
      cmd(fr() ? 'suivant →' : 'next →', `goto ${idx + 1}`),
      cmd(fr() ? '⌂ accueil' : '⌂ home', 'goto home'),
    ].filter(Boolean).join('  '),
  ]
  return out
}

export function homeCard() {
  return [
    `<span class="card-title">── ${esc(profile.name)} ${dim('aka')} ${acc(profile.handle)} ─────────</span>`,
    esc(L(profile.role)) + ' · ' + dim(profile.location),
    md(L(profile.tagline)),
    [cmd('about'), cmd('projects'), cmd('skills'), cmd('contact'), cmd('help')].join('  '),
  ]
}

export function registerCommands(app: App) {
  const { term, world } = app
  const T = (s: string) => { term.print(s) }

  const gotoArg = (arg: string | undefined) => {
    if (!arg) { T(md(fr() ? 'usage : `goto <nom|numéro>`' : 'usage: `goto <name|number>`')); return }
    const a = arg.toLowerCase()
    let i: number
    if (/^\d+$/.test(a)) i = Number(a) % world.bodies.length
    else if (a === 'home' || a === '~' || a === 'luna') i = 0
    else if (a === 'next') i = world.current + 1
    else if (a === 'prev') i = world.current - 1
    else {
      i = world.bodies.findIndex(b => b.id === a || b.name.toLowerCase() === a || b.id.startsWith(a))
      if (i < 0) { T(warn(`${t('term.nobody')} "${arg}".`) + ' ' + md(`${t('term.suggest')} \`projects\``)); return }
    }
    const b = world.bodies[(i + world.bodies.length) % world.bodies.length]
    T(`${dim('»')} ${t('term.flying')} ${acc(b.name)}…`)
    world.goto(i)
  }

  term.register({
    name: 'help', aliases: ['h', 'man', '?'],
    desc: () => (fr() ? 'liste des commandes' : 'list commands'),
    run: () => {
      const w = 11
      term.lines([
        acc(fr() ? 'Commandes disponibles' : 'Available commands') + dim(fr() ? '  (Tab complète, ↑↓ historique)' : '  (Tab completes, ↑↓ history)'),
        ...term.list().filter(c => c.desc).map(c => `  ${cmd(c.name)}${' '.repeat(Math.max(1, w - c.name.length))}${dim(c.desc!())}`),
        '',
        md(fr() ? 'Clavier façon Neovim hors du terminal : `keys`' : 'Neovim-style keyboard outside the terminal: `keys`'),
      ])
    },
  })

  term.register({
    name: 'about', aliases: ['whoami'],
    desc: () => (fr() ? 'qui suis-je' : 'who am I'),
    run: () => {
      app.setTerminal('open')
      world.showAbout()
      term.lines([...homeCard().slice(0, 2), '', ...L(profile.about).map(md)])
      T(dim(fr() ? '» hologramme projeté au-dessus de la Lune. `goto home` pour le couper.' : '» hologram projected above the Moon. `goto home` to switch it off.').replace(/`([^`]+)`/g, (_, c) => cmd(c)))
    },
  })

  term.register({
    name: 'projects', aliases: ['p'],
    desc: () => (fr() ? 'les projets, un par planète' : 'projects, one per planet'),
    run: () => {
      T(dim(t('term.projects')))
      projects.forEach((p, i) => T(`  ${dim(String(i + 1))} ${cmd(p.name.padEnd(18, ' '), `goto ${p.id}`)} ${esc(L(p.summary))}`))
    },
  })

  term.register({
    name: 'goto', aliases: ['cd', 'warp', 'fly'],
    desc: () => (fr() ? 'voler vers un corps céleste' : 'fly to a celestial body'),
    run: args => {
      if (args[0] === 'projects' || args[0] === 'projects/') { term.setHost(term.host, '~/projects'); return }
      if (args[0] === '..' ) { term.setHost(term.host, '~'); return }
      if (args[0]?.startsWith('projects/')) args[0] = args[0].slice(9)
      gotoArg(args[0] ?? 'home')
    },
    complete: () => [...bodyIds(), 'next', 'prev', 'projects/'],
  })
  term.register({ name: 'next', aliases: ['n'], hidden: true, run: () => gotoArg('next') })
  term.register({ name: 'prev', aliases: ['previous'], hidden: true, run: () => gotoArg('prev') })

  term.register({
    name: 'ls',
    desc: () => (fr() ? 'lister les fichiers' : 'list files'),
    run: args => {
      const all = args.includes('-a') || args.includes('-la')
      const path = args.find(a => !a.startsWith('-')) ?? term.cwd
      if (path.includes('projects')) {
        T(projects.map(p => cmd(`${p.id}/`, `goto ${p.id}`)).join('  '))
      } else {
        T([cmd('about.md', 'cat about.md'), cmd('projects/', 'projects'), cmd('skills.json', 'skills'), cmd('contact.txt', 'contact'), all ? cmd('.secrets', 'cat .secrets') : ''].filter(Boolean).join('  '))
      }
    },
  })

  term.register({
    name: 'cat', aliases: ['less', 'bat'],
    desc: () => (fr() ? 'afficher un fichier' : 'print a file'),
    run: args => {
      const f = (args[0] ?? '').replace(/^~\//, '').replace(/^projects\//, '')
      if (f === 'about.md') return term.exec('about')
      if (f === 'skills.json') return term.exec('skills')
      if (f === 'contact.txt') return term.exec('contact')
      if (f === '.secrets') { T(md(t('term.secret'))); return }
      const p = findProject(f.replace(/\/$/, ''))
      if (p) { term.lines(projectCard(p)); return }
      T(warn(`cat: ${f || '?'}: ${fr() ? 'fichier introuvable' : 'no such file'}`))
    },
    complete: () => ['about.md', 'skills.json', 'contact.txt', '.secrets', ...projects.map(p => `projects/${p.id}`)],
  })

  term.register({
    name: 'open',
    desc: () => (fr() ? 'ouvrir le dépôt GitHub' : 'open GitHub repository'),
    run: args => {
      const q = args[0] ?? world.bodies[world.current].id
      if (q === 'github' || q === 'luna' || q === 'home') { T(`${t('term.opening')} ${link(profile.github)}`); open(profile.github, '_blank', 'noopener'); return }
      const p = findProject(q)
      if (!p) { T(warn(`${t('term.nobody')} "${q}".`)); return }
      if (!p.repo) { T(warn(t('term.norepo'))); return }
      T(`${t('term.opening')} ${link(p.repo)}`)
      open(p.repo, '_blank', 'noopener')
    },
    complete: () => ['github', ...projects.filter(p => p.repo).map(p => p.id)],
  })

  term.register({
    name: 'skills', aliases: ['stack'],
    desc: () => (fr() ? 'technos que j’utilise' : 'tech I use'),
    run: () => {
      T(dim('skills.json'))
      const groups = Object.entries(skills)
      groups.forEach(([g, list], i) => {
        const last = i === groups.length - 1
        T(`${dim(last ? '└──' : '├──')} ${acc(g)}`)
        T(`${dim(last ? '    ' : '│   ')}${list.map(s => `<span class="tag">${esc(s)}</span>`).join(' ')}`)
      })
    },
  })

  term.register({
    name: 'contact',
    desc: () => (fr() ? 'me contacter' : 'get in touch'),
    run: () => term.lines([
      dim(t('term.contact')),
      `  github  ${link(profile.github, `github.com/${profile.githubUser}`)}`,
    ]),
  })

  term.register({
    name: 'neofetch', aliases: ['fastfetch'],
    desc: () => (fr() ? 'infos système' : 'system info'),
    run: () => {
      const moon = asciiMoon()
      const up = Math.floor(performance.now() / 1000)
      const info = [
        `${acc(profile.handle.toLowerCase())}@${acc('luna')}`,
        dim('─'.repeat(22)),
        `${acc('Name')}: ${esc(profile.name)}`,
        `${acc('Role')}: ${esc(L(profile.role))}`,
        `${acc('OS')}: ExLunaOS 1.0 (three.js)`,
        `${acc('Host')}: ${esc(profile.location)}`,
        `${acc('Shell')}: exsh`,
        `${acc('Uptime')}: ${Math.floor(up / 60)}m ${up % 60}s`,
        `${acc('Resolution')}: ${innerWidth}x${innerHeight}`,
        `${acc('Theme')}: ${app.theme} · ascii ${world.ascii.enabled ? 'on' : 'off'}`,
        `${acc('Lang')}: ${lang()}`,
        `${acc('Languages')}: ${skills.languages.join(', ')}`,
        '',
        Object.values(THEMES).map(c => `<span style="color:${c}">███</span>`).join(''),
      ]
      const rows = Math.max(moon.length, info.length)
      for (let i = 0; i < rows; i++) T(`<span class="acc">${esc(moon[i] ?? ' '.repeat(26))}</span>  ${info[i] ?? ''}`)
    },
  })

  term.register({
    name: 'keys', aliases: ['shortcuts'],
    desc: () => (fr() ? 'raccourcis façon Neovim' : 'Neovim-style shortcuts'),
    run: () => {
      const rows: Array<[string, string, string]> = [
        ['j / k  ← →', 'corps suivant / précédent', 'next / previous body'],
        ['h / l', 'tourner autour', 'orbit around'],
        ['+ / -', 'zoom', 'zoom'],
        ['gg / G', 'accueil / dernier', 'home / last'],
        [`0 … ${projects.length}`, 'aller au corps n°', 'jump to body #'],
        [':', 'ligne de commande (:goto, :q, :set lang=en)', 'command line (:goto, :q, :set lang=en)'],
        ['/', 'chercher un projet (n : suivant)', 'search a project (n: next)'],
        ['o', 'ouvrir le dépôt', 'open repository'],
        ['i  t  `', 'entrer dans le terminal', 'focus the terminal'],
        ['Esc', 'revenir au mode NORMAL', 'back to NORMAL mode'],
        ['a', 'basculer le rendu ASCII', 'toggle ASCII rendering'],
      ]
      T(dim(t('term.vim')))
      rows.forEach(([k, f, e]) => T(`  ${acc(k.padEnd(12, ' '))} ${esc(fr() ? f : e)}`))
    },
  })

  term.register({
    name: 'lang', aliases: ['language'],
    desc: () => 'fr | en',
    run: args => {
      const l = args[0]?.toLowerCase()
      setLang(l === 'fr' || l === 'en' ? l : lang() === 'fr' ? 'en' : 'fr')
      T(t('term.lang'))
    },
    complete: () => ['fr', 'en'],
  })

  term.register({
    name: 'theme',
    desc: () => Object.keys(THEMES).join(' | '),
    run: args => {
      const name = args[0] as ThemeName
      if (!(name in THEMES)) { T(Object.keys(THEMES).map(k => cmd(k, `theme ${k}`)).join('  ')); return }
      app.setTheme(name)
      T(`${t('term.theme')} ${acc(name)}`)
    },
    complete: () => Object.keys(THEMES),
  })

  term.register({
    name: 'ascii',
    desc: () => 'on | off | size <5-16> | color <0-1>',
    run: args => {
      const [sub, val] = args
      if (sub === 'off' || (!sub && world.ascii.enabled)) { world.ascii.enabled = false; T(t('term.ascii.off')); return }
      if (sub === 'on' || !sub) { world.ascii.enabled = true; T(t('term.ascii.on')); return }
      if (sub === 'size') {
        const n = Math.round(Math.min(16, Math.max(5, Number(val) || 8)))
        world.ascii.setCellSize(n)
        T(`${t('term.ascii.size')} ${n}px`)
        return
      }
      if (sub === 'color') { world.ascii.setColorMix(Math.min(1, Math.max(0, Number(val) || 0))); return }
      T(md('usage: `ascii on` `ascii off` `ascii size 6` `ascii color 0.8`'))
    },
    complete: a => (a.length <= 1 ? ['on', 'off', 'size', 'color'] : []),
  })

  term.register({
    name: 'set', hidden: true,
    run: args => {
      for (const a of args) {
        const [k, v] = a.split('=')
        if (k === 'lang') term.exec(`lang ${v}`)
        else if (k === 'theme') term.exec(`theme ${v}`)
        else if (k === 'ascii' || k === 'noascii') term.exec(`ascii ${k === 'noascii' ? 'off' : v ?? 'on'}`)
        else T(warn(`E518: Unknown option: ${k}`))
      }
    },
  })

  term.register({ name: 'clear', aliases: ['cls'], desc: () => (fr() ? 'effacer l’écran' : 'clear the screen'), run: () => term.clear() })
  term.register({
    name: 'history', hidden: true,
    run: () => term.getHistory().forEach((h, i) => T(`${dim(String(i + 1).padStart(4, ' '))}  ${cmd(h)}`)),
  })
  term.register({ name: 'echo', hidden: true, run: args => T(esc(args.join(' '))) })
  term.register({ name: 'pwd', hidden: true, run: () => T(esc(term.cwd.replace('~', '/home/exluna'))) })
  term.register({ name: 'date', hidden: true, run: () => T(esc(new Date().toString())) })
  term.register({ name: 'uname', hidden: true, run: () => T('ExLunaOS luna 1.0.0 three.js WebGL2 x86_64 GNU/Lune') })
  term.register({ name: 'sudo', hidden: true, run: () => T(warn(t('term.sudo'))) })
  term.register({ name: 'rm', hidden: true, run: () => T(warn(t('term.rm'))) })
  term.register({ name: 'exit', aliases: ['logout', ':q', 'q', 'quit'], hidden: true, run: () => { T(dim(t('term.exit'))); app.setTerminal('min') } })
  term.register({ name: 'sha-warma', aliases: ['shawarma', 'kebab'], hidden: true, run: () => T(acc('🥙 ' + t('term.shawarma'))) })
  term.register({ name: 'reboot', hidden: true, run: () => app.reboot() })
  term.register({ name: 'nvim', aliases: ['vi', 'vim', 'emacs', 'nano'], hidden: true, run: (_a, raw) => {
    if (raw.startsWith('emacs') || raw.startsWith('nano')) T(warn(fr() ? 'Ici on est sur Neovim. Essaie `keys`.' : 'Neovim house here. Try `keys`.'))
    else term.exec('keys')
  } })
  term.register({
    name: 'ping', hidden: true,
    run: async args => {
      const host = args[0] ?? 'luna'
      T(`PING ${esc(host)} (384.400 km): 56 data bytes`)
      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 400))
        T(`64 bytes from ${esc(host)}: icmp_seq=${i} ttl=64 time=${(2564 + Math.random() * 12).toFixed(1)} ms`)
      }
    },
  })

  term.onMissing = name => {
    const names = term.list().map(c => c.name)
    const guess = names.find(n => n.startsWith(name.slice(0, 2).toLowerCase()))
    T(`${warn(`exsh: ${esc(name)}: ${t('term.notfound')}`)}${guess ? ` — ${t('term.suggest')} ${cmd(guess)}` : ` — ${cmd('help')}`}`)
  }
}
