// Page Paramètres, en trois sections exclusives (tuiles en haut d'écran) :
// règles du jeu, administration des joueurs et des scores, sauvegarde. Chaque
// section est un module à part ; ce fichier ne fait que les onglets.
//
// Ordre du module (commun aux six pages) : amorçage et gardes, puis les
// constantes, puis les fonctions, et enfin la mise en route tout en bas. Rien
// ne s'exécute avant que tout soit déclaré — une fonction remonte en haut du
// module, un `const` non, et le piège ne se voit ni à la compilation ni aux
// tests.
//
// Les modules de panneau sont évalués à l'import, donc AVANT le corps de ce
// fichier : ils ne doivent rien lire du stockage à leur niveau module, sinon la
// lecture passerait avant la migration faite par bootstrap(). Tout leur travail
// est dans leur `setup...()`, appelé par la mise en route ci-dessous.

import { bootstrap } from "../bootstrap";
import { requireEl } from "../ui";
import { setupMessageDialog } from "./settings/dialogs";
import { setupRulesPanel } from "./settings/rulesPanel";
import { setupDataPanel } from "./settings/dataPanel";
import { setupBackupPanel } from "./settings/backupPanel";

bootstrap();

/* ---------- Sections de la page ---------- */
// Motif ARIA "onglets" : les trois tuiles sont un `tablist`, chaque section un
// `tabpanel`. Rien n'est mémorisé d'une visite à l'autre — on revient toujours
// sur les règles, la section la plus consultée.

const PANELS = ["rules", "data", "backup"] as const;

function setupPanels(): void {
  const tabs = PANELS.map((name) => requireEl<HTMLButtonElement>(`tab-${name}`));
  const body = document.querySelector<HTMLElement>(".screen-body");

  const show = (index: number): void => {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute("aria-selected", String(active));
      // Seul l'onglet actif reste dans l'ordre de tabulation : d'un onglet à
      // l'autre on se déplace aux flèches, comme l'attend le motif ARIA.
      tab.tabIndex = active ? 0 : -1;
      requireEl(`panel-${PANELS[i]}`).hidden = !active;
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

/* ---------- Mise en route ---------- */

requireEl("app-version").textContent = `v${__APP_VERSION__}`;

setupMessageDialog();
setupPanels();
setupRulesPanel();
setupDataPanel();
setupBackupPanel();
