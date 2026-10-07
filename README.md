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
```

⚠️ Les tests ne vérifient pas les types : une erreur de typage ne sort qu'au
`npm run build` (`tsc -b`, qui vérifie aussi les tests de pages). Lancer les
trois.

## Les pages

| Fichier | Écran | Entrée TS |
|---|---|---|
| `index.html` | Menu des jeux : une tuile par jeu, reprise d'une partie en cours, ⚙️ | `src/pages/home.ts` |
| `players.html` | Joueurs de la partie, **commun aux jeux** (liste à cocher, ordre en faisant glisser un joueur coché, mélange) | `src/pages/players.ts` |
| `rules.html?game=…[&from=play]` | « ⓘ Règles » du jeu, générées depuis ses réglages | `src/pages/rules.ts` |
| `settings.html[?game=…]` | Paramètres : communs, plus ceux du jeu d'où l'on vient | `src/pages/settings.ts` |
| `yams.html` | Accueil du Yams : variantes, reprise, Hall of Fame | `src/pages/yams/home.ts` |
| `yams-game.html[?review=1]` | Grille du joueur courant (ou consultation en fin de partie) | `src/pages/yams/game.ts` |
| `yams-end.html` | Podium, classement, impact sur le Hall of Fame | `src/pages/yams/end.ts` |
| `yams-hall.html` | Meilleurs / pires scores (feuilles détaillées) et statistiques | `src/pages/yams/hall.ts` |
| `5000.html` | Accueil du 5000 : objectif, variantes, reprise, records | `src/pages/g5000/home.ts` |
| `5000-game.html` | Feuille de progression, calculette, saisie rapide | `src/pages/g5000/game.ts` |
| `5000-end.html` | Podium, classement, records battus | `src/pages/g5000/end.ts` |
| `5000-records.html[?from=end]` | Records du 5000 par objectif, classement des victoires | `src/pages/g5000/records.ts` |

## Architecture

```
htmlFragments.ts  <head> commun et pictogrammes, injectés au build
src/
├── core/        commun, ne connaît aucun jeu
│   ├── bootstrap · nav · ui · playerName · playerColors · dates · dice
│   │   format · ranking · swipe · wakeLock · storageAlert · pwa/
│   └── storage/ localStore · keys · migrate · backup · persist
│                knownPlayersRepo · playerGamesRepo · draftRepo
├── games/
│   ├── registry.ts     LA liste des jeux
│   ├── types.ts        GameDef : ce qu'un jeu déclare au reste de l'appli
│   ├── playerAdmin.ts  renommer / supprimer un joueur partout
│   ├── yams/           scoring · hallOfFame · variants · variantBadge
│   │                   scoreSheet · players · rulesDoc · gameDef · types
│   │                   legacyLines · storage/
│   └── g5000/          rules · engine · records · recordLabels · rulesDoc
│                       variants · gameDef · repo · types
├── pages/       un module par écran (câblage DOM), + settings/ et gameSwitcher
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

- présentation (titre, icône, couleur, phrase d'accroche) et pages d'accueil /
  de partie ;
- `rulesDoc({ inGame })` : les règles en données, construites depuis les réglages en
  vigueur (ceux de la partie en cours quand `inGame`) ;
- `resume()`, `startGame()`, `clearSaved()` : partie en cours ;
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
  (une colonne chacune, classement sur le total). Montante / Descendante
  verrouillent l'ordre de remplissage (`isLineEnabled`).
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
- **À qui de jouer** : chacun remplit une case par tour, dans l'ordre de la
  table — le joueur qui doit jouer est le premier à avoir rempli le moins de
  cases (`playerToPlay`). Déduit des feuilles, pas mémorisé : c'est lui qu'on
  montre à la reprise, et c'est vers lui que va l'avance automatique après une
  saisie (une correction dans la grille d'un autre y ramène). Sur la grille
  d'un autre joueur, une pastille bleue « C'est à Marie › » au milieu de la
  barre du haut le rappelle et y ramène d'un toucher — dans la barre, pour ne
  rien prendre à la grille. Sur un écran étroit, « C'est à » saute et le nom
  reste.
- **Indice de bonus** (désactivable) : à quatre chiffres restants ou moins, la
  case du plus grand chiffre libre montre la combinaison la plus probable pour
  atteindre 63 (`bonusPlan`). Les plans sont classés par `DICE_ODDS`, la
  probabilité d'obtenir au moins *k* dés d'un chiffre en un tour
  (`B(5, 1 − (5/6)³)`) ; à probabilité égale, le moins de dés ; à effort égal,
  le plus de points. Ce dernier départage n'est pas cosmétique : sans lui, deux
  plans équivalents étaient choisis au hasard d'un arrondi. Le tri du plus gros
  dé au plus petit n'est qu'un tri d'affichage.
- **Mode consultation** : depuis l'écran de fin, `yams-game.html?review=1`
  montre les grilles en lecture seule.
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
    tableau des cibles à l'écran.
  - 🏹 **Dans le mille** — il faut l'objectif exactement ; un tour qui le
    dépasse est un **bust** (il compte dans les busts d'affilée).
  - ⭕ **Sans demi-mesure** — un pot qui finit par 50 ne se banque pas
    (`isUnround`) : pas de jeton +50 en saisie rapide, bouton « Banquer » grisé
    dans la calculette.
  - 😌 **Pas de zèle** — une main pleine peut se banquer.
  - 🔗 **Combo** — un brelan (ou mieux) active son chiffre pour le reste du
    tour : chacun de ses dés vaut +100 (un 1 = 200, un 5 = 150, les autres
    100). La calculette met les chiffres activés en valeur (rappel en tête,
    pavé, plateau, combinaisons).
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
  `startTurn`, `keepDice`, `reroll` pendant le tour, puis
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
- **Choisir qui joue** : toucher un nom en tête de la feuille, ou glisser vers
  la gauche / la droite, donne la main à ce joueur et l'ordre repart de lui
  (`choosePlayer`). Un tour entamé demande confirmation avant d'être abandonné.
  Si la main a été donnée à un autre que celui dont c'est le tour en suivant
  la table — le premier, dans l'ordre de départ, à avoir joué le moins de
  tours (`expectedPlayer`, même règle que `playerToPlay` au Yams) —, la même
  pastille « C'est à Marie › » qu'au Yams le signale dans la barre du haut et
  lui rend la main d'un toucher.
  En fin de partie, seuls ceux qui doivent encore riposter sont accessibles.
- **Saisie** : la **calculette** ou la **saisie rapide**.
  - Calculette : on touche les faces obtenues ; elles s'alignent au‑dessus du
    pavé, et toucher un dé saisi le retire. Rien ne se passe tant que le joueur
    n'a pas **validé** ses dés (bouton toujours présent, actif une fois le
    compte atteint) ; « Corriger les dés » y ramène depuis le choix des
    combinaisons ou un bust. Toucher une combinaison la retient et lâche celles
    qui partagent ses dés (`pickCombo`) : on ne garde jamais un dé deux fois
    (`canKeep`).
  - Dans le mille : dès que les dés retenus font dépasser la cible, relancer
    n'a plus de sens (`canReroll`). La calculette propose « Bust — passer la
    main » au lieu de faire relancer jusqu'au bust ; le joueur peut encore
    toucher une combinaison plus petite avant.
  - La ligne sous le pot dit pourquoi on ne peut pas banquer (`potWarning` :
    dépassement, entrée en jeu, compte pas rond).
  - Saisie rapide : trois gros jetons (+100, +500, +1 000), puis +50 (sauf
    Sans demi-mesure) et « effacer » — de quoi composer tout multiple de 50.
  - Avec Sniper, les deux affichent un tableau de **tous ceux qui sont devant**
    (hors joueurs arrivés à l'objectif, à l'abri), du plus proche au plus loin :
    l'écart exact pour tomber pile sur leur score, où ils retomberaient
    (`TieTarget.fallsTo`) et ce qu'ils perdraient. Ceux que le pot a déjà
    dépassés passent à la fin, grisés. Au-delà de quatre, le tableau défile.
  - Un pot qui atteint l'objectif change le bouton : « 🏆 Banquer 300 —
    victoire ! » (ou « objectif atteint » derrière un joueur arrivé avant avec
    autant ou plus), selon `bankOutcome`.
- **Règles (ⓘ)** : depuis l'accueil, la page décrit les réglages actuels et
  **toutes** les variantes ; ouverte pendant une partie (`?from=play`), les
  réglages de la partie et **ses seules** variantes (`GameDef.rulesDoc({ inGame })`).
- **Pause** : le bouton en haut à droite, à côté de ⓘ, ramène à l'accueil du
  5000. À la reprise, c'est le joueur dont c'est le tour qui est affiché — au
  5000, le joueur affiché est toujours celui qui joue.
- **Palmarès** — les records (`records.ts`) : quatre dont on est fier (victoire la plus
  rapide, plus gros tour banqué, plus de mains pleines en un tour, plus de
  victoires), quatre dont on rit (plus gros pot perdu, plus grosse chute, plus
  long temps d'entrée en jeu, partie la plus longue). Un record doit être
  **battu**, pas égalé. Une partie abandonnée ne compte pas. **Chaque objectif
  a ses records** (une victoire en 6 tours à 3 000 ne dit rien d'une partie à
  10 000) ; seules les victoires se comptent tous objectifs confondus. Les
  records d'avant cette séparation sont rangés sous 5 000.
- **Écran de fin** : la colonne « Tours » compte les tours joués, busts
  compris (`stats.turns`), pas les lignes de la feuille.

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

Toutes les lectures passent par un contrôle de forme (`readJson(key, guard)`)
ou une normalisation tolérante : un contenu abîmé est ignoré au lieu de faire
planter une page.

`migrate.ts` met les données d'anciennes versions au format courant, **une
fois par version** (marqueur `yams-schema-version`, actuellement 7). Elle est
**non destructive** : elle complète et répare, elle ne supprime que du JSON
illisible. Un nouveau format ⇒ incrémenter `SCHEMA_VERSION` et ajouter la
migration, avec son test. (Les records du 5000 se normalisent à la lecture,
`normalizeRecords`, sans passer par là.)

Au démarrage, l'application demande au navigateur un **stockage persistant**
(`core/storage/persist.ts`) : sans ça, Safari efface les données d'un site non
installé après sept jours sans visite. Si une écriture échoue (stockage plein
ou refusé), un bandeau rouge **« Impossible d'enregistrer »** le dit
(`core/storageAlert.ts`) au lieu d'un écran qui casse en silence.

## Sauvegarde et restauration

Les Paramètres exportent toutes les données dans un fichier JSON et savent le
relire. Le fichier (version 5) transporte un dictionnaire indexé par clé : les
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
- **Une page = exactement un `<h1>`**, puis `h2`/`h3` sans saut. Seul le menu
  des jeux l'affiche en grand.
- Les fragments communs sont injectés au build par le plugin `sharedHead` de
  `vite.config.ts`, depuis `htmlFragments.ts` : **une nouvelle page pose
  `<!--@head-->`** et se déclare dans `build.rollupOptions.input` ; un
  pictogramme ⓘ ou pause s'écrit `<!--@icon:info-->` / `<!--@icon:pause-->`
  (un marqueur inconnu fait échouer le build).
- **La feuille de style est découpée par domaine** (`src/styles/`, importés
  par `src/style.css`). L'ordre des imports est celui de l'ancienne feuille
  unique et il compte : des règles de même spécificité se départagent par leur
  position. Un déplacement se vérifie en comparant le CSS compilé.
- **Dialogues** : rien à déclarer en CSS, le gabarit est sur l'élément
  `dialog`. `makeDismissible(dialog, boutonId?)` ajoute la fermeture au clic sur
  le fond. Une action qui doit suivre une fermeture écoute l'événement `close`
  (Échap et le geste retour ferment aussi). Rien ne s'efface sans une pop‑up
  qui montre ce qui va disparaître.
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
- **Pas de caractère de police pour un pictogramme** (⚀, ⓘ, ⏸, ⌫, ⌄, ⠿…) :
  leur rendu varie d'un appareil à l'autre, jusqu'à ne pas s'afficher du tout.
  Faces de dé (`core/dice.ts`), ⓘ et pause (`htmlFragments.ts`), chevron,
  « effacer » et poignée des joueurs sont en SVG. Les emoji couleur (⚙️, ➡️,
  🗑️) s'affichent partout et restent.
- **Un bouton qui n'est pas un `.btn` pose sa couleur de texte et, s'il est rond
  ou de taille fixe, `padding: 0`** : la règle globale `button` écrit en blanc
  et ajoute une marge latérale. Il n'y a pas de survol global (`button:hover`) :
  sur tactile il restait collé après un toucher.
- **Les nombres affichés passent par `formatScore`** : la locale insère selon le
  navigateur une espace insécable fine ou ordinaire comme séparateur de milliers.
- **Commentaires en français, qui expliquent le pourquoi.**

### Navigation

- Une navigation **sans effet de bord** est un simple `<a href>` dans le HTML ;
  `goTo(page)` (`core/nav.ts`) ne sert qu'**après une écriture**.
- Quatre écrans lisent un paramètre d'URL : `settings.html?game=`,
  `rules.html?game=` (et `&from=play` : ouvertes depuis une partie, « Retour »
  y ramène), `yams-game.html?review=` et `5000-records.html?from=end`
  (« Retour » ramène au podium). Le service worker **ignore tous les
  paramètres** (`ignoreURLParametersMatching` dans `vite.config.ts`) : sinon
  ces adresses ne sont pas trouvées dans le précache, et l'application
  installée affiche le menu des jeux à leur place. Invisible en développement.
- Les écrans de jeu gardent **l'écran allumé** (`core/wakeLock.ts`) : le
  téléphone reste posé sur la table entre deux tours.

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
(saisie, calculette, fin de partie, retours). jsdom reste en version 25 : la
27 exige Node ≥ 22.12.

Ce qui relève d'une règle (fin de tour, main pleine, renommage…) reste dans
les modules testés sans DOM : **une règle de jeu ne s'écrit pas dans
`pages/`**.

## Ajouter un jeu

1. Son dossier `games/<jeu>/` : logique sans DOM et ses tests, dépôt de
   stockage, `rulesDoc`, et un `gameDef.ts` qui remplit `GameDef`.
2. Une ligne dans `games/registry.ts`, ses clés dans `core/storage/keys.ts`.
3. Ses pages (`<!--@head-->`, entrée dans `vite.config.ts`, `core/nav.ts` si on
   y navigue par `goTo`), et son panneau dans `settings.html` et
   `pages/settings.ts`. Son accueil reprend la barre du haut des autres
   (`.screen-bar-start` : le `<h1>` avec le bouton `game-switch`, et la liste
   `game-switcher` À CÔTÉ du titre ; `<!--@icon:info-->` pour les règles).
4. Si ses données changent un jour de forme : une migration dans
   `core/storage/migrate.ts` (ou une normalisation à la lecture), avec son
   test. Ses pages entrent dans le harnais de `src/test/pages/`.

Le menu des jeux, la sélection des joueurs, la page des règles, la sauvegarde et
l'administration des joueurs le prennent en compte sans autre modification.
