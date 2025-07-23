export function getVariantIcon(variant) {
  switch (variant) {
    case "Classique": return "🎲";
    case "Montante": return "⬆️";
    case "Descendante": return "⬇️";
    case "One Shot": return "🎯";
    default: return variant;
  }
}
