// Écran d'accueil : cases à cocher des variantes (générées depuis variants.js)
// et lancement de la sélection des joueurs.

import { showScreen } from "./navigation.js";
import { VARIANTS } from "./variants.js";
import { game, resetPlayersScores } from "./state.js";
import { clearSavedGame } from "./storage.js";
import { renderKnownPlayers } from "./players.js";

export function initHome() {
  const optionsContainer = document.querySelector(".variant-options");

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

  document.getElementById("start-btn").addEventListener("click", () => {
    const selected = [
      ...optionsContainer.querySelectorAll("input[name='variant']:checked"),
    ].map((cb) => cb.value);

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
