// Accueil du Yams : choix des variantes, reprise d'une partie, accès au Hall
// of Fame. Le menu des jeux est un cran au-dessus (pages/home.ts).
//
// Ordre du module : gardes, constantes, fonctions, puis la mise en route tout
// en bas (README, « Conventions »).

import { bootstrap } from "../../core/bootstrap";
import { goTo } from "../../core/nav";
import { VARIANTS } from "../../games/yams/variants";
import { requireEl } from "../../core/ui";
import { setupGameSwitcher } from "../gameSwitcher";
import { hasSavedGame } from "../../games/yams/storage/savedGameRepo";
import { getDraft, saveDraft } from "../../core/storage/draftRepo";
import { YAMS, yamsConfigOf } from "../../games/yams/gameDef";
import type { Variant } from "../../games/yams/types";

bootstrap();

const container = document.querySelector<HTMLElement>(".variant-options");
if (!container) throw new Error("Conteneur .variant-options introuvable");
const optionsContainer = container; // alias non-null pour les fonctions

const startBtn = requireEl<HTMLButtonElement>("start-btn");
const resumeBtn = requireEl<HTMLButtonElement>("resume-btn");

// Variantes cochées au dernier passage ; à la toute première visite, la
// sélection par défaut de variants.ts. Un brouillon laissé par un autre jeu ne
// dit rien des variantes : on repart alors des valeurs par défaut.
const draft = getDraft();
const yamsDraft = draft?.gameId === YAMS.id ? draft : null;
const previouslyChosen = new Set(
  yamsDraft ? yamsConfigOf(yamsDraft).variants : [],
);
const hasDraft = previouslyChosen.size > 0;

const selectedVariants = (): Variant[] =>
  [
    ...optionsContainer.querySelectorAll<HTMLInputElement>(
      "input[name='variant']:checked",
    ),
  ].map((cb) => cb.value as Variant);

const syncStartButton = (): void => {
  startBtn.disabled = selectedVariants().length === 0;
};

function renderVariantChips(): void {
  for (const variant of VARIANTS) {
    const chip = document.createElement("label");
    chip.className = "variant-chip";
    chip.style.setProperty("--chip-color", variant.color);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "variant";
    checkbox.value = variant.value;
    checkbox.checked = hasDraft
      ? previouslyChosen.has(variant.value)
      : Boolean(variant.default);

    const icon = document.createElement("span");
    icon.className = "chip-icon";
    icon.textContent = variant.icon;
    icon.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "chip-label";
    label.textContent = variant.label;

    chip.append(checkbox, icon, label);
    optionsContainer.appendChild(chip);
  }
}

/* ---------- Mise en route ---------- */

setupGameSwitcher(YAMS.id);
renderVariantChips();
syncStartButton();
optionsContainer.addEventListener("change", syncStartButton);

if (hasSavedGame()) {
  resumeBtn.disabled = false;
  resumeBtn.addEventListener("click", () => goTo("yamsGame"));
} else {
  resumeBtn.hidden = true;
}

startBtn.addEventListener("click", () => {
  const selected = selectedVariants();
  if (selected.length === 0) return; // le bouton est déjà désactivé dans ce cas

  saveDraft({
    gameId: YAMS.id,
    playerNames: yamsDraft?.playerNames ?? [],
    config: { variants: selected },
  });
  goTo("players");
});
