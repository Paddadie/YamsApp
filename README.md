# Yams

Application de **feuille de score de Yams** — PWA installable, hors‑ligne, sans
back‑end. Les données restent sur l'appareil (`localStorage`).

Stack : **Vite + TypeScript**, vanilla (pas de framework), **multi‑pages**
(un fichier HTML par écran), `vite-plugin-pwa` pour le service worker et le
bandeau de mise à jour.

## Démarrer

```bash
npm install
npm run dev      # http://localhost:5173/YamsApp/
npm run build    # tsc -b + vite build -> dist/
npm run preview  # sert le dist/ compilé
```

## Les pages

| Fichier | Écran | Entrée TS |
|---|---|---|
| `index.html` | Accueil : variantes, reprise, Hall of Fame | `src/pages/home.ts` |
| `players.html` | Ajout des joueurs | `src/pages/players.ts` |
| `game.html` | Jeu : grille de score | `src/pages/game.ts` |
| `end.html` | Podium et classement | `src/pages/end.ts` |
| `hall.html` | Hall of Fame + export/import | `src/pages/hall.ts` |

La navigation est un **vrai changement de page** (`src/nav.ts` → `goTo(...)`).
Comme il n'y a plus d'état en mémoire entre les écrans, tout transite par
`localStorage` :

- **avant‑partie** (variantes + noms choisis) → `src/storage/draftRepo.ts`
- **partie en cours** → `src/storage/savedGameRepo.ts`, ré‑enregistrée après
  chaque saisie ; `game.html` s'y réhydrate à son chargement
- `end.html` lit la partie terminée, l'efface, puis l'ajoute au Hall of Fame
  quand on quitte

Chaque page vérifie sa précondition au chargement (pas de brouillon → retour
accueil, pas de partie → retour accueil).

## Déploiement

Push sur `main` → [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
build et publie `dist/` sur GitHub Pages (`https://paddadie.github.io/YamsApp/`).

> Réglage unique dans le repo : **Settings → Pages → Source = GitHub Actions**.

`base: '/YamsApp/'` dans [`vite.config.ts`](vite.config.ts) doit correspondre au
nom du repo. Les cinq pages y sont déclarées comme points d'entrée.

## Mise à jour de l'app

`vite-plugin-pwa` précache les cinq pages + le JS/CSS. Au chargement suivant un
déploiement, [`src/pwa/updatePrompt.ts`](src/pwa/updatePrompt.ts) détecte la
nouvelle version et affiche un bandeau **« Mettre à jour »** ; l'utilisateur
choisit le moment. Aucune version à incrémenter à la main. La version affichée
en bas du Hall of Fame vient de `package.json` (`__APP_VERSION__` au build).

## Organisation de `src/`

| Chemin | Rôle |
|---|---|
| `bootstrap.ts` | Amorçage commun : styles + enregistrement du service worker. |
| `nav.ts` | `goTo(page)` — navigation entre les fichiers HTML. |
| `types.ts` | Types du domaine (`Player`, `Variant`, `SavedGame`, `ScoreEntry`…). |
| `state.ts` | Modèle de partie en mémoire + `createPlayers` / `hydrateGame` / `toSavedGame`. |
| `scoring.ts` | Règles du Yams : sections et calculs. Aucun DOM. |
| `hallOfFame.ts` | Intégration d'une partie terminée dans les tops. Aucun DOM. |
| `variants.ts` | Source unique des variantes. |
| `ui.ts` | Helpers DOM (`requireEl`, `renderList`, `renderTable`). |
| `pages/*.ts` | Un module par page : câblage DOM + navigation. |
| `pwa/updatePrompt.ts` | Enregistrement du SW + bandeau « Mettre à jour ». |
| `storage/` | `keys.ts`, `localStore.ts`, et un repo typé par usage : `draftRepo`, `savedGameRepo`, `knownPlayersRepo`, `hallOfFameRepo`, `backup`. |

Règle de dépendances : les modules `pages/*` s'appuient sur `state`, `scoring`,
`variants`, `ui`, `storage/*` — jamais l'inverse.
