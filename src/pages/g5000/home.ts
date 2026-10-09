// Accueil du 5000 : objectif et variantes de la partie, reprise, accès aux
// règles et aux réglages. Le menu des jeux est un cran au-dessus
// (pages/home.ts).
//
// L'objectif et les variantes sont posés ici parce qu'on les change d'une
// partie à l'autre, comme les variantes du Yams. Le reste (entrée en jeu,
// busts d'affilée, barème) vit dans ⚙️ : on y touche une fois puis plus
// jamais.
//
// Ordre du module : gardes, constantes, fonctions, puis la mise en route tout
// en bas (README, « Conventions »).

import { bootstrap } from "../../core/bootstrap";
import { goTo } from "../../core/nav";
import { requireEl } from "../../core/ui";
import { formatScore } from "../../core/format";
import { getDraft, saveDraft } from "../../core/storage/draftRepo";
import { fitHomeToScreen, setupGameHero, showResumeCard } from "../gameHero";
import { targetOption } from "../targetOption";
import { icon } from "../../core/icons";
import { G5000, G5000_ID } from "../../games/g5000/gameDef";
import { getRules, hasSavedGame, saveRules } from "../../games/g5000/repo";
import { DEFAULT_RULES, TARGETS } from "../../games/g5000/rules";
import { G5000_VARIANTS } from "../../games/g5000/variants";
import type { G5000Rules } from "../../games/g5000/types";

bootstrap();

const targetOptions = requireEl("target-options");
const variantOptions = requireEl("g5000-variant-options");
const startBtn = requireEl<HTMLButtonElement>("start-btn");
const resumeBtn = requireEl<HTMLButtonElement>("resume-btn");

// Enregistré tout de suite, à chaque toucher : objectif et variantes sont des
// réglages, ils survivent au retour en arrière et se retrouvent à la partie
// suivante, comme les variantes cochées du Yams.
function remember(patch: Partial<G5000Rules>): void {
  saveRules({ ...getRules(), ...patch });
}

function renderTargets(): void {
  const current = getRules().target;
  targetOptions.replaceChildren();
  for (const value of TARGETS) {
    const option = targetOption(value, formatScore(value), value === current);
    option.input.addEventListener("change", () => remember({ target: value }));
    targetOptions.appendChild(option.label);
  }
}

function renderVariants(): void {
  const chosen = new Set(getRules().variants);
  variantOptions.replaceChildren();
  for (const variant of G5000_VARIANTS) {
    const chip = document.createElement("label");
    chip.className = "variant-row";
    chip.style.setProperty("--chip-color", variant.color);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "variant";
    checkbox.value = variant.id;
    checkbox.checked = chosen.has(variant.id);
    checkbox.addEventListener("change", () => {
      const variants = G5000_VARIANTS.map((v) => v.id).filter(
        (id) =>
          variantOptions.querySelector<HTMLInputElement>(`input[value="${id}"]`)?.checked,
      );
      remember({ variants });
    });

    const pictogram = document.createElement("span");
    pictogram.className = "chip-icon";
    pictogram.appendChild(icon(variant.icon));

    // Le nom dans un <span> : c'est lui que le feutre surligne une fois cochée.
    const name = document.createElement("span");
    name.className = "variant-name";
    const nameText = document.createElement("span");
    nameText.textContent = variant.label;
    name.appendChild(nameText);

    const hint = document.createElement("span");
    hint.className = "chip-hint";
    hint.textContent = variant.hint;

    const text = document.createElement("span");
    text.className = "variant-text";
    text.append(name, hint);

    const box = document.createElement("span");
    box.className = "check-box";

    chip.append(checkbox, pictogram, text, box);
    variantOptions.appendChild(chip);
  }
}

/* ---------- Mise en route ---------- */

// Un objectif qui n'est plus proposé (3 000, ou une valeur saisie dans ⚙️
// avant le 07/10/2026) revient à 5 000 : la partie lancée doit jouer l'objectif
// coché à l'écran.
if (!TARGETS.includes(getRules().target)) remember({ target: DEFAULT_RULES.target });

setupGameHero(G5000_ID);
renderTargets();
renderVariants();

if (hasSavedGame()) {
  showResumeCard(G5000.resume());
  resumeBtn.disabled = false;
  resumeBtn.addEventListener("click", () => goTo("g5000Game"));
}
// Une fois tout posé (variantes, partie en cours) : l'accueil tient sur l'écran.
fitHomeToScreen();

startBtn.addEventListener("click", () => {
  const draft = getDraft();
  saveDraft({
    gameId: G5000_ID,
    playerNames: draft?.gameId === G5000_ID ? draft.playerNames : [],
    config: {},
  });
  goTo("players");
});
