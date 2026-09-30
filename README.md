# ExLuna-rs — portfolio

Portfolio de **Corentin Janson** (ExLuna-rs) : un petit système solaire Three.js rendu en ASCII
en temps réel, piloté par un terminal et des raccourcis façon Neovim.

## Lancer

```bash
bun install
bun run dev      # http://localhost:5173
bun run build    # sortie dans dist/
```

Un push sur `main` déploie automatiquement sur GitHub Pages (`.github/workflows/deploy.yml`).

## Naviguer

| Pour tout le monde | Façon Neovim |
|---|---|
| Boutons du haut, étiquettes des planètes, flèches ‹ › | `j`/`k` corps suivant/précédent, `gg`/`G`, `0`…`3` |
| Glisser pour orbiter, molette pour zoomer | `h`/`l` orbite, `+`/`-` zoom |
| Commandes cliquables dans le terminal | `:goto g-lib`, `:set lang=en`, `:q`, `/recherche` puis `n` |

Liens directs : `/#g-lib`, `/#herdr`, `/#ascii-cosmos`.

## Modifier le contenu

Tout le texte (profil, projets, compétences) est dans [`src/content.ts`](src/content.ts).
Ajouter un projet = ajouter une entrée + sa position dans `PLACEMENT` (`src/scene/world.ts`).

## Structure

- `src/scene/ascii.ts` — post-process : la scène est rendue dans une texture puis convertie en
  glyphes avec la rampe `" .'`:-~=+*o#%&@"` de moon.py
- `src/scene/textures.ts` — lune procédurale (cratères, mers, un mot gravé), planètes, anneaux
- `src/scene/world.ts` — scène, caméra, vols entre les corps
- `src/terminal/` — terminal (historique, complétion Tab) et commandes
- `src/nav.ts` — modes NORMAL / COMMANDE / RECHERCHE, statusline, étiquettes, barre de nav
