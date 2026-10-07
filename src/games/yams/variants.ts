// Source unique des variantes de jeu : libellé, icône, couleur, sélection par défaut.
// L'écran d'accueil génère les puces de choix à partir de cette liste.

import type { Variant, VariantConfig } from "./types";

export const VARIANTS: VariantConfig[] = [
  { value: "Classique", label: "Classique", icon: "🎲", color: "#3d9142", default: true },
  { value: "Montante", label: "Montante", icon: "⬆️", color: "#c97e1c" },
  { value: "Descendante", label: "Descendante", icon: "⬇️", color: "#3f51b5" },
  { value: "One Shot", label: "One Shot", icon: "🎯", color: "#d0553f" },
];

const ICONS: Record<string, string> = Object.fromEntries(
  VARIANTS.map((v) => [v.value, v.icon]),
);
const COLORS: Record<string, string> = Object.fromEntries(
  VARIANTS.map((v) => [v.value, v.color]),
);

export function getVariantIcon(variant: Variant): string {
  return ICONS[variant] ?? variant;
}

export function getVariantColor(variant: Variant): string {
  return COLORS[variant] ?? "#5b6b73";
}
