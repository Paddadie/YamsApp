# Yams

Application de **feuille de score de Yams**, sans back‑end : une PWA statique
(HTML + CSS + modules ES natifs, aucune dépendance, aucun build).
Ouvrir `index.html` via un petit serveur statique suffit à la lancer.

## Écrans

Accueil → Joueurs → Jeu → Fin de partie, plus le Hall of Fame.
Un seul `<div class="screen">` porte la classe `.active` à la fois ; toute la
bascule passe par `showScreen()` dans `js/navigation.js`. Le CSS gère
l'affichage (`.screen` / `.screen.active`), le JS ne touche jamais à `display`.

## Organisation de `js/`

| Fichier | Rôle |
|---|---|
| `main.js` | Point d'entrée : appelle les `init*()` au chargement du DOM. |
| `state.js` | Modèle de la partie (`game` : joueurs, variantes, joueur courant) + mutations. |
| `storage.js` | **Toute** la persistance `localStorage` : les clés et des accesseurs typés. |
| `scoring.js` | Règles du Yams : définition des sections et calculs. Aucun DOM. |
| `variants.js` | Source unique des variantes (libellé, icône, défaut). |
| `ui.js` | Helpers de rendu DOM partagés (`renderList`, `appendRows`, `renderTable`). |
| `navigation.js` | `showScreen()` + boutons transverses (reprendre, Hall of Fame, retour, version). |
| `home.js` | Écran d'accueil : cases de variantes (générées) et lancement. |
| `players.js` | Écran d'ajout des joueurs. |
| `game.js` | Écran de jeu : grille de score, navigation joueurs, sauvegarde / reprise. |
| `endScreen.js` | Écran de fin : podium et classement. |
| `hallOfFame.js` | Meilleurs et pires scores, conservés entre les parties. |

Règle de dépendances : `navigation` / `home` / `players` / `game` / `endScreen`
sont les modules d'**écran** ; ils s'appuient sur `state`, `storage`, `scoring`,
`variants` et `ui`, jamais l'inverse.

## Service worker et versions

`version.json` porte la version (ex. `v3.7.0`). `sw.js` s'en sert comme nom de
cache : **incrémenter `version.json` à chaque changement d'un fichier listé dans
`ASSETS`** pour forcer le rafraîchissement du cache. La liste `ASSETS` doit
rester synchronisée avec le contenu de `js/`.
