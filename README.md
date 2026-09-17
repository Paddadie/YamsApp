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
npm test         # vitest : logique de score, Hall of Fame, dates, noms
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
| `settings.html` | Trois sections au choix : règles, joueurs/scores, sauvegarde | `src/pages/settings.ts` |

### L'écran de jeu

- On change de joueur avec les flèches **ou en balayant l'écran**. Le geste
  n'est reconnu qu'au doigt (`pointerType` ≠ souris, où un glissement
  horizontal sert à sélectionner du texte), et `#game-screen` doit garder
  `touch-action: pan-y pinch-zoom` : sans ça le navigateur s'approprie le geste
  et le swipe ne se déclenche jamais.
- Les six lignes de la section chiffres portent une **face de dé dessinée en
  SVG** (`dieFace`) plutôt que le chiffre. Pas de caractère Unicode : les
  glyphes ⚀⚁⚂ sont rendus par la police emoji du système.
- **Indice de bonus** : quand il ne reste que quatre chiffres à remplir, la case
  du plus grand chiffre encore libre affiche en gris la combinaison de dés la
  plus probable pour atteindre 63 (voir `bonusPlan` plus bas). Désactivable dans
  les Paramètres.

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
- **préférences d'affichage** → `prefsRepo`. Délibérément **hors de
  `GameRules`** : les règles sont figées au lancement d'une partie, alors qu'un
  réglage d'affichage doit s'appliquer tout de suite. Lecture champ par champ,
  une préférence absente retombe sur son défaut.

Toutes les lectures de `localStorage` passent par un *guard* de forme
(`readJson(key, guard)`) : un contenu corrompu est ignoré plutôt que de faire
planter une page.

`storage/migrate.ts` met les données d'anciennes versions au format courant :
champ `rules` ajouté aux parties sauvegardées, `playerStats`
`{ [nom]: nombre }` → `{ games, classiqueGames, classiquePoints, classiqueBest }`,
dédoublonnage des noms connus (casse/espaces), entrées de Hall of Fame réparées. Les clés n'ont jamais
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

`bonusPlan(scores, grid)` renvoie, quand il reste au plus quatre chiffres à
remplir, la combinaison de dés **la plus probable** pour atteindre les 63 points
du bonus — ou, si le bonus est hors d'atteinte, le besoin littéral sur le plus
grand chiffre restant. Le classement des plans repose sur `DICE_ODDS`,
la probabilité d'obtenir au moins *k* dés d'un chiffre en un tour (trois
lancers, on garde les bons dés : `B(5, 1 − (5/6)³)`). Elle ne dépend pas du
chiffre visé, ce qui rend les plans comparables. À probabilité égale, le plan
qui demande le moins de dés ; à effort égal, celui qui rapporte le plus de
points — ce dernier départage n'est pas cosmétique, sans lui deux plans
strictement équivalents étaient choisis au hasard d'un arrondi.

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
à incrémenter à la main. La version affichée en haut à droite des Paramètres
vient de `package.json` (`__APP_VERSION__` injecté au build).

## Organisation de `src/`

| Chemin | Rôle |
|---|---|
| `bootstrap.ts` | Amorçage commun : migration des données + styles + service worker. |
| `nav.ts` | `goTo(page)` + table des fichiers HTML. |
| `types.ts` | Types du domaine (`Player`, `Variant`, `GameRules`, `SavedGame`, `ScoreEntry`…). |
| `playerName.ts` | Comparaison / tri des noms de joueurs (casse et espaces ignorés). |
| `dates.ts` | Affichage des dates du Hall of Fame (relatif jusqu'à 30 jours). |
| `state.ts` | Modèle de partie en mémoire + `createPlayers` / `hydrateGame` / `toSavedGame`. |
| `scoring.ts` | Grille + calculs + `normalizeRules`. Aucun DOM. |
| `hallOfFame.ts` | Intégration d'une partie terminée + prévisualisation. Aucun DOM. |
| `variants.ts` | Source unique des variantes (libellé, icône, couleur). |
| `ui.ts` | Helpers DOM (`requireEl`, `renderTable`, `makeActivatable`, `variantBadge`). |
| `pages/*.ts` | Un module par page : câblage DOM. |
| `pwa/updatePrompt.ts` | Enregistrement du SW + bandeau « Mettre à jour ». |
| `storage/` | `keys.ts`, `localStore.ts` (avec guards), et un repo typé par usage : `draftRepo`, `savedGameRepo`, `rulesRepo`, `knownPlayersRepo`, `playerStatsRepo`, `hallOfFameRepo`, `prefsRepo`, `backup`. |

Règle de dépendances : les modules `pages/*` s'appuient sur `state`, `scoring`,
`variants`, `ui`, `storage/*` — jamais l'inverse.

## Tests

`npm test` (Vitest) couvre la logique pure, celle qui n'a pas de DOM et qui
casserait silencieusement : barème et bornes des règles (`scoring.ts`),
verrous Montante/Descendante, classements du Hall of Fame — dont l'invariant
« la prévisualisation de l'écran de fin annonce exactement ce qui sera
enregistré » —, plans de bonus (`bonusPlan` : seuil de déclenchement, reste
épars, ligne inutile omise, cas hors d'atteinte), formatage des dates et
comparaison des noms.
`src/test/setup.ts` fournit un `localStorage` en mémoire : pas besoin de jsdom.
Les tests tournent aussi en CI avant le déploiement.
