// Un objectif du 5000 à choisir (accueil du jeu, page des records) : un grand
// chiffre réglé, entouré au feutre une fois choisi. Le bouton radio est
// invisible, c'est le <label> qui se touche.

import { handCircle } from "../core/icons";

export function targetOption(
  value: number,
  text: string,
  checked: boolean,
): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = document.createElement("label");
  label.className = "target-opt";

  const input = document.createElement("input");
  input.type = "radio";
  input.name = "target";
  input.value = String(value);
  input.checked = checked;

  const num = document.createElement("span");
  num.className = "target-num circled";
  num.append(text, handCircle());

  label.append(input, num);
  return { label, input };
}
