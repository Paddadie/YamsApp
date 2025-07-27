export const SAVED_GAME_KEY = "yams-saved-game";
export const SAVED_NAMES_KEY = "yams-player-names";

export function getVariantIcon(variant) {
  switch (variant) {
    case "Classique": return "🎲";
    case "Montante": return "⬆️";
    case "Descendante": return "⬇️";
    case "One Shot": return "🎯";
    default: return variant;
  }
}
