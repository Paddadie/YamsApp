// Pastille ronde colorée portant l'icône d'une variante, comme les en-têtes de
// colonnes pendant une partie. La variante s'affiche par sa seule pastille,
// partout ; son nom reste dans l'infobulle.

import { badge, type Badge } from "../../core/ui";
import type { Variant } from "./types";
import { getVariantColor, getVariantIcon } from "./variants";

// En données, pour les récapitulatifs (cf. GameDef, SummaryValue).
export function variantBadgeData(variant: Variant): Badge {
  return { icon: getVariantIcon(variant), color: getVariantColor(variant), title: variant };
}

export function variantBadge(variant: Variant): HTMLElement {
  return badge(variantBadgeData(variant));
}
