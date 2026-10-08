// Source unique des variantes de jeu : libellé, icône, couleur, sélection par défaut.
// L'écran d'accueil génère les puces de choix à partir de cette liste.

import type { IconName } from "../../core/iconPaths";
import type { Variant, VariantConfig } from "./types";

// Phrases choisies par Paul (08/10) : courtes, la tuile est étroite.
export const VARIANTS: VariantConfig[] = [
  {
    value: "Classique",
    label: "Classique",
    icon: "die",
    color: "#3d9142",
    hint: "La règle de base",
    default: true,
  },
  { value: "Montante", label: "Montante", icon: "up", color: "#c97e1c", hint: "Du Yams vers les chiffres" },
  {
    value: "Descendante",
    label: "Descendante",
    icon: "down",
    color: "#3f51b5",
    hint: "Des chiffres vers le Yams",
  },
  { value: "One Shot", label: "One Shot", icon: "bolt", color: "#d0553f", hint: "Un seul lancer, sans relance" },
];

const ICONS: Record<string, IconName> = Object.fromEntries(
  VARIANTS.map((v) => [v.value, v.icon]),
);
const COLORS: Record<string, string> = Object.fromEntries(
  VARIANTS.map((v) => [v.value, v.color]),
);

export function getVariantIcon(variant: Variant): IconName {
  return ICONS[variant] ?? "die";
}

export function getVariantColor(variant: Variant): string {
  return COLORS[variant] ?? "#5b6b73";
}
