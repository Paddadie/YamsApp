// Bouchon de `virtual:pwa-register` pour les tests de pages : pas de service
// worker sous jsdom.
export function registerSW(): (reload?: boolean) => Promise<void> {
  return async () => {};
}
