// Comparaison et tri des noms de joueurs.
//
// Un même joueur peut avoir été saisi « Jean », « jean » ou « Jean  » selon les
// versions et les claviers : toutes les recherches, suppressions et renommages
// comparent donc les noms sous leur forme repliée, jamais brut à brut.

export function foldName(name: string): string {
  return name.trim().toLowerCase();
}

export function sameName(a: string, b: string): boolean {
  return foldName(a) === foldName(b);
}

// « le tour d'Alice », « le tour de Bob » : « de » s'élide devant une voyelle,
// comme on le dit à la table. Devant un h ou un y, il reste : muet ou non, ça
// ne se devine pas au prénom (« de Hugo », « de Yann »).
export function ofName(name: string): string {
  return /^[aeiouàâäéèêëîïôöùûüœæ]/i.test(name.trim()) ? `d'${name}` : `de ${name}`;
}

// Tri alphabétique français, insensible à la casse et aux accents.
export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, "fr", { sensitivity: "base" });
}
