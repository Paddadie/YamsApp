// Source unique des variantes de jeu : libellé, icône, sélection par défaut.
// L'écran d'accueil génère les cases à cocher à partir de cette liste.

import type { Variant, VariantConfig } from "./types";

export const VARIANTS: VariantConfig[] = [
  { value: "Classique", label: "Classique", icon: "🎲", default: true },
  { value: "Montante", label: "Montante", icon: "⬆️" },
  { value: "Descendante", label: "Descendante", icon: "⬇️" },
  { value: "One Shot", label: "One Shot", icon: "🎯" },
];

const ICONS: Record<string, string> = Object.fromEntries(
  VARIANTS.map((v) => [v.value, v.icon]),
);

export function getVariantIcon(variant: Variant): string {
  return ICONS[variant] ?? variant;
}
