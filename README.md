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

### Projets automatiques

Chaque build (`scripts/sync-repos.ts`) récupère les dépôts publics de `ExLuna-rs` via l'API
GitHub dans `src/generated/repos.json`. Tout dépôt public qui n'a pas de fiche écrite à la main
devient une planète (apparence et orbite dérivées de son nom) avec sa description, son langage
et ses topics. Le site est reconstruit chaque nuit, ou à la main via *Actions → Run workflow*.

- Masquer un dépôt : lui ajouter le topic GitHub `no-portfolio`.
- Soigner une fiche : l'ajouter dans `curated` (`src/content.ts`) avec `repo` = l'URL du dépôt ;
  elle remplace alors la fiche automatique.
- Forks, dépôts archivés et privés sont ignorés. `bun run sync` rafraîchit la liste en local.

## Structure

- `src/scene/ascii.ts` — post-process : la scène est rendue dans une texture puis convertie en
  glyphes avec la rampe `" .'`:-~=+*o#%&@"` de moon.py
- `src/scene/textures.ts` — lune procédurale (cratères, mers, un mot gravé), planètes, anneaux
- `src/scene/world.ts` — scène, caméra, vols entre les corps
- `src/terminal/` — terminal (historique, complétion Tab) et commandes
- `src/nav.ts` — modes NORMAL / COMMANDE / RECHERCHE, statusline, étiquettes, barre de nav
