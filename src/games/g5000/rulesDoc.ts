// Les règles du 5000 telles qu'on les explique au joueur, construites à partir
// des réglages en vigueur. Aucun accès au DOM : c'est ce qui permet de tester
// que le barème annoncé est bien celui que la partie appliquera.
//
// Écrites pour quelqu'un qui n'a jamais joué, et courtes (demande de Paul,
// 07/10/2026) : une phrase par idée, le barème en tableau, les détails de
// calcul laissés à la calculette.
//
// Depuis le menu du jeu, la page décrit TOUTES les variantes ; ouverte pendant
// une partie, seulement celles de la partie (`scope`).

import type { RulesExample, RulesSection } from "../types";
import { formatScore } from "../../core/format";
import { FACES, bestValue, countsOf, figureValue, groupValue } from "./rules";
import type { Face, G5000Rules, G5000Variant } from "./types";
import { G5000_VARIANTS } from "./variants";

const pts = (n: number): string => `${formatScore(n)} point${n > 1 ? "s" : ""}`;

// « 2 × le brelan », « 1,5 × le brelan » : les mots des Paramètres, et assez
// court pour laisser sa place au nom de la combinaison sur un téléphone.
const factorText = (factor: number, of: string): string =>
  `${String(factor).replace(".", ",")} × le ${of}`;

// Une figure aux valeurs saisies dans ⚙️ : une ligne par chiffre, aucune
// formule ne les résume.
const perFace = (name: string, size: number, rules: G5000Rules): [string, string][] =>
  FACES.map((face) => [`${name} de ${face}`, pts(figureValue(face, size, rules))]);

// Des lancers en vrais dés, comptés par le moteur (bestValue) : l'exemple suit
// le barème réglé. Les dés qui ne rapportent rien sont pâlis.
export function scoringExamples(rules: G5000Rules): RulesExample[] {
  const value = (dice: Face[]): number => bestValue(countsOf(dice), [], rules);
  const examples: RulesExample[] = [
    {
      dice: [1, 1, 1, 5, 3],
      counted: [0, 1, 2, 3],
      result: `Brelan de 1 et un 5 → ${pts(value([1, 1, 1, 5]))}`,
    },
    { dice: [2, 2, 4, 6, 3], counted: [], result: "Rien ne rapporte → bust" },
  ];
  if (rules.runPoints > 0) {
    examples.push({ dice: [1, 2, 3, 4, 5], result: `Suite → ${pts(value([1, 2, 3, 4, 5]))}` });
  }
  return examples;
}

// Le barème, ligne par ligne, calculé par les mêmes fonctions que le jeu.
export function scoringRows(rules: G5000Rules): [string, string][] {
  const rows: [string, string][] = [
    ["Un 1", pts(groupValue(1, 1, false, rules))],
    ["Un 5", pts(groupValue(5, 1, false, rules))],
  ];
  if (rules.tripleKind === "custom") {
    rows.push(...perFace("Brelan", 3, rules));
  } else {
    rows.push(
      ["Brelan de 1", pts(figureValue(1, 3, rules))],
      // Calculées, pas recopiées : si le barème bouge, la page suit.
      // « 200 · 300 · 400 · 500 · 600 » se lit mieux qu'une formule.
      [
        "Brelan de 2 à 6",
        FACES.filter((f) => f !== 1)
          .map((f) => formatScore(figureValue(f, 3, rules)))
          .join(" · "),
      ],
    );
  }
  if (rules.fourKind === "custom") rows.push(...perFace("Carré", 4, rules));
  else rows.push(["Carré", factorText(rules.fourKind === "half" ? 1.5 : 2, "brelan")]);

  if (rules.fiveKind === "custom") rows.push(...perFace("Quinte", 5, rules));
  else rows.push(["Quinte", factorText(2, rules.fiveKind === "doubleThree" ? "brelan" : "carré")]);

  if (rules.runPoints > 0) {
    rows.push(["Suite 1 à 5 ou 2 à 6", pts(rules.runPoints)]);
  }
  return rows;
}

function variantText(id: G5000Variant, rules: G5000Rules): string {
  switch (id) {
    case "sniper":
      return "Tombez pile sur le score d'un adversaire : il redescend à son score précédent. S'il retombe sur le score d'un autre, celui-ci redescend aussi, et ainsi de suite.";
    case "exact":
      return `Il faut faire exactement ${pts(rules.target)}. Un tour qui dépasse compte comme un bust.`;
    case "noFifty":
      return "Impossible de marquer un tour qui finit par 50 (350, 1 250…) : relancez jusqu'à un compte rond, ou perdez tout.";
    case "freeHotDice":
      return "Après une main pleine, relancer n'est plus obligatoire : vous pouvez aussi marquer vos points.";
    case "combo":
      return `Un brelan, un carré ou une quinte active son chiffre jusqu'à la fin du tour : chaque nouveau dé de ce chiffre rapporte 100 points de plus (un 3 vaut ${groupValue(3, 1, true, rules)}, un 1 vaut ${groupValue(1, 1, true, rules)}, un 5 vaut ${groupValue(5, 1, true, rules)}).`;
  }
}

export type RulesScope = "all" | "game";

export function g5000RulesDoc(rules: G5000Rules, scope: RulesScope = "all"): RulesSection[] {
  const sections: RulesSection[] = [
    {
      title: "Le but",
      body: [
        `Être le premier à atteindre ${pts(rules.target)}. On joue chacun son tour avec 5 dés.`,
      ],
    },
    {
      title: "Votre tour",
      body: [
        "Lancez les 5 dés et mettez de côté au moins un dé qui rapporte des points (voir le barème).",
        "Puis, au choix : relancez les dés qui restent pour gagner plus, ou arrêtez-vous et marquez les points du tour.",
        "Un lancer qui ne rapporte rien, c'est un bust : vous perdez tous les points du tour.",
        "Si tous vos dés ont rapporté, c'est une main pleine : reprenez les 5 dés, vous devez relancer.",
      ],
    },
    {
      title: "Le barème",
      examples: scoringExamples(rules),
      table: {
        head: ["Combinaison", "Rapporte"],
        rows: scoringRows(rules),
        note: "Brelan, carré, quinte : 3, 4 ou 5 dés identiques, sortis d'un seul lancer. Un 2, 3, 4 ou 6 seul ne rapporte rien.",
      },
    },
  ];

  if (rules.openAt > 0) {
    sections.push({
      title: "Entrer en jeu",
      body: [
        `Votre premier score doit faire au moins ${pts(rules.openAt)} en un seul tour. En dessous, il ne compte pas.`,
      ],
    });
  }

  if (rules.blankTurnsPenalty > 0) {
    sections.push({
      title: "Les busts d'affilée",
      body: [
        `${rules.blankTurnsPenalty} busts de suite vous font redescendre à votre score précédent.`,
      ],
    });
  }

  sections.push({
    title: "La fin",
    body: [
      rules.lastRound
        ? "Dès qu'un joueur atteint l'objectif, chaque adversaire joue un dernier tour pour tenter de le dépasser."
        : "Dès qu'un joueur atteint l'objectif, on finit le tour de table : tout le monde a joué autant de tours. Si c'était le dernier joueur du tour, la partie s'arrête là.",
      "Qui a atteint l'objectif ne peut plus redescendre. À score égal, le premier arrivé passe devant.",
    ],
  });

  const shown = G5000_VARIANTS.filter(
    (v) => scope === "all" || rules.variants.includes(v.id),
  );
  if (shown.length > 0) {
    sections.push({
      title: scope === "all" ? "Les variantes" : "Les variantes de la partie",
      body: scope === "all" ? ["À cocher sur l'accueil du 5000, avant la partie."] : [],
      items: shown.map((v) => ({
        icon: v.icon,
        color: v.color,
        title: v.label,
        text: variantText(v.id, rules),
      })),
      kind: "variants",
    });
  }

  return sections;
}
