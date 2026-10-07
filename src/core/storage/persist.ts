// Demande au navigateur de ne pas purger nos données.
//
// Sans ça, le stockage d'un site est « au mieux » : Safari efface celui d'un
// site non installé après sept jours sans visite, les autres navigateurs le
// vident quand l'appareil manque de place. Toutes les parties, joueurs et
// records vivent là. Une application installée l'obtient en général d'office ;
// la demande ne coûte rien ailleurs (Firefox peut poser la question une fois).
//
// Sans effet si le navigateur ne connaît pas l'API, et silencieux en cas de
// refus : il n'y a rien de plus à faire.
export function requestPersistentStorage(): void {
  const storage = navigator.storage;
  if (!storage?.persisted || !storage.persist) return;
  storage
    .persisted()
    .then((already) => (already ? true : storage.persist()))
    .catch(() => {});
}
