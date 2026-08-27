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
| `index.html` | Accueil : variantes, reprise, Hall of Fame, ⚙️ | `src/pages/home.ts` |
| `players.html` | Joueurs de la partie (liste à cocher + stats de tri) | `src/pages/players.ts` |
| `game.html` | Jeu : grille de score du joueur courant | `src/pages/game.ts` |
| `end.html` | Podium, classement, impact Hall of Fame | `src/pages/end.ts` |
| `hall.html` | Meilleurs / pires scores (cliquables) + statistiques | `src/pages/hall.ts` |
| `settings.html` | Règles configurables + export/import + version | `src/pages/settings.ts` |

### Navigation

- Une navigation **sans effet de bord** = un simple `<a href>` dans le HTML
  (fonctionne même avant le chargement du JS) : Retour, Hall of Fame, ⚙️.
- `goTo(page)` (`src/nav.ts`) n'est utilisé que **après une écriture**
  (brouillon enregistré, partie lancée, partie quittée…).

### État (tout via `localStorage`, aucun état en mémoire entre les pages)

- **avant‑partie** (variantes + noms) → `draftRepo`
- **partie en cours** → `savedGameRepo`, ré‑enregistrée après chaque saisie ;
  `game.html` s'y réhydrate. Effacée seulement au clic sur « Quitter » (un
  rafraîchissement de `end.html` réaffiche donc le podium).
- **règles** → `rulesRepo` ; **copiées dans chaque partie au lancement**
  (`SavedGame.rules`), l'écran de jeu construit sa grille à partir de cette
  copie. Modifier les paramètres n'affecte que les parties suivantes.
- **Hall of Fame** (5 meilleurs / 5 pires par joueur×variante, avec la feuille
  de score détaillée) → `hallOfFameRepo`
- **stats par joueur** (parties jouées + cumul des scores → moyenne) →
  `playerStatsRepo`

Toutes les lectures de `localStorage` passent par un *guard* de forme
(`readJson(key, guard)`) : un contenu corrompu est ignoré plutôt que de faire
planter une page.

`storage/migrate.ts` met les données d'anciennes versions au format courant :
champ `rules` ajouté aux parties sauvegardées, `playerStats`
`{ [nom]: nombre }` → `{ games, points }`, dédoublonnage des noms connus
(casse/espaces), entrées de Hall of Fame réparées. Les clés n'ont jamais
changé : **non destructif**, rien n'est perdu (on ne supprime que du JSON
illisible). Exécuté **une fois par version** (marqueur `yams-schema-version`) :
les lancements suivants ne font qu'une lecture. Un import de sauvegarde efface
le marqueur pour re-normaliser au lancement d'après.

## Règles configurables (`scoring.ts`)

`scoring.ts` n'a **pas** de grille figée. `buildGrid(rules)` renvoie les
sections actives, les libellés des lignes (`Brelan (Σ)` ou `Brelan (30)`…) et
leurs valeurs possibles. Toutes les fonctions de calcul prennent cette grille :

- `computeDerived(scores, grid)` — **pur**, renvoie bonus / totaux / score final.
- `writeDerived(scores, grid)` — recopie ces valeurs dans `scores` (persistance).
- `isLineEnabled` (verrous Montante/Descendante), `isGameFinished`.

`normalizeRules(raw)` complète / borne / répare n'importe quel objet de règles
(ancien format, valeurs absurdes). Bornes : points de ligne `0–150`, bonus
`0–100`.

## Déploiement

Push sur `main` → [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
build et publie `dist/` sur GitHub Pages (`https://paddadie.github.io/YamsApp/`).

> Réglage unique dans le repo : **Settings → Pages → Source = GitHub Actions**.

`base: '/YamsApp/'` dans [`vite.config.ts`](vite.config.ts) doit correspondre au
nom du repo ; les 6 pages y sont déclarées comme points d'entrée.

## Mise à jour de l'app

`vite-plugin-pwa` précache toutes les pages + le JS/CSS. Au chargement suivant
un déploiement, [`src/pwa/updatePrompt.ts`](src/pwa/updatePrompt.ts) affiche un
bandeau **« Mettre à jour »** ; l'utilisateur choisit le moment. Aucune version
à incrémenter à la main. La version affichée en bas des Paramètres vient de
`package.json` (`__APP_VERSION__` injecté au build).

## Organisation de `src/`

| Chemin | Rôle |
|---|---|
| `bootstrap.ts` | Amorçage commun : migration des données + styles + service worker. |
| `nav.ts` | `goTo(page)` + table des fichiers HTML. |
| `types.ts` | Types du domaine (`Player`, `Variant`, `GameRules`, `SavedGame`, `ScoreEntry`…). |
| `state.ts` | Modèle de partie en mémoire + `createPlayers` / `hydrateGame` / `toSavedGame`. |
| `scoring.ts` | Grille + calculs + `normalizeRules`. Aucun DOM. |
| `hallOfFame.ts` | Intégration d'une partie terminée + prévisualisation. Aucun DOM. |
| `variants.ts` | Source unique des variantes (libellé, icône, couleur). |
| `ui.ts` | Helpers DOM (`requireEl`, `appendRows`, `renderTable`). |
| `pages/*.ts` | Un module par page : câblage DOM. |
| `pwa/updatePrompt.ts` | Enregistrement du SW + bandeau « Mettre à jour ». |
| `storage/` | `keys.ts`, `localStore.ts` (avec guards), et un repo typé par usage : `draftRepo`, `savedGameRepo`, `rulesRepo`, `knownPlayersRepo`, `playerStatsRepo`, `hallOfFameRepo`, `backup`. |

Règle de dépendances : les modules `pages/*` s'appuient sur `state`, `scoring`,
`variants`, `ui`, `storage/*` — jamais l'inverse.
