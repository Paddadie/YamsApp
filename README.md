# Yams

Application de **feuille de score de Yams** — PWA installable, hors‑ligne, sans
back‑end. Les données restent sur l'appareil (`localStorage`).

Stack : **Vite + TypeScript**, vanilla (pas de framework), `vite-plugin-pwa`
pour le service worker et le bandeau de mise à jour.

## Démarrer

```bash
npm install
npm run dev      # serveur de dev sur http://localhost:5173/YamsApp/
npm run build    # tsc -b + vite build -> dist/
npm run preview  # sert le dist/ compilé
```

## Déploiement

Push sur `main` → le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
build et publie `dist/` sur GitHub Pages (`https://paddadie.github.io/YamsApp/`).

> Réglage unique à faire dans le repo : **Settings → Pages → Build and deployment
> → Source = GitHub Actions**.

`base: '/YamsApp/'` dans [`vite.config.ts`](vite.config.ts) doit correspondre au
nom du repo.

## Mise à jour de l'app

`vite-plugin-pwa` précache tout le `dist/`. Au prochain chargement après un
déploiement, [`src/pwa/updatePrompt.ts`](src/pwa/updatePrompt.ts) détecte la
nouvelle version et affiche un bandeau **« Mettre à jour »** ; l'utilisateur
choisit le moment (un rechargement forcé pourrait couper une partie).
Aucun numéro de version à incrémenter à la main — c'est le hash du contenu qui
fait foi. La version affichée en bas du Hall of Fame vient de `package.json`
(constante `__APP_VERSION__` injectée au build).

## Organisation de `src/`

| Chemin | Rôle |
|---|---|
| `main.ts` | Point d'entrée : enregistre le SW puis appelle les `init*()`. |
| `types.ts` | Types du domaine (`Player`, `Variant`, `SavedGame`, `ScoreEntry`…). |
| `state.ts` | Modèle de la partie (`game`) + mutations (`addPlayer`, `resetPlayersScores`…). |
| `scoring.ts` | Règles du Yams : sections et calculs. Aucun DOM. |
| `variants.ts` | Source unique des variantes (libellé, icône, défaut). |
| `ui.ts` | Helpers DOM partagés (`requireEl`, `renderList`, `renderTable`). |
| `navigation.ts` | `showScreen()` + boutons transverses. |
| `screens/home.ts` | Écran d'accueil (cases de variantes générées, lancement). |
| `screens/players.ts` | Écran d'ajout des joueurs. |
| `screens/game.ts` | Écran de jeu : grille, navigation joueurs, sauvegarde/reprise. |
| `screens/endScreen.ts` | Podium et classement final. |
| `screens/hallOfFame.ts` | Meilleurs/pires scores + export/import de sauvegarde. |
| `pwa/updatePrompt.ts` | Enregistrement du SW + bandeau « Mettre à jour ». |
| `storage/` | Persistance. `keys.ts` (clés), `localStore.ts` (accès bas niveau), un repo typé par entité (`savedGameRepo`, `knownPlayersRepo`, `hallOfFameRepo`), `backup.ts` (export/import JSON). |

Règle de dépendances : les modules d'écran s'appuient sur `state`, `scoring`,
`variants`, `ui` et `storage/*`, jamais l'inverse.

## Un seul écran visible à la fois

Chaque `<div class="screen">` reçoit `.active` via `showScreen()` ; le CSS gère
l'affichage (`.screen` / `.screen.active`). Le JS ne touche jamais à `display`.
