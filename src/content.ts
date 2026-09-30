// All portfolio content lives here. Edit freely: the terminal, the HUD and the
// navigation bar are generated from this file.

export type Lang = 'fr' | 'en'
export type L10n = Record<Lang, string>

export const profile = {
  name: 'Corentin Janson',
  handle: 'ExLuna-rs',
  github: 'https://github.com/ExLuna-rs',
  githubUser: 'ExLuna-rs',
  location: 'baguette Land',
  role: { fr: 'Ingénieur IT', en: 'IT engineer' } as L10n,
  tagline: {
    fr: 'Robotique industrielle, apps desktop, rendu 3D — et tout ce qui tourne dans un terminal.',
    en: 'Industrial robotics, desktop apps, 3D rendering — and anything that runs in a terminal.',
  } as L10n,
  about: {
    fr: [
      "Salut, moi c'est Corentin Janson, alias ExLuna-rs.",
      "Ingénieur IT, je construis des outils qui vont du bas niveau (C++20, Rust) jusqu'à l'interface (Vue, React, Three.js).",
      'Mon terrain de jeu : la robotique industrielle, packager des apps desktop avec Tauri, et transformer des planètes en ASCII.',
      'Ce site est lui-même un projet : une scène Three.js rendue caractère par caractère, pilotable au clavier comme Neovim.',
    ],
    en: [
      "Hi, I'm Corentin Janson, aka ExLuna-rs.",
      'IT engineer building tools from the low level (C++20, Rust) up to the interface (Vue, React, Three.js).',
      'My playground: industrial robotics, shipping desktop apps with Tauri, and turning planets into ASCII.',
      'This site is a project of its own: a Three.js scene rendered character by character, driven from the keyboard like Neovim.',
    ],
  } as Record<Lang, string[]>,
}

export type BodyKind = 'moon' | 'ringed' | 'banded' | 'station' | 'rocky'

export interface Project {
  id: string
  name: string
  kind: BodyKind
  year: string
  stack: string[]
  repo?: string
  note?: L10n
  summary: L10n
  details: Record<Lang, string[]>
}

export const projects: Project[] = [
  {
    id: 'g-lib',
    name: 'G-Lib',
    kind: 'banded',
    year: '2026',
    stack: ['Tauri 2', 'Rust', 'React', 'TypeScript', 'Tailwind', 'Bun'],
    repo: 'https://github.com/ExLuna-rs/G-Lib',
    summary: {
      fr: 'Une seule bibliothèque pour tous tes jeux : Steam, Epic, EA et Ubisoft Connect.',
      en: 'One library for every game you own: Steam, Epic, EA and Ubisoft Connect.',
    },
    details: {
      fr: [
        'Scan 100 % local (fichiers + registre Windows) : aucun login, aucune API propriétaire.',
        'Temps de jeu mesuré en surveillant les processus, pour les quatre plateformes.',
        'Boutique intégrée avec comparateur de prix, palette Ctrl+K, liste d’amis Steam.',
      ],
      en: [
        '100% local scan (files + Windows registry): no login, no proprietary API.',
        'Playtime measured by watching processes, across all four platforms.',
        'Built-in store with price comparison, Ctrl+K palette, Steam friends list.',
      ],
    },
  },
  {
    id: 'herdr',
    name: 'herdr-auto-layout',
    kind: 'station',
    year: '2026',
    stack: ['Rust', 'YAML'],
    repo: 'https://github.com/ExLuna-rs/herdr-auto-layout',
    summary: {
      fr: 'Plugin herdr multiplateforme : des layouts déclaratifs appliqués à chaque nouveau workspace.',
      en: 'Cross-platform herdr plugin: declarative layouts applied to every new workspace.',
    },
    details: {
      fr: [
        'Réagit à `workspace.created` : onglets, panes et commandes posés automatiquement.',
        'Config YAML, layouts différents selon le dossier du projet.',
        'Lance des agents (Claude, Codex…) avec leurs arguments dans les bons panes.',
      ],
      en: [
        'Hooks into `workspace.created`: tabs, panes and commands laid out automatically.',
        'YAML config, different layouts per project directory.',
        'Starts agents (Claude, Codex…) with their arguments in the right panes.',
      ],
    },
  },
  {
    id: 'ascii-cosmos',
    name: 'ascii-cosmos',
    kind: 'ringed',
    year: '2026',
    stack: ['Python'],
    summary: {
      fr: "Des rendus de la Lune, de Saturne et d'avatars en pur ASCII — l'ancêtre de ce site.",
      en: 'Renders of the Moon, Saturn and avatars in pure ASCII — this site’s ancestor.',
    },
    details: {
      fr: [
        'Rendu procédural : cratères, terminateur, anneaux, et un mot caché dans le relief.',
        'La rampe de caractères " .\'`:-~=+*o#%&@" utilisée ici vient directement de moon.py.',
        'Export texte, PNG et HTML haute définition.',
      ],
      en: [
        'Procedural rendering: craters, terminator, rings, and a word hidden in the relief.',
        'The " .\'`:-~=+*o#%&@" character ramp used here comes straight from moon.py.',
        'Text, PNG and high-definition HTML export.',
      ],
    },
  },
]

export const skills: Record<string, string[]> = {
  languages: ['Rust', 'C++20', 'TypeScript', 'Python'],
  frontend: ['Vue 3', 'React', 'Next.js', 'Tailwind CSS', 'Three.js'],
  'desktop & infra': ['Tauri', 'Docker', 'WebSockets', 'CMake', 'Prisma'],
  robotics: ['OMPL', 'Bullet', 'Eigen', 'NLopt', 'URDF'],
}
