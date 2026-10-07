// Garder l'écran allumé pendant une partie.
//
// Le téléphone reste posé sur la table entre deux tours : sans ça, il se met en
// veille et il faut le déverrouiller à chaque fois qu'on veut noter un score.
// Le navigateur relâche le verrou dès que la page est cachée (autre
// application, écran éteint à la main) : on le redemande à son retour. Il
// disparaît de lui-même quand on quitte l'écran de jeu.
//
// Sans effet si le navigateur ne connaît pas l'API ou refuse (économie
// d'énergie) : l'écran se comporte alors comme d'habitude.

export function keepScreenOn(): void {
  const wakeLock = navigator.wakeLock;
  if (!wakeLock) return;

  const request = (): void => {
    if (document.visibilityState !== "visible") return;
    wakeLock.request("screen").catch(() => {});
  };

  document.addEventListener("visibilitychange", request);
  request();
}
