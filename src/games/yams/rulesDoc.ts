// Les règles du Yams telles qu'on les explique au joueur, construites à partir
// des réglages en vigueur. Aucun accès au DOM : c'est ce qui permet de tester
// que le barème annoncé est bien celui que la partie appliquera.
//
// Ce module décrit, il ne décide pas : toutes les valeurs viennent de
// `GameRules`, et les libellés des lignes de `buildGrid`, la même fonction qui
// construit la grille de jeu. Si un jour le barème change de forme, cette page
// suivra ou un test cassera — elle ne peut pas diverger en silence.

import type { RulesSection } from "../types";
import type { GameRules, GroupMode } from "./types";
import { BONUS_THRESHOLD, GROUP_SIZE } from "./scoring";
import { VARIANTS } from "./variants";

// « Somme des 5 dés », « somme des 3 dés de la combinaison » ou « 25 points » :
// ce que rapporte une ligne réglable. `size` : nombre de dés de la combinaison
// (Brelan 3, Carré 4), pour le mode « dés de la combinaison ».
export function modeText(mode: GroupMode, size = 5): string {
  if (mode.type === "sum") return "la somme des 5 dés";
  if (mode.type === "dice") return `la somme des ${size} dés de la combinaison`;
  return `${mode.points} point${mode.points > 1 ? "s" : ""}`;
}

// Les combinaisons de la section basse, dans l'ordre de la grille. La Chance
// n'y figure que si elle est activée.
export function combinationRows(rules: GameRules): [string, string][] {
  const rows: [string, string][] = [
    ["Brelan — 3 dés identiques", modeText(rules.brelan, GROUP_SIZE.brelan)],
    ["Full — 3 + 2 dés identiques", modeText(rules.full)],
    ["Carré — 4 dés identiques", modeText(rules.carre, GROUP_SIZE.carre)],
    ["Petite suite — 4 dés qui se suivent", modeText(rules.petiteSuite)],
    ["Grande suite — 5 dés qui se suivent", modeText(rules.grandeSuite)],
  ];
  if (rules.chance) {
    rows.push(["Chance — n'importe quels dés", "la somme des 5 dés"]);
  }
  rows.push(["Yams — 5 dés identiques", modeText(rules.yams)]);
  return rows;
}

export function yamsRulesDoc(rules: GameRules): RulesSection[] {
  return [
    {
      title: "Le but",
      body: [
        "Remplir sa feuille de score case par case. Chaque case ne se remplit qu'une fois, et une case qu'on ne peut pas remplir se barre à zéro. Le plus grand total gagne.",
      ],
    },
    {
      title: "Un tour",
      body: [
        "Lancez les 5 dés. Vous pouvez relancer deux fois de plus, en gardant à chaque fois les dés que vous voulez — y compris en reprenant un dé mis de côté au lancer précédent.",
        "À la fin de votre tour, vous inscrivez votre résultat dans une case, et une seule. Si rien ne convient, vous barrez une case à zéro.",
      ],
    },
    {
      title: "La section des chiffres",
      body: [
        "Les six premières lignes ne comptent que les dés du chiffre concerné : trois 4 valent 12 sur la ligne des 4, et le reste des dés ne compte pas.",
        `Atteignez ${BONUS_THRESHOLD} points sur ces six lignes et vous décrochez le bonus. ${BONUS_THRESHOLD} points, c'est trois dés de chaque chiffre — mais tout autre chemin fait l'affaire.`,
      ],
    },
    {
      title: "Les combinaisons",
      table: {
        head: ["Combinaison", "Rapporte"],
        rows: [
          ...combinationRows(rules),
          [`Bonus — ${BONUS_THRESHOLD}+ dans la section des chiffres`, `${rules.bonus} points`],
        ],
        note: "D'après vos réglages. Modifiables dans ⚙️ Barème du Yams.",
      },
    },
    {
      title: "Les variantes",
      body: [
        "Vous pouvez jouer plusieurs variantes dans la même partie : chacune a sa colonne, et le classement se fait sur le total de toutes.",
        ...VARIANTS.map((variant) => `${variant.icon} ${variant.label} — ${VARIANT_TEXT[variant.value]}`),
      ],
    },
  ];
}

// Ce que chaque variante change. Seules la Montante et la Descendante sont
// tenues par l'application (elle verrouille les cases dans l'ordre) ; les deux
// autres reposent sur un accord entre joueurs.
const VARIANT_TEXT: Record<string, string> = {
  Classique: "les cases se remplissent dans l'ordre que vous voulez.",
  Montante:
    "les cases se remplissent de bas en haut, du Yams vers les chiffres. L'application verrouille les suivantes.",
  Descendante:
    "les cases se remplissent de haut en bas, des chiffres vers le Yams. L'application verrouille les suivantes.",
  "One Shot":
    "un seul lancer par tour, sans relance. L'application ne le vérifie pas : c'est à la table de s'y tenir.",
};
