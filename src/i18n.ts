import type { Lang } from './content'

const dict = {
  'nav.home': { fr: 'Accueil', en: 'Home' },
  'nav.projects': { fr: 'Projets', en: 'Projects' },
  'nav.about': { fr: 'À propos', en: 'About' },
  'nav.contact': { fr: 'Contact', en: 'Contact' },
  'nav.terminal': { fr: 'Terminal', en: 'Terminal' },
  'nav.prev': { fr: 'Précédent', en: 'Previous' },
  'nav.next': { fr: 'Suivant', en: 'Next' },
  'hint.mouse': { fr: 'glisser : orbiter · molette : zoom · clic : planète', en: 'drag: orbit · wheel: zoom · click: planet' },
  'hint.keys': { fr: 'j/k : naviguer · : commande · ? aide', en: 'j/k: navigate · : command · ? help' },
  'boot.skip': { fr: 'appuie sur une touche pour passer', en: 'press any key to skip' },
  'term.welcome': {
    fr: 'Bienvenue sur ExLunaOS. Tape `help` ou clique sur une commande.',
    en: 'Welcome to ExLunaOS. Type `help` or click a command.',
  },
  'term.notfound': { fr: 'commande introuvable', en: 'command not found' },
  'term.suggest': { fr: 'Essaie', en: 'Try' },
  'term.nobody': { fr: 'Aucun corps céleste nommé', en: 'No celestial body named' },
  'term.flying': { fr: 'Trajectoire calculée. Cap sur', en: 'Trajectory locked. Heading to' },
  'term.opening': { fr: 'Ouverture de', en: 'Opening' },
  'term.norepo': { fr: 'Ce projet n’a pas de dépôt public.', en: 'This project has no public repository.' },
  'term.lang': { fr: 'Langue : français.', en: 'Language: English.' },
  'term.theme': { fr: 'Thème appliqué :', en: 'Theme applied:' },
  'term.sudo': { fr: 'Bien essayé. Cet incident sera signalé à la Lune.', en: 'Nice try. This incident will be reported to the Moon.' },
  'term.exit': { fr: 'On ne quitte pas l’orbite si facilement.', en: 'You don’t leave orbit that easily.' },
  'term.rm': { fr: 'Permission refusée : la Lune est en lecture seule.', en: 'Permission denied: the Moon is read-only.' },
  'term.shawarma': { fr: 'Commande reçue. Sauce blanche ou samouraï ?', en: 'Order received. Garlic or harissa sauce?' },
  'term.ascii.on': { fr: 'Rendu ASCII activé.', en: 'ASCII rendering enabled.' },
  'term.ascii.off': { fr: 'Rendu ASCII désactivé. Voilà la vraie géométrie.', en: 'ASCII rendering disabled. Here is the raw geometry.' },
  'term.ascii.size': { fr: 'Taille des cellules :', en: 'Cell size:' },
  'term.contact': { fr: 'Le meilleur moyen de me joindre :', en: 'Best way to reach me:' },
  'term.projects': { fr: 'Corps célestes en orbite (clique ou `goto <nom>`) :', en: 'Bodies in orbit (click or `goto <name>`):' },
  'term.vim': { fr: 'Raccourcis clavier (mode NORMAL, hors terminal) :', en: 'Keyboard shortcuts (NORMAL mode, outside the terminal):' },
  'term.secret': {
    fr: 'Indice : dans moon.py, un mot est gravé dans le relief. Ici aussi. Cherche du côté de la mer.',
    en: 'Hint: in moon.py, a word is carved into the relief. Here too. Look near the sea.',
  },
  'status.normal': { fr: 'NORMAL', en: 'NORMAL' },
  'status.command': { fr: 'COMMANDE', en: 'COMMAND' },
  'status.search': { fr: 'RECHERCHE', en: 'SEARCH' },
  'status.insert': { fr: 'TERMINAL', en: 'TERMINAL' },
  'body.home': { fr: 'Luna — accueil', en: 'Luna — home' },
} satisfies Record<string, Record<Lang, string>>

export type Key = keyof typeof dict

let current: Lang = detect()
const listeners = new Set<(l: Lang) => void>()

function detect(): Lang {
  try {
    const saved = localStorage.getItem('exluna.lang')
    if (saved === 'fr' || saved === 'en') return saved
  } catch { /* storage blocked */ }
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

export const lang = () => current
export const t = (key: Key) => dict[key][current]

export function setLang(l: Lang) {
  current = l
  document.documentElement.lang = l
  try { localStorage.setItem('exluna.lang', l) } catch { /* storage blocked */ }
  listeners.forEach(fn => fn(l))
}

export const onLang = (fn: (l: Lang) => void) => listeners.add(fn)
