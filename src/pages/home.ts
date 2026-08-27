// Page d'accueil : choix des variantes, reprise d'une partie, accès au Hall of Fame.

import { bootstrap } from "../bootstrap";
import { goTo } from "../nav";
import { VARIANTS } from "../variants";
import { requireEl } from "../ui";
import { hasSavedGame } from "../storage/savedGameRepo";
import { getDraft, saveDraft } from "../storage/draftRepo";
import type { Variant } from "../types";

bootstrap();

const optionsContainer = document.querySelector<HTMLElement>(".variant-options");
if (!optionsContainer) throw new Error("Conteneur .variant-options introuvable");

const previouslyChosen = new Set(getDraft()?.variants ?? []);
const hasDraft = previouslyChosen.size > 0;

for (const variant of VARIANTS) {
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.name = "variant";
  checkbox.value = variant.value;
  checkbox.checked = hasDraft
    ? previouslyChosen.has(variant.value)
    : Boolean(variant.default);
  label.append(checkbox, ` ${variant.label} ${variant.icon}`);
  optionsContainer.appendChild(label);
}

const resumeBtn = requireEl<HTMLButtonElement>("resume-btn");
const canResume = hasSavedGame();
resumeBtn.disabled = !canResume;
resumeBtn.classList.toggle("hidden", !canResume);
resumeBtn.addEventListener("click", () => {
  if (canResume) goTo("game");
});

requireEl("start-btn").addEventListener("click", () => {
  const selected = [
    ...optionsContainer.querySelectorAll<HTMLInputElement>(
      "input[name='variant']:checked",
    ),
  ].map((cb) => cb.value as Variant);

  if (selected.length === 0) {
    alert("Veuillez sélectionner au moins une variante.");
    return;
  }

  saveDraft({ variants: selected, playerNames: getDraft()?.playerNames ?? [] });
  goTo("players");
});

requireEl("hall-btn").addEventListener("click", () => goTo("hall"));
