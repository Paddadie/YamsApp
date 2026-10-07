// Mise en forme des nombres affichés.

// `toLocaleString("fr-FR")` sépare les milliers par une espace fine insécable
// (U+202F) sur certains navigateurs et par une insécable ordinaire (U+00A0) sur
// d'autres. Deux caractères invisibles, qui se ressemblent à l'œil et qui
// compliquent toute comparaison de texte — un test qui attend « 5 000 » échoue
// sur l'un et passe sur l'autre. On normalise donc sur l'espace ordinaire.
// `\s` couvre les deux, et tout ce que la locale pourrait encore inventer.
export function formatScore(value: number): string {
  return value.toLocaleString("fr-FR").replace(/\s/g, " ");
}
