// Source unique des variantes du 5000 : libellé, icône, couleur. L'accueil du
// jeu en tire ses puces, la page des règles ses paragraphes, le récapitulatif
// d'une partie ses pastilles. Ce qu'elles changent au jeu est dans rules.ts et
// engine.ts, qui ne demandent qu'une chose : `hasVariant`.

import type { IconName } from "../../core/iconPaths";
import type { G5000Rules, G5000Variant } from "./types";

export interface G5000VariantDef {
  id: G5000Variant;
  label: string;
  icon: IconName;
  color: string;
  // Quelques mots sous le nom, dans la puce de l'accueil : de quoi choisir
  // sans ouvrir les règles (demande de Paul). Le détail est dans rulesDoc.
  hint: string;
}

// L'ordre est celui des lignes de l'accueil et de la liste des règles (choisi
// par Paul le 08/10).
export const G5000_VARIANTS: G5000VariantDef[] = [
  {
    id: "sniper",
    label: "Sniper",
    icon: "crosshair",
    color: "#c62828",
    hint: "Tomber pile sur un adversaire le fait redescendre",
  },
  {
    id: "noFifty",
    label: "Sans demi-mesure",
    icon: "fifty",
    color: "#6a1b9a",
    hint: "Interdit de marquer un score en 50",
  },
  {
    id: "exact",
    label: "Dans le mille",
    icon: "bullseye",
    color: "#1565c0",
    hint: "L'objectif pile, pas un point de plus",
  },
  {
    id: "combo",
    label: "Combo",
    icon: "link",
    color: "#c25e00",
    hint: "Un brelan active son chiffre : +100 par dé",
  },
  {
    id: "freeHotDice",
    label: "Pas de zèle",
    icon: "stop",
    color: "#2e7d32",
    hint: "Main pleine : on peut s'arrêter",
  },
];

export const VARIANT_IDS: G5000Variant[] = G5000_VARIANTS.map((v) => v.id);

export function variantDef(id: G5000Variant): G5000VariantDef {
  return G5000_VARIANTS.find((v) => v.id === id) ?? G5000_VARIANTS[0];
}

export const hasVariant = (
  rules: Pick<G5000Rules, "variants">,
  id: G5000Variant,
): boolean => rules.variants.includes(id);
