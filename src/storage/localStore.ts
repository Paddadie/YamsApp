// Accès bas niveau à localStorage, sérialisé en JSON. Les repos typés
// (savedGameRepo, knownPlayersRepo, hallOfFameRepo) s'appuient dessus.

export function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
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

export function hasKey(key: string): boolean {
  return localStorage.getItem(key) !== null;
}
