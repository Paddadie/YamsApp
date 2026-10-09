# Cornet

**Feuilles de score pour jeux de dés** : le **Yams** et le **5000**. Application
web installable (PWA), utilisable hors ligne, **sans back‑end** : tout reste sur
l'appareil, dans `localStorage`.

Les **joueurs sont communs** à tous les jeux ; les **parties, classements et
records restent propres à chaque jeu**.

Stack : **Vite + TypeScript** strict, sans framework, **multi‑pages** (un
fichier HTML par écran), `vite-plugin-pwa` pour le service worker, Vitest pour
les tests.

## Démarrer

```bash
npm install
npm run dev         # http://localhost:5173/YamsApp/
npm test            # vitest (logique sans DOM : jeux, records, stockage)
npm run test:pages  # vitest + jsdom (écrans : chargement, gardes, parcours)
npm run build       # tsc -b + vite build -> dist/
npm run preview     # sert le dist/ compilé (avec service worker)
npm run check       # tsc -b + les deux suites de tests : à lancer avant de livrer
```

⚠️ Les tests ne vérifient pas les types : une erreur de typage ne sort qu'à
`tsc -b` (`npm run build`, qui vérifie aussi les tests de pages). `npm run
check` enchaîne les trois.

## Les pages

| Fichier | Écran | Entrée TS |
|---|---|---|
| `index.html` | Menu des jeux : une carte par jeu (avec un extrait de sa feuille), reprise d'une partie en cours, Paramètres, fenêtre « Installer Cornet » tant que l'appli n'est pas installée | `src/pages/home.ts` |
| `players.html` | Joueurs de la partie, **commun aux jeux** (liste à cocher, ordre en faisant glisser un joueur coché, mélange, « Mêmes joueurs » que la dernière partie ; un nom tient en 20 caractères) | `src/pages/players.ts` |
| `rules.html?game=…[&from=play]` | « ⓘ Règles » du jeu, générées depuis ses réglages | `src/pages/rules.ts` |
| `settings.html[?game=…]` | Paramètres : communs, plus ceux du jeu d'où l'on vient | `src/pages/settings.ts` |
| `yams.html` | Accueil du Yams : variantes, partie en cours, palmarès | `src/pages/yams/home.ts` |
| `yams-game.html[?review=1]` | Grille du joueur courant (ou consultation en fin de partie) | `src/pages/yams/game.ts` |
| `yams-end.html` | Podium, classement, impact sur le palmarès | `src/pages/yams/end.ts` |
| `yams-hall.html` | Meilleurs / pires scores (feuilles détaillées) et statistiques | `src/pages/yams/hall.ts` |
| `5000.html` | Accueil du 5000 : objectif, variantes, partie en cours, palmarès | `src/pages/g5000/home.ts` |
| `5000-game.html[?review=1]` | Feuille de progression, calculette et saisie manuelle (« les paliers ») dans un pupitre en bas, Bust rapide, dernier tour à corriger (ou consultation de la feuille en fin de partie) | `src/pages/g5000/game.ts` |
| `5000-end.html` | Podium, classement, records battus, « Revoir la feuille » | `src/pages/g5000/end.ts` |
| `5000-records.html[?from=end]` | Records du 5000 par objectif, classement des victoires | `src/pages/g5000/records.ts` |

## Architecture

```
htmlFragments.ts  <head> commun et pictogrammes (<!--@icon:nom-->), injectés au build
src/
├── core/        commun, ne connaît aucun jeu
│   ├── bootstrap · nav · ui · playerName · playerColors · dates · dice
│   │   illustrations (cornet du menu, dés des accueils)
│   │   iconPaths (tracés, sans DOM) · icons (SVG, tampons de rang)
│   │   format · ranking · swipe · wakeLock · storageAlert
│   │   pwa/ (updatePrompt : mise à jour · install : installer sur l'écran d'accueil)
│   └── storage/ localStore · keys · migrate · backup · persist · lastWinRepo
│                knownPlayersRepo · playerGamesRepo · draftRepo · installPromptRepo
├── games/
│   ├── registry.ts     LA liste des jeux
│   ├── types.ts        GameDef : ce qu'un jeu déclare au reste de l'appli
│   ├── playerAdmin.ts  renommer / supprimer un joueur partout
│   ├── yams/           scoring · hallOfFame · variants · variantBadge
│   │                   scoreSheet · players · rulesDoc · gameDef · types
│   │                   legacyLines · storage/
│   └── g5000/          rules · engine · records · recordLabels · rulesDoc
│                       variants · gameDef · repo · types
├── pages/       un module par écran (câblage DOM), + settings/, gameSwitcher,
│                gameTheme (encre et papier du jeu sur ses pages), g5000/
│                calculator et quickEntry (calculette et paliers, les deux saisies du 5000),
│                potText (ce qu'elles disent du pot), sheet (la feuille), targets (cibles Sniper),
│                gameHero (en-tête d'un accueil, extrait de feuille), targetOption
│                et endScreen (« Bravo … ! », confettis, lignes de record)
├── styles/      la feuille de style, par domaine (cf. Conventions)
└── test/        setup.ts (localStorage en mémoire) · pages/ (harnais jsdom)
```

**Règle de dépendance : `pages/` dépend du reste, jamais l'inverse.** Les
modules de calcul — `scoring`, `hallOfFame` (Yams), `rules`, `engine`,
`records` (5000) — n'ont **aucun accès au DOM** : c'est ce qui les rend
testables. `core/storage/migrate.ts` et `backup.ts` sont les deux seules
exceptions au « `core/` ne connaît aucun jeu » : migrer et sauvegarder, c'est
par nature connaître tous les formats.

**Le catalogue des jeux est abstrait, les jeux ne le sont pas.** `GameDef`
(`games/types.ts`) ne décrit que ce dont les écrans communs ont besoin :

- présentation (titre, emblème dessiné, encre du jeu, phrase d'accroche,
  extrait de feuille pour sa carte du menu) et pages d'accueil / de partie ;
- `rulesDoc({ inGame })` : les règles en données, construites depuis les réglages en
  vigueur (ceux de la partie en cours quand `inGame`) ; une section peut porter
  des **exemples en vrais dés** (`RulesExample`), dont le résultat est calculé
  par le barème du jeu (`handScore` au Yams, `bestValue` au 5000) ;
- `resume()`, `startGame()`, `clearSaved()` : partie en cours ; `resume()`
  donne aussi où elle en est (`progress` : « Tour 6 sur 13 », « Bob mène ·
  3 100 », et une jauge), affiché sur la carte « Partie en cours » du menu et
  de l'accueil ;
- `renamePlayer()`, `removePlayer()`, `playerNames()`, `describePlayer()` :
  administration des joueurs, partie en cours comprise. Les récapitulatifs
  sont des **données** (texte ou rangée de pastilles, `SummaryValue` de
  `core/ui`) que les écrans mettent en forme : un `gameDef` ne touche pas au
  DOM ;
- `storageKeys`, `savedGameKey`, `guards` : sauvegarde complète.

Rien n'y décrit comment on joue : `pages/yams/game.ts` importe
`games/yams/scoring.ts` directement. Il n'y a pas d'interface « moteur de jeu »
commune, et il ne doit pas y en avoir : la grille fermée du Yams et la
progression ouverte du 5000 n'ont rien à partager.

### Parcours d'une partie

1. **Accueil du jeu** → un brouillon (`draftRepo`) : le jeu visé, les joueurs,
   et une `config` que seul le jeu lit (variantes du Yams).
2. **`players.html`**, commun : on coche les joueurs, on fixe l'ordre. Lancer
   une partie alors qu'une autre est en cours demande confirmation.
3. **`GameDef.startGame`** convertit le brouillon en partie, **règles figées**
   (copiées dans la partie : changer les Paramètres n'affecte que les parties
   suivantes), et ouvre l'écran de jeu.
4. **Écran de jeu** : la partie est réécrite dans `localStorage` après chaque
   saisie. En multi‑pages, rien ne survit en mémoire à une navigation : chaque
   page se réhydrate au chargement.
5. **Écran de fin** : la partie est versée aux classements / records **dès
   l'arrivée**, une seule fois (champ `recorded`). Ce qu'elle a changé est
   mesuré **avant** d'écrire et mémorisé dans la partie (`hofImpact` au Yams,
   `recordsBroken` au 5000) : recalculé après écriture, ce serait comparer la
   partie à elle‑même. Elle n'est effacée qu'au clic sur « Quitter ».

## Le Yams

- **Variantes** Classique, Montante, Descendante, One Shot, jouables ensemble
  (une colonne chacune, classement sur le total) ; sur l'accueil, une phrase
  sous chacune dit ce qu'elle change (`VariantConfig.hint`). Montante /
  Descendante verrouillent l'ordre de remplissage (`isLineEnabled`) ; un
  liseré à l'encre du jeu cerne la prochaine case (`nextLine`) et glisse
  jusqu'à la suivante après une saisie.
- **Barème réglable** (`scoring.ts`) : `buildGrid(rules)` produit la grille —
  sections et valeurs saisissables. `computeDerived` (pur) donne bonus, totaux
  et score final ; `writeDerived` les recopie dans la feuille.
  `normalizeRules` répare n'importe quel objet de règles (bornes : lignes
  `0–150`, bonus `0–100`).
- **Lignes : identifiant ≠ libellé.** Une feuille range ses cases sous un
  identifiant stable (`"1"`…`"6"`, `brelan`, `full`, `carre`, `petiteSuite`,
  `grandeSuite`, `chance`, `yams`, `bonus`, `totalHaut`, `totalBas`,
  `scoreFinal`). Le libellé affiché (`Full (25)`, `Brelan (Σ3)`) se calcule par
  `lineLabel(line, rules)`. Les feuilles d'avant la v7, rangées sous leurs
  libellés, sont converties par la migration (`legacyLines.ts`).
- **Modes d'une ligne** : somme des 5 dés (`Σ`), points fixes, et pour le
  Brelan et le Carré seulement, **dés de la combinaison** (`Σ3` / `Σ4` : trois
  5 = 15).
- **Valeurs proposées à la saisie** : uniquement celles qu'un lancer peut
  donner, calculées en parcourant les 252 mains possibles (`lineValues`) —
  0 puis 5 à 30 à la Chance, 15 ou 20 en grande suite en somme, 3 à 18 au
  Brelan (Σ3)… Zéro reste toujours permis (case barrée).
- **Pas d'état en mémoire à part** : comme au 5000, les écrans travaillent
  directement sur la partie sauvegardée et la réécrivent après chaque saisie.
- **Écran de jeu** : on change de joueur aux flèches ou **en balayant**
  (`core/swipe.ts`, partagé avec le 5000). Le geste n'est reconnu qu'au doigt
  (à la souris, glisser sélectionne du texte) et l'écran doit garder
  `touch-action: pan-y pinch-zoom`, sinon le navigateur s'approprie le geste.
  Les lignes 1 à 6 portent une face de dé dessinée en SVG. En haut, la même
  barre qu'au 5000 : ⓘ Règles et la pause (retour à l'accueil du Yams, partie
  gardée), hors de la ligne des flèches pour ne pas s'y confondre.
- **La grille, un cahier** (09/10) : lignes bleues (`--ruling`), marge rouge
  après les libellés (`--margin-line`), chiffres étroits et grands, lisibles
  de l'autre bout de la table ; les cases gardent leur habit (pointillé vide,
  teinte du joueur remplie). Bornée à 30 rem de large (`--grid-max`) : le
  score final reste à l'écran jusqu'à 375 × 667, et sur ordinateur.
- **Saisie** : la fenêtre est titrée par sa ligne (pour un chiffre, le dé et
  « Les 4 »). Sur les lignes 1 à 6, chaque valeur dit son nombre
  de dés (8 sur la ligne des 4 = « 2× ⚃ »). La valeur choisie s'écrit dans sa
  case (seule la case qu'on vient de remplir s'anime), un 0 se barre. Un Yams
  marqué reste entouré ; à la saisie, confettis et tampon « YAMS ! »
  (`celebrateYams`), et l'avance automatique attend la fin de la fête. Bonus
  décroché : « +35 » s'envole au-dessus de la jauge.
- **À qui de jouer** : chacun remplit une case par tour, dans l'ordre de la
  table — le joueur qui doit jouer est le premier à avoir rempli le moins de
  cases (`playerToPlay`). Déduit des feuilles, pas mémorisé : c'est lui qu'on
  montre à la reprise, et c'est vers lui que va l'avance automatique après une
  saisie (une correction dans la grille d'un autre y ramène). Sur la grille
  d'un autre joueur, une pastille bleue « C'est à Marie › » au milieu de la
  barre du haut le rappelle et y ramène d'un toucher — dans la barre, pour ne
  rien prendre à la grille. Sur un écran étroit, « C'est à » saute et le nom
  reste.
- **Fin de partie** : la dernière case remplie mène au podium après la même
  attente que l'avance automatique ; changer de grille pendant ce temps
  (flèche, glissement, pastille) ne l'annule plus — on restait sinon sur une
  grille finie, sans issue.
- **Indice de bonus** (désactivable) : à une variante, à quatre chiffres
  restants ou moins ; à deux variantes, à trois ou moins (colonnes plus
  étroites) ; au-delà, jamais. La case du plus grand chiffre libre montre la
  combinaison la plus probable pour atteindre 63 (`bonusPlan`). La ligne du
  bonus affiche sa valeur réglée, « Bonus (35) », comme « Full (25) ».
  Les plans sont classés par `DICE_ODDS`, la probabilité d'obtenir au moins *k* dés d'un chiffre en un tour
  (`B(5, 1 − (5/6)³)`) ; à probabilité égale, le moins de dés ; à effort égal,
  le plus de points. Ce dernier départage n'est pas cosmétique : sans lui, deux
  plans équivalents étaient choisis au hasard d'un arrondi. Le tri du plus gros
  dé au plus petit n'est qu'un tri d'affichage.
- **Mode consultation** : depuis l'écran de fin, `yams-game.html?review=1`
  montre les grilles en lecture seule. Ignoré tant que la partie n'est pas
  finie, comme au 5000.
- **Palmarès** (`hallOfFame.ts` dans le code) : top 5 des **meilleurs** scores toutes variantes confondues
  (un même joueur peut occuper plusieurs places), top 5 des **pires**
  **en Classique seulement** — les autres variantes produisent trop souvent des
  scores catastrophiques. Chaque entrée garde sa feuille détaillée **et son
  barème**, pour en réafficher les libellés (`Full (30)` si c'était le réglage).
  Le classement, lui, mélange les barèmes : choix assumé.
  L'écran de fin annonce ce que la partie change avant de l'écrire : aperçu
  (`previewHallOfFame`) et enregistrement (`saveBestAndWorstScores`) sont deux
  usages d'un seul calcul, ils ne peuvent pas se contredire.
- **Statistiques** : moyenne et record par joueur, **parties classiques
  seulement**.
- **Préférences d'affichage** (`prefsRepo`) : hors des règles, parce qu'elles
  s'appliquent tout de suite, y compris à une partie en cours.

## Le 5000

Variante française du 10 000 à cinq dés. L'**objectif** et les **variantes**
se choisissent sur l'accueil du jeu, à chaque partie (5 000 par défaut,
10 000 ou 20 000) ; l'entrée en jeu, les busts d'affilée et le barème vivent
dans ⚙️ (interrupteurs et champs libres ; « Perso » ouvre une case par
chiffre). Tout est figé au lancement (`G5000Game.rules`).

- **Règles de base** : garder au moins un dé qui marque à chaque lancer ;
  atteindre **ou dépasser** l'objectif ; **main pleine relancée
  obligatoirement** ; **entrée en jeu** à 500 en un tour (interrupteur +
  montant libre) ; **3 busts d'affilée** (interrupteur + nombre libre, après
  l'entrée en jeu) font redescendre au score précédent. Quand un joueur atteint
  l'objectif, chaque adversaire joue **un dernier tour** (la riposte, par
  défaut) ; sans riposte (`lastRound: false`), on finit seulement le **tour de
  table**, et la partie s'arrête net si c'est le dernier du tour qui arrive.
  Qui a atteint l'objectif est **à l'abri**, et à score final égal **le premier
  arrivé passe devant** (`G5000Game.arrivals`, `standings`). Les parties
  d'avant `arrivals` gardent leur victoire partagée.
- **Barème** (`rules.ts`) : un 1 = 100, un 5 = 50. Réglables : **brelan**
  (classique : trois 1 = 1 000, sinon chiffre × 100 ; ou « Perso »),
  **carré** (1,5 × ou 2 × le brelan, ou « Perso »), **quinte** (2 × le carré,
  2 × le brelan, ou « Perso »), **suite** (1 000 par défaut, 1 500, ou un
  montant libre — 0 : elle ne compte pas). « Perso » = une valeur par chiffre
  (`customTriples` / `customFours` / `customFives`, `null` tant que jamais
  choisi : ⚙️ les préremplit alors avec les valeurs en vigueur). Une valeur
  par figure : `figureValue` ; `groupValue` garde la meilleure lecture (une
  petite figure + des dés isolés peut battre une grande saisie trop basse).
  Figures **dans un seul lancer**. Tous les scores sont des multiples de 50
  (valeurs saisies ramenées au pas, 1,5 × arrondi) ; les objectifs, des
  centaines.
- **Variantes** (`variants.ts`, `hasVariant`), aucune cochée par défaut. Sur
  l'accueil, chaque puce porte une phrase en italique (`hint`) qui dit ce
  qu'elle change :
  - 🎯 **Sniper** — banquer exactement le score d'un adversaire le fait
    redescendre à son score précédent, en **cascade**. Sans elle, pas de
    cibles à l'écran.
  - 🏹 **Dans le mille** — il faut l'objectif exactement ; un tour qui le
    dépasse est un **bust** (il compte dans les busts d'affilée).
  - ⭕ **Sans demi-mesure** — un pot qui finit par 50 ne se banque pas
    (`isUnround`) : les cases en 50 des paliers sont hachurées, « Banquer » est
    grisé.
  - 😌 **Pas de zèle** — une main pleine peut se banquer.
  - 🔗 **Combo** — un brelan (ou mieux) active son chiffre pour le reste du
    tour : chacun de ses dés vaut +100 (un 1 = 200, un 5 = 150, les autres
    100). La calculette met les chiffres activés en valeur (rappel en tête,
    pavé, bande du lancer, dés déjà gardés, combinaisons).
  Une partie lancée avant les variantes les retrouve depuis ses anciens
  interrupteurs (`legacyVariants`) ; les réglages enregistrés, eux, arrivent
  sans variante (`repo.getRules`).
- **Moteur** (`engine.ts`) : la feuille d'un joueur (`sheet`) stocke ses
  **cumuls**, pas ses gains, dans l'ordre où ils ont été écrits. Une redescente
  **barre** le dernier score en vigueur au lieu de l'effacer (`struck`, avec sa
  cause : Sniper et son auteur, ou busts d'affilée) ; le score actuel est
  le dernier non barré. L'écran l'affiche comme une feuille de papier : une
  colonne par joueur, à son rythme, scores barrés visibles, score en vigueur
  surligné. Les parties enregistrées avant (`history`) sont converties à la
  lecture (`repo.ts`). L'écran n'appelle que
  `startTurn`, `keepDice`, `reroll` (et `undoRoll`) pendant le tour, puis
  `finishTurn(game, "bank" | "bust")` — score, redescentes,
  consignation pour les records, main passée ou fin de partie. Chaque fonction
  renvoie les **mouvements** provoqués, que l'écran déroule (cascade animée).
  Une fois la cible atteinte, le moteur retient **qui doit encore jouer**
  (`toPlay`) plutôt qu'un « dernier joueur » : on peut choisir qui joue, l'ordre
  n'est donc pas garanti. Sans riposte (« tour de table »), doivent encore
  jouer ceux qui ont joué moins de tours que le vainqueur (`stats.turns`), pas
  ceux assis après lui. La fin de partie est un fait enregistré
  (`G5000Game.ended`) : les pages de jeu et de fin se redirigent l'une vers
  l'autre selon lui.
- **Corriger le dernier tour** : `finishTurn` garde la partie telle qu'elle
  était juste avant le tour (`G5000Game.previous`) et ce que le tour a écrit
  (`lastTurn`). La ligne « Dernier tour » de l'écran le rappelle (« Bob +650 →
  2 050 · Alice redescend », « Bob : bust, 350 perdus ») ; « Corriger » montre
  ce qui sera défait, puis `undoLastTurn` revient à cet état — feuilles, busts
  d'affilée, cascades Sniper, statistiques des records, riposte — et rend la
  main au joueur, tour vierge. Un seul tour en arrière (le tour suivant remplace
  l'instantané), et plus rien une fois la partie finie (les records sont
  écrits au podium). Renommer un joueur fait suivre l'instantané
  (`renameInSavedGame`), sinon l'ancien nom reviendrait.
- **Choisir qui joue** : toucher un nom en tête de la feuille, ou glisser vers
  la gauche / la droite, donne la main à ce joueur et l'ordre repart de lui
  (`choosePlayer`). Un tour entamé demande confirmation avant d'être abandonné.
  Si la main a été donnée à un autre que celui dont c'est le tour en suivant
  la table — le premier, dans l'ordre de départ, à avoir joué le moins de
  tours (`expectedPlayer`, même règle que `playerToPlay` au Yams) —, la même
  pastille « C'est à Marie › » qu'au Yams le signale dans la barre du haut et
  lui rend la main d'un toucher.
  En fin de partie, seuls ceux qui doivent encore riposter sont accessibles.
- **Feuille** (refonte du 08/10) : les noms sur des **intercalaires** de la
  couleur du joueur, posés sur le trait d'encre, ses busts d'affilée dans
  l'onglet ; l'en-tête reste collé en haut quand la feuille défile. Les
  anciens scores en retrait, le score en vigueur plus grand et surligné ;
  lignes au bleu du quadrillage, rature un peu de travers, objectif entouré
  d'un cercle tracé à la main. Colonnes réglées sur le plus long nombre de la
  partie (plus étroites à 5 000 qu'à 10 000) et sur le plus long prénom
  (mesuré, plafonné) : quatre joueurs tiennent sur un téléphone de 360 px,
  sauf prénoms très longs (au plafond, « Mohammed », quatre joueurs débordent
  de 14 px à 390 px). La mesure se fait dans la police de l'appli : la feuille
  est remesurée une fois la police chargée (mesurée dans la police de
  secours, elle débordait de 100 px). Un onglet à qui l'on peut donner la
  main est un vrai `<button>` dans l'en-tête de colonne. Dessinée par
  `pages/g5000/sheet.ts`.
- **Saisie** : trois portes en bas — « Compter mon tour pas à pas » (la
  **calculette**), puis **Bust** et « Entrer mon total du tour » (la **saisie
  manuelle**, « les paliers ») sur une ligne.
  - **Le pupitre** : les deux saisies ne sont pas des fenêtres. Ouvertes par
    `show()` (non modales), elles se posent en bas à la place de la barre,
    sans voile ; la feuille rétrécit au-dessus et reste calée sur sa dernière
    ligne, le bandeau se résume au nom et à la jauge. Le pupitre ne dépasse
    pas les trois quarts de l'écran (son corps défile, son pied reste). La
    flèche du haut (ou Échap) le referme en gardant le tour ou le score choisi
    jusqu'à la fin du tour ; donner la main à un autre le referme.
  - Pendant la saisie, la **feuille** réserve la case de celui qui joue et y
    écrit le pot **au crayon** (« +1 500 » en petit, le total souligné en
    pointillé, barré si ce pot ne se banquerait pas) ; avec Sniper, le score de
    l'adversaire visé s'allume « pile ! ». La jauge du bandeau montre aussi, en
    hachuré, où le pot mènerait (`previewPot`). Banquer remplit la jauge du
    joueur et fait s'envoler le gain (`showBank`) avant de passer la main ; les
    trois portes attendent la fin de l'animation, pour qu'un toucher rapide
    n'ouvre pas la saisie du suivant sous le nom de celui qui vient de banquer.
  - **Bust rapide** : une touche dans la barre du bas, sans rien ouvrir (le
    bust du premier lancer). Un tour entamé (score choisi aux paliers,
    calculette refermée en cours de tour) est perdu avec son pot, qui compte
    pour le record du pot perdu. « Corriger » rattrape une erreur.
  - **Les paliers** (`pages/g5000/quickEntry.ts`), pour qui a déjà compté son
    tour : on ne compose pas son score, on le choisit. Une rangée de
    **milliers** qui défile jusqu'à deux fois l'objectif, jamais au-delà de
    20 000 (`highestThousand`, `rules.ts`), puis une grille de **vingt scores**
    de 50 en 50 : deux touches au plus. Le score choisi est entouré au feutre ;
    changer de millier garde la case (500 puis « 1 000 » = 1 500). Chaque case
    annonce ce qu'elle ferait : point de couleur = pile sur cet adversaire
    (Sniper), trophée = victoire, hachures = ne se banque pas (entrée en jeu,
    Sans demi-mesure ; en rouge, au-delà de l'objectif avec Dans le mille).
    Pas de mains pleines : on entre son total final (`enterTurn(game, pot)`),
    et le record de la série ne vient que de la calculette.
  - **La calculette** : le pot en tête, « Lancer 2 · 3 dés » sous le nom. On
    touche les faces obtenues ; elles se posent sur une bande de papier, un
    peu de travers, avec des emplacements en pointillé pour celles qui
    restent ; toucher un dé posé le retire. Rien ne se passe tant que le joueur
    n'a pas **validé** ses dés (bouton toujours présent, actif une fois le
    compte atteint) ; « Corriger les dés » y ramène depuis le choix des
    combinaisons ou un bust. **Toutes les combinaisons sont proposées**, même
    celles qui valent moins sur les mêmes dés (garder moins peut servir, avec
    Sniper) ; rien n'est retenu d'office. Toucher une combinaison la retient
    et lâche celles qui partagent ses dés (`pickCombo`) : on ne garde jamais un
    dé deux fois (`canKeep`). Une combinaison incompatible l'annonce avant le
    toucher (« à la place de Brelan de 5 ») ; les dés retenus se soulèvent,
    cerclés d'or. Pied d'une ligne : [Relancer 3 dés | Banquer 200] ; une main
    pleine à relancer prend le bouton seul. « Recommencer le tour » se
    confirme sur place.
  - **Les lancers déjà gardés** se posent à gauche de la bande, comme à la
    table : chaque lancer avec son gain, une main pleine finie résumée en une
    pastille. La flèche en tête **rouvre le lancer précédent** tel qu'il était
    (faces et choix) : le tour garde l'historique de ses lancers
    (`G5000Turn.history`, `keepDice(game, picked, roll)`), et `undoRoll`
    restaure le tour d'avant — pot, dés en main, chiffres activés, série de
    mains pleines. Enregistré avec la partie, il survit à un rechargement.
  - Dans le mille : dès que les dés retenus font dépasser la cible, relancer
    n'a plus de sens (`canReroll`). La calculette propose « Bust — passer la
    main » au lieu de faire relancer jusqu'au bust ; le joueur peut encore
    toucher une combinaison plus petite avant.
  - La ligne au-dessus du pied dit pourquoi on ne peut pas banquer
    (`potWarning` : dépassement, entrée en jeu, compte pas rond), ou, en or,
    que l'objectif est atteint ; le bouton « Banquer » porte alors un trophée
    (`bankLabel`, `bankOutcome`).
  - **Sniper**, dans la calculette : une pastille par adversaire devant (hors
    joueurs arrivés à l'objectif, à l'abri), avec l'écart exact pour tomber
    pile sur son score ; « Détail » déplie le tableau (où il retomberait,
    `TieTarget.fallsTo`, et ce qu'il perdrait). La pastille s'allume quand le
    pot tombe pile (une fois, `.is-hit-new`). Sans Sniper, une égalité ne fait
    rien : pas de cibles, la feuille dit qui est devant.
- **Règles (ⓘ)** : depuis l'accueil, la page décrit les réglages actuels et
  **toutes** les variantes ; ouverte pendant une partie (`?from=play`), les
  réglages de la partie et **ses seules** variantes (`GameDef.rulesDoc({ inGame })`).
- **Pause** : le bouton en haut à droite, à côté de ⓘ, ramène à l'accueil du
  5000. À la reprise, c'est le joueur dont c'est le tour qui est affiché — au
  5000, le joueur affiché est toujours celui qui joue.
- **Palmarès** — les records (`records.ts`) : quatre dont on est fier (victoire la plus
  rapide, plus gros tour banqué, plus de mains pleines en un tour — comptées
  par la calculette —, plus de victoires), quatre dont on rit (plus gros pot perdu, plus grosse chute, plus
  long temps d'entrée en jeu, partie la plus longue). Un record doit être
  **battu**, pas égalé. Une partie abandonnée ne compte pas. **Chaque objectif
  a ses records** (une victoire en 6 tours à 3 000 ne dit rien d'une partie à
  10 000) ; seules les victoires se comptent tous objectifs confondus. Les
  records d'avant cette séparation sont rangés sous 5 000.
- **Écran de fin** : la colonne « Tours » compte les tours joués, busts
  compris (`stats.turns`), pas les lignes de la feuille. « Revoir la feuille »
  ouvre `5000-game.html?review=1` : la feuille en lecture seule, sans bandeau ni
  saisie (paramètre ignoré tant que la partie n'est pas finie). Le podium et sa
  mise en scène sont ceux du Yams (`pages/endScreen.ts` : marches une à une,
  score du vainqueur qui défile, classement du dernier au premier).

## Joueurs

- **Joueurs connus** (`knownPlayersRepo`) et **nombre de parties** tous jeux
  confondus (`playerGamesRepo`, qui trie la liste de sélection) sont communs.
- Tous les noms se comparent **casse et espaces ignorés** (`playerName.ts`) :
  une entrée par joueur partout.
- **Renommer ou supprimer** passe par `games/playerAdmin.ts`, qui traite le
  commun (noms, compteur, brouillon) puis appelle chaque jeu. Chaque jeu fait
  suivre **sa partie en cours** : sans ça, elle réécrirait l'ancien nom à la fin
  et créerait un joueur fantôme. Supprimer un joueur abandonne les parties qui
  le comptent.

## Stockage

Toutes les clés sont dans `core/storage/keys.ts`. **Leurs préfixes ne disent
pas à quel jeu elles appartiennent** (`yams-player-names` est commun,
`bestScores` est au Yams) : ce sont les noms de l'époque à un seul jeu, jamais
renommés — renommer, c'est copier puis supprimer, donc risquer les données de
tout le monde. Les commentaires de `keys.ts` font foi.

La **dernière victoire** (`app-last-win`, `core/storage/lastWinRepo.ts`),
tous jeux confondus, alimente le post-it du menu. Écrite une fois par partie
par les écrans de fin, elle suit les renommages et suppressions de joueurs
(`games/playerAdmin.ts`) ; elle n'est pas sauvegardée (un rappel, pas une
donnée).

La fenêtre **« Installer Cornet »** (`app-install-prompt`,
`core/storage/installPromptRepo.ts`) retient « Plus tard » (une semaine) ou
« Ne plus demander ». Propre à l'appareil, elle n'est pas sauvegardée non
plus.

Toutes les lectures passent par un contrôle de forme (`readJson(key, guard)`)
ou une normalisation tolérante : un contenu abîmé est ignoré au lieu de faire
planter une page.

`migrate.ts` met les données d'anciennes versions au format courant, **une
fois par version** (marqueur `yams-schema-version`, actuellement 8). Elle est
**non destructive** : elle complète et répare, elle ne supprime que du JSON
illisible. Un nouveau format ⇒ incrémenter `SCHEMA_VERSION` et ajouter la
migration, avec son test. (Les records du 5000 se normalisent à la lecture,
`normalizeRecords` ; seules leurs dates passent par la migration.)

**Dates** : écrites en ISO local à la minute (`dateStamp()`, `core/dates.ts` :
`2026-10-08T21:14`), jamais en UTC — une partie finie à 0 h 30 est du jour
même. Avant la v8, c'était le texte d'affichage `jj/mm/aaaa` ; la migration
les convertit (palmarès du Yams, records du 5000, dernière victoire) et
`formatDate` (« il y a 6 jours », « 15 août 2026 ») lit les deux formats.

Au démarrage, l'application demande au navigateur un **stockage persistant**
(`core/storage/persist.ts`) : sans ça, Safari efface les données d'un site non
installé après sept jours sans visite. Si une écriture échoue (stockage plein
ou refusé), un bandeau rouge **« Impossible d'enregistrer »** le dit
(`core/storageAlert.ts`) au lieu d'un écran qui casse en silence.

## Sauvegarde et restauration

Les Paramètres exportent toutes les données dans un fichier JSON et savent le
relire ; une ligne sous « Exporter » confirme le téléchargement et nomme le
fichier (sur iPhone, il part sans bruit dans Fichiers). Le fichier (version 5) transporte un dictionnaire indexé par clé : les
clés communes sont listées dans `backup.ts`, celles de chaque jeu viennent de
`GameDef.storageKeys` — un jeu ajouté est sauvegardé sans toucher à ce
fichier. Les fichiers plus anciens restent lisibles.

L'import **remplace tout**, il se fait donc en deux temps : `readBackupFile`
lit et valide sans rien écrire, une pop‑up récapitule le contenu, et
`importAllData` n'est appelée qu'après confirmation. Il est **tout ou rien** :
si une écriture échoue en route, les données d'avant sont remises en place. Il
efface le marqueur de schéma : les données sont re‑migrées au lancement
suivant.

## Conventions

- **Un module de page s'écrit dans cet ordre** : amorçage et gardes, constantes,
  fonctions, puis un bloc **« Mise en route »** tout en bas. Une fonction
  remonte en haut du module, une constante non : un appel d'initialisation
  placé plus haut lit une constante en zone morte — page blanche, que ni `tsc`
  ni les tests ne voient.
- **Un module importé est évalué avant celui qui l'importe**, donc avant
  `bootstrap()` et la migration : les panneaux des Paramètres ne lisent rien du
  stockage à leur niveau module, tout est dans leur `setup…()`.
- **Une page = exactement un `<h1>`**, puis `h2`/`h3` sans saut : le titre de
  l'en-tête (`.page-title`), le nom du jeu (sélecteur) sur son accueil, le nom
  du joueur à l'écran de jeu du Yams.
- Les fragments communs sont injectés au build par le plugin `sharedHead` de
  `vite.config.ts`, depuis `htmlFragments.ts` : **une nouvelle page pose
  `<!--@head-->`** et se déclare dans `build.rollupOptions.input` ; un
  pictogramme s'écrit `<!--@icon:nom-->` (`home`, `trophy`, `info`… : les noms
  de `core/iconPaths.ts` ; un marqueur inconnu fait échouer le build).
- **La feuille de style est découpée par domaine** (`src/styles/`, importés
  par `src/style.css`, la police Archivo en premier). L'ordre des imports
  compte : des règles de même spécificité se départagent par leur position.
  L'écran du 5000 en six fichiers consécutifs (`g5000-game`, `-sheet`,
  `-entry`, `-paliers`, `-dialogs`, `-calc`), découpés le 09/10 sans changer
  d'un octet le CSS compilé.
- **Direction visuelle « Bloc de score »** (octobre 2026) : Cornet remplace la
  feuille de score, l'identité part de là. Le fond est un **papier quadrillé**
  (`body`), le contenu est posé dessus en **feuillets** blancs (`.sheet`, bord
  perforé `.perf-top`) — deux niveaux seulement, pas de feuillet dans un
  feuillet. **Une seule police**, Archivo à largeur variable, embarquée
  (`@fontsource-variable/archivo`, mise en cache par le service worker) :
  capitales étroites (`font-stretch: 62 %`) pour les titres, chiffres en
  `.num`. Chaque écran hors partie a son **en-tête** (`.page-head` : surtitre
  `.page-eyebrow`, titre `.page-title`) ; un écran de jeu, sa barre
  (`.screen-bar`). Les intitulés de section sont des `.section-label`. Les
  **états sont des gestes de marqueur** : surligné (`.hl`) = choisi ou en
  vigueur, entouré (`handCircle()`) = l'objectif, barré = tombé, coché =
  activé. Les rangs sont des **gommettes** (`gommette()`) or / argent / bronze,
  blanches au-delà, chez les meilleurs comme chez les pires. Palmarès et fins de partie
  ajoutent de la couleur : un **papier de couleur par famille** avec son
  onglet (`.paper-block`, `.paper-tab` : meilleurs en jaune, pires en rose,
  statistiques en bleu), le record sur un **post-it** (`.postit`), et à la fin
  « Bravo Alice ! » avec des confettis (`pages/endScreen.ts`), dans un en-tête
  à la couleur de partie du vainqueur.
  **Illustrations** (`core/illustrations.ts`, des dessins et non des
  pictogrammes) : le cornet renversé à côté du nom au menu, cinq dés lancés au
  bas de l'en-tête de chaque accueil (`GameDef.sceneDice` : un Yams de 6, un
  brelan de 1 et un 5), masqués sur un écran bas. Une partie en cours prend
  leur place dans l'en-tête (`#resume-card`, piste B du 09/10) : la partie en
  cours dit où en est ce jeu, le feuillet dessous sert à en lancer une autre.
  L'accueil tient sans défiler jusqu'à 375 × 667 (`fitHomeToScreen`,
  `pages/gameHero.ts`) : s'il déborde, les dés s'effacent ; s'il déborde
  encore, tout se resserre d'un cran (`.is-tight`, `.is-tighter`). **Passage d'un écran à
  l'autre** : View Transitions entre documents, en CSS seul (`animations.css`) —
  l'en-tête se fond sur place (`view-transition-name: app-header`, donc UN seul
  en-tête par page), le contenu arrive en glissant ; sans effet sur Firefox.
  **États vides** : une phrase plutôt que « Aucune entrée » (palmarès vides,
  podium à prendre en gommettes pointillées, « nouveau » pour un joueur sans
  partie).
  Le papier est ivoire, le quadrillage bleu de cahier, les ombres brunes
  (« La table de jeu », octobre 2026) ; les traits et ombres translucides
  passent par `rgba(var(--ink-rgb), …)` et `rgba(var(--shade-rgb), …)`.
  Chaque jeu a son encre (`GameDef.accent` : titres, entourés, surlignés) et son
  papier (`GameDef.accentPaper` : fond des en-têtes de ses pages et du haut de
  sa carte au menu), posés sur l'écran par `applyGameTheme()`
  (`pages/gameTheme.ts`) — à appeler sur toute nouvelle page d'un jeu. Seule la
  couleur d'un joueur colore le fond d'un écran de partie. Jetons et
  composants : `base.css` et `paper.css`.
- **Dialogues** : rien à déclarer en CSS, le gabarit est sur l'élément
  `dialog`. `makeDismissible(dialog, boutonId?)` ajoute la fermeture au clic sur
  le fond. Une action qui doit suivre une fermeture écoute l'événement `close`
  (Échap et le geste retour ferment aussi). Rien ne s'efface sans une pop‑up
  qui montre ce qui va disparaître — sauf « Recommencer le tour » de la
  calculette, confirmé sur place. Exception : les deux saisies du 5000 sont des
  `dialog.pupitre` non modaux (`show()`), posés dans l'écran de jeu (styles
  dans `g5000-game.css`) ; pas de `makeDismissible` sur eux (un clic sur leur
  marge les fermerait).
- **Code couleur des boutons** (détaillé en tête de `styles/buttons.css`) —
  une couleur = un sens : **vert** jouer / faire avancer / valider / ajouter,
  **bleu** revenir ou renoncer sans rien perdre (« Quitter » une partie déjà
  enregistrée en est), **or** résultats et palmarès, **rouge** on perd ou on
  efface quelque chose, **gris** désactivé uniquement. `.btn-outline` (fond
  blanc, bord coloré) : l'action secondaire de la même famille, ou un bouton
  rouge qui ouvre une confirmation. Une action seule (main pleine à relancer)
  prend le bouton plein. Vert et or sont assez foncés pour un texte blanc
  lisible (≥ 4,5:1).
- **`[hidden]` est imposé globalement** en CSS : ne pas écrire de règle
  `.machin[hidden]`.
- **Ni emoji ni caractère de police pour un pictogramme** (⚀, ⓘ, ⏸, ⌫, 🏆,
  🍀…) : leur rendu varie d'un appareil à l'autre, jusqu'à ne pas s'afficher
  du tout, et cinq styles d'icônes se côtoyaient. Tous sont tracés au trait
  dans `core/iconPaths.ts` : `<!--@icon:nom-->` dans une page,
  `icon(nom)` (`core/icons.ts`) dans un écran. Faces de dé : `core/dice.ts`.
  Un jeu, une variante, un record déclare le **nom** de son pictogramme
  (`IconName`), jamais un caractère.
- **Un bouton qui n'est pas un `.btn` pose sa couleur de texte et, s'il est rond
  ou de taille fixe, `padding: 0`** : la règle globale `button` écrit en blanc
  et ajoute une marge latérale. Il n'y a pas de survol global (`button:hover`) :
  sur tactile il restait collé après un toucher.
- **Les nombres affichés passent par `formatScore`** : la locale insère selon le
  navigateur une espace insécable fine ou ordinaire comme séparateur de milliers.
- **Rayons d'angle : l'échelle de `base.css`** (`--radius-xs` 2 px, `-s` 4,
  `-m` 6, `-l` 8, `-xl` 10, `-pill`), pas de valeur en dur ; les ronds gardent
  `50%`.
- **Tailles de texte : l'échelle de `base.css`** (`--fs-3xs` 0,6 rem, `-2xs`
  0,66, `-xs` 0,74, `-s` 0,8, `-m` 0,88, `-body` 0,95, `-base` 1, `-ui` 1,05,
  `-l` 1,15, `-xl` 1,3, `-2xl` 1,45, `-3xl` 1,6, `-4xl` 2, `-5xl` 2,3,
  `-hero` 4,5), jamais une taille en rem en dur. Les em (proportionnels à leur
  composant) et les `clamp()` des grands titres restent à part.
- **Un prénom après « de » passe par `ofName`** (`core/playerName.ts`) :
  « le tour d'Alice », « le tour de Bob ».
- **Accessibilité** : un anneau de focus au clavier seulement
  (`:focus-visible`), jamais de `blur()` pour le cacher au doigt ; une zone
  touchable de 44 px pour les pictogrammes de la barre du haut ; le joueur qui
  prend la main est annoncé (`aria-live`).
- **Commentaires en français, qui expliquent le pourquoi.**

### Navigation

- Une navigation **sans effet de bord** est un simple `<a href>` dans le HTML ;
  `goTo(page)` (`core/nav.ts`) ne sert qu'**après une écriture**.
- Cinq écrans lisent un paramètre d'URL : `settings.html?game=`,
  `rules.html?game=` (et `&from=play` : ouvertes depuis une partie, « Retour »
  y ramène), `yams-game.html?review=`, `5000-game.html?review=` (consultation
  depuis la fin) et `5000-records.html?from=end` (« Retour » ramène au
  podium). Le service worker **ignore tous les
  paramètres** (`ignoreURLParametersMatching` dans `vite.config.ts`) : sinon
  ces adresses ne sont pas trouvées dans le précache, et l'application
  installée affiche le menu des jeux à leur place. Invisible en développement.
- Les écrans de jeu gardent **l'écran allumé** (`core/wakeLock.ts`) : le
  téléphone reste posé sur la table entre deux tours.

## Installation et icônes

Tant que Cornet n'est pas installé, le menu propose de l'installer
(`core/pwa/install.ts`, `pages/home.ts`) : sur iPhone, Safari efface les
données d'un site non installé après sept jours sans visite. Android et
Chrome annoncent qu'ils savent installer (`beforeinstallprompt`) : la fenêtre
porte alors un bouton « Installer » qui ouvre leur boîte. Sur iPhone, aucune
page ne peut déclencher l'installation : la fenêtre montre les deux gestes
(Partager › Sur l'écran d'accueil). Au menu seulement, jamais en partie ;
« Plus tard » (ou un clic à côté) la repropose une semaine après. La même
aide reste dans Paramètres › Sauvegarde.

Icônes : le cornet du menu sur le papier de l'appli pour l'écran d'accueil
(`public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` pour la
découpe d'Android, `apple-touch-icon.png` pour iOS) ; le dé seul dans l'onglet
du navigateur (`favicon.svg`, `favicon-48.png`), où le cornet ne se lirait
plus.

## Mise à jour de l'application

`vite-plugin-pwa` précache toutes les pages et le JS/CSS. Après un déploiement,
`src/core/pwa/updatePrompt.ts` affiche un bandeau **« Mettre à jour »** :
l'utilisateur choisit le moment, puisque recharger peut interrompre une partie.
La version affichée dans les Paramètres vient de `package.json`
(`__APP_VERSION__`).

## Déploiement

Push sur `main` → [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) :
`npm ci`, `npm test`, `npm run test:pages`, `npm run build`, puis publication
de `dist/` sur GitHub Pages (`https://paddadie.github.io/YamsApp/`). **Les
tests bloquent le déploiement.**

> Réglage unique dans le dépôt : **Settings → Pages → Source = GitHub Actions**.

`base: '/YamsApp/'` dans [`vite.config.ts`](vite.config.ts) doit rester le nom
du dépôt.

## Tests

`npm test` couvre la logique qui casserait en silence — tout ce qui n'a pas de
DOM : barèmes et moteurs des deux jeux (dont la cascade d'égalité et la fin de
partie), records, Hall of Fame, règles affichées confrontées au moteur,
classement partagé, administration des joueurs, migration, sauvegarde, dates et
noms. `src/test/setup.ts` fournit un `localStorage` en mémoire : pas de jsdom.

`npm run test:pages` teste les **écrans**, avec sa propre configuration
(`vitest.pages.config.ts`, jsdom) : la suite logique reste sans DOM. Le
harnais (`src/test/pages/harness.ts`) charge le `<body>` du `.html` (fragments
communs compris), fixe l'URL, importe le module d'entrée à neuf et note les
navigations (`goTo` est bouchonné) ; `fixtures.ts` écrit les données de départ
avec les vrais dépôts. Il attrape ce que ni `tsc` ni la logique ne voient :
constante en zone morte, `id` manquant, garde de redirection cassée, parcours
(saisie, calculette, fin de partie, retours) et l'habillage (`look.test.ts` :
couleurs posées, illustrations, états vides), le glisser-déposer des joueurs
(`players.test.ts`), les Paramètres (`settings.test.ts`) et l'invitation à
installer (`install.test.ts`). jsdom reste en
version 25 : la 27 exige Node ≥ 22.12. Il n'a ni `PointerEvent` (le harnais
fournit `pointer(cible, type, { x, y, id })`) ni `File.text()`, ne calcule
aucune mise en page (`getBoundingClientRect` à fixer dans le scénario qui
mesure), et `showModal()` est bouchonné (`setup.ts`).

Ce qui relève d'une règle (fin de tour, main pleine, renommage…) reste dans
les modules testés sans DOM : **une règle de jeu ne s'écrit pas dans
`pages/`**.

## Ajouter un jeu

1. Son dossier `games/<jeu>/` : logique sans DOM et ses tests, dépôt de
   stockage, `rulesDoc`, et un `gameDef.ts` qui remplit `GameDef`.
2. Une ligne dans `games/registry.ts`, ses clés dans `core/storage/keys.ts`.
3. Ses pages (`<!--@head-->`, entrée dans `vite.config.ts`, `core/nav.ts` si on
   y navigue par `goTo`), et son panneau dans `settings.html` et
   `pages/settings.ts`. Son accueil reprend l'en-tête des autres
   (`header.game-hero` : `.screen-bar-start` avec le `<h1>` et le bouton
   `game-switch`, la liste `game-switcher` À CÔTÉ du titre, puis
   `#game-tagline` et éventuellement `#game-sample`, remplis par
   `setupGameHero()` ; `<!--@icon:info-->` pour les règles). Son `gameDef`
   déclare son emblème (`icon`), son encre (`accent`), son papier
   (`accentPaper`, l'encre très éclaircie), son extrait de feuille (`sample`)
   et les dés de l'illustration de son accueil (`sceneDice`). Chacune de ses
   pages appelle `applyGameTheme()`.
4. Si ses données changent un jour de forme : une migration dans
   `core/storage/migrate.ts` (ou une normalisation à la lecture), avec son
   test. Ses pages entrent dans le harnais de `src/test/pages/`.

Le menu des jeux, la sélection des joueurs, la page des règles, la sauvegarde et
l'administration des joueurs le prennent en compte sans autre modification.
