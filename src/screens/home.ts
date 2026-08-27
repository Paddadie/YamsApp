// Écran d'accueil : cases à cocher des variantes (générées depuis variants.ts)
// et lancement de la sélection des joueurs.

import { showScreen } from "../navigation";
import { VARIANTS } from "../variants";
import { game, resetPlayersScores } from "../state";
import { clearSavedGame } from "../storage/savedGameRepo";
import { renderKnownPlayers } from "./players";
import type { Variant } from "../types";

export function initHome(): void {
  const optionsContainer = document.querySelector<HTMLElement>(".variant-options");
  if (!optionsContainer) throw new Error("Conteneur .variant-options introuvable");

  optionsContainer.innerHTML = "";
  for (const variant of VARIANTS) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "variant";
    checkbox.value = variant.value;
    checkbox.checked = Boolean(variant.default);
    label.append(checkbox, ` ${variant.label} ${variant.icon}`);
    optionsContainer.appendChild(label);
  }

  const startBtn = document.getElementById("start-btn");
  startBtn?.addEventListener("click", () => {
    const selected = [
      ...optionsContainer.querySelectorAll<HTMLInputElement>(
        "input[name='variant']:checked",
      ),
    ].map((cb) => cb.value as Variant);

    if (selected.length === 0) {
      alert("Veuillez sélectionner au moins une variante.");
      return;
    }

    game.variants = selected;
    clearSavedGame();
    resetPlayersScores();

    showScreen("players");
    renderKnownPlayers();
  });
}
