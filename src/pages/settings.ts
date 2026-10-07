// Page Paramètres : les réglages communs à toute l'application, plus ceux du
// jeu d'où l'on vient.
//
// Ce que l'écran montre dépend de par où on y entre :
//   depuis le menu des jeux (settings.html)          → les communs seulement ;
//   depuis l'accueil d'un jeu (settings.html?game=…) → ses règles EN PLUS.
// On ne règle donc jamais le Yams depuis le 5000, ni depuis le menu : ses règles
// ne sont accessibles que de chez lui.
//
// Ordre du module : gardes, constantes, fonctions, puis la mise en route tout
// en bas (README, « Conventions »).
//
// Les modules de panneau sont évalués à l'import, donc AVANT le corps de ce
// fichier : ils ne doivent rien lire du stockage à leur niveau module, sinon la
// lecture passerait avant la migration faite par bootstrap(). Tout leur travail
// est dans leur `setup...()`, appelé par la mise en route ci-dessous.

import { bootstrap } from "../core/bootstrap";
import { requireEl } from "../core/ui";
import { gameById } from "../games/registry";
import type { GameDef } from "../games/types";
import { setupMessageDialog } from "./settings/dialogs";
import { setupRulesPanel } from "./settings/rulesPanel";
import { setupPlayersAdmin } from "./settings/playersAdmin";
import { setupYamsHallAdmin } from "./settings/yamsHallAdmin";
import { setupBackupPanel } from "./settings/backupPanel";
import { setupG5000Panel } from "./settings/g5000Panel";
import { setupG5000RecordsAdmin } from "./settings/g5000RecordsAdmin";

bootstrap();

/* ---------- Sections de la page ---------- */
// Motif ARIA "onglets" : les tuiles du haut sont un `tablist`, chaque section un
// `tabpanel`. Rien n'est mémorisé d'une visite à l'autre — on arrive toujours
// sur la première section affichée.

interface Panel {
  tab: string; // id du bouton d'onglet
  panel: string; // id du panneau
  setup: () => void;
}

// Panneau de réglages propre à un jeu. C'est une donnée d'interface : elle vit
// ici et non dans le registre, parce que `games/` n'a pas à connaître `pages/`.
// Un jeu ajouté écrit son panneau dans settings.html et ajoute une ligne ici.
const GAME_PANELS: Record<string, Panel> = {
  yams: {
    tab: "tab-scoring-yams",
    panel: "panel-scoring-yams",
    setup: setupRulesPanel,
  },
  g5000: {
    tab: "tab-rules-g5000",
    panel: "panel-rules-g5000",
    setup: setupG5000Panel,
  },
};

// Réglages qui ne dépendent d'aucun jeu, toujours présents.
const COMMON_PANELS: Panel[] = [
  {
    tab: "tab-data",
    panel: "panel-data",
    // Joueurs, puis ce que chaque jeu conserve à leur nom : les listes des jeux
    // se redessinent quand un joueur est renommé ou supprimé (SCORES_CHANGED).
    setup: () => {
      setupPlayersAdmin();
      setupYamsHallAdmin();
      setupG5000RecordsAdmin();
    },
  },
  { tab: "tab-backup", panel: "panel-backup", setup: setupBackupPanel },
];

function panelsFor(game: GameDef | undefined): Panel[] {
  const own = game ? GAME_PANELS[game.id] : undefined;
  return own ? [own, ...COMMON_PANELS] : COMMON_PANELS;
}

// Les panneaux des autres jeux existent dans le HTML mais n'ont rien à faire
// ici : on les retire de l'affichage plutôt que de les désactiver, sinon on
// laisserait croire qu'un réglage est momentanément indisponible.
function hideForeignPanels(visible: Panel[]): void {
  const shown = new Set(visible.map((p) => p.panel));
  for (const { tab, panel } of Object.values(GAME_PANELS)) {
    if (shown.has(panel)) continue;
    requireEl(tab).hidden = true;
    requireEl(panel).hidden = true;
  }
}

function setupPanels(panels: Panel[]): void {
  const tabs = panels.map((p) => requireEl<HTMLButtonElement>(p.tab));
  const body = document.querySelector<HTMLElement>(".screen-body");

  const show = (index: number): void => {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute("aria-selected", String(active));
      // Seul l'onglet actif reste dans l'ordre de tabulation : d'un onglet à
      // l'autre on se déplace aux flèches, comme l'attend le motif ARIA.
      tab.tabIndex = active ? 0 : -1;
      requireEl(panels[i].panel).hidden = !active;
    });
    // Sans ça, changer de section depuis le bas d'une longue liste laisse la
    // nouvelle section affichée dans le vide, hors de l'écran.
    body?.scrollTo({ top: 0 });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => show(index));
    tab.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (step === 0) return;
      e.preventDefault();
      const next = (index + step + tabs.length) % tabs.length;
      show(next);
      tabs[next].focus();
    });
  });

  show(0);
}

/* ---------- Retour ---------- */
// On arrive ici soit du menu des jeux, soit de l'accueil d'un jeu (qui passe
// alors `?game=`). Le bouton « Retour » ramène d'où l'on vient. L'identifiant
// est résolu par le registre, jamais utilisé tel quel comme URL : une valeur
// inconnue retombe simplement sur le menu.
function setupBackLink(game: GameDef | undefined): void {
  if (game) requireEl<HTMLAnchorElement>("back-btn").href = game.pages.home;
}

/* ---------- Mise en route ---------- */

const openedFrom = gameById(new URLSearchParams(location.search).get("game"));
const visiblePanels = panelsFor(openedFrom);

requireEl("app-version").textContent = `v${__APP_VERSION__}`;
requireEl("settings-title").textContent = openedFrom
  ? `⚙️ Paramètres · ${openedFrom.title}`
  : "⚙️ Paramètres";

setupBackLink(openedFrom);
setupMessageDialog();
hideForeignPanels(visiblePanels);
setupPanels(visiblePanels);
// Un panneau ne se prépare que s'il est à l'écran : inutile de lire les règles
// du Yams quand on vient du 5000.
for (const { setup } of visiblePanels) setup();
