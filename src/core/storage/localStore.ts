// Accès bas niveau à localStorage, sérialisé en JSON. Les repos typés
// (savedGameRepo, knownPlayersRepo, hallOfFameRepo) s'appuient dessus.

// `guard` (optionnel) : si fourni et que le contenu ne passe pas, on renvoie
// null plutôt qu'une valeur mal typée. Chaque repo passe le sien.
export function readJson<T>(
  key: string,
  guard?: (value: unknown) => value is T,
): T | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (guard && !guard(parsed)) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeKey(key: string): void {
  localStorage.removeItem(key);
}
