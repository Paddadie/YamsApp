// Page d'accueil : choix des variantes, reprise d'une partie, accès au Hall of Fame.
//
// Ordre du module (commun aux six pages) : amorçage et gardes, puis les
// constantes, puis les fonctions, et enfin la mise en route tout en bas. Rien
// ne s'exécute avant que tout soit déclaré — une fonction remonte en haut du
// module, un `const` non, et le piège ne se voit ni à la compilation ni aux
// tests.

import { bootstrap } from "../bootstrap";
import { goTo } from "../nav";
import { VARIANTS } from "../variants";
import { requireEl } from "../ui";
import { hasSavedGame } from "../storage/savedGameRepo";
import { getDraft, saveDraft } from "../storage/draftRepo";
import type { Variant } from "../types";

bootstrap();

const container = document.querySelector<HTMLElement>(".variant-options");
if (!container) throw new Error("Conteneur .variant-options introuvable");
const optionsContainer = container; // alias non-null pour les fonctions

const startBtn = requireEl<HTMLButtonElement>("start-btn");
const resumeBtn = requireEl<HTMLButtonElement>("resume-btn");

// Variantes cochées au dernier passage ; à la toute première visite, la
// sélection par défaut de variants.ts.
const previouslyChosen = new Set(getDraft()?.variants ?? []);
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

renderVariantChips();
syncStartButton();
optionsContainer.addEventListener("change", syncStartButton);

if (hasSavedGame()) {
  resumeBtn.disabled = false;
  resumeBtn.addEventListener("click", () => goTo("game"));
} else {
  resumeBtn.hidden = true;
}

startBtn.addEventListener("click", () => {
  const selected = selectedVariants();
  if (selected.length === 0) return; // le bouton est déjà désactivé dans ce cas

  saveDraft({ variants: selected, playerNames: getDraft()?.playerNames ?? [] });
  goTo("players");
});
