// Changer de joueur au doigt, commun aux écrans de jeu (Yams, 5000) : même
// effet que les flèches ou les onglets.
//
// Deux façons d'aboutir : un glissement franc, ou un petit coup de doigt rapide
// — sinon un swipe vif mais court, très naturel au pouce, ne déclencherait rien.
//
// Souris exclue volontairement : sur un vrai pointeur, un glissement horizontal
// sert à sélectionner du texte, pas à tourner la page.
//
// Pas de setPointerCapture : capturer dès le pointerdown volerait au navigateur
// le défilement vertical. On observe le geste, et c'est seulement quand il part
// clairement à l'horizontale qu'on se l'approprie. Dans le cas inverse le
// navigateur défile et nous envoie un pointercancel.
//
// ⚠️ L'élément doit porter `touch-action: pan-y pinch-zoom` en CSS. Avec `auto`,
// le navigateur reste propriétaire du geste, le prend pour un défilement,
// envoie un pointercancel et coupe les pointermove : le swipe ne se déclenche
// jamais. `pinch-zoom` est là parce que `pan-y` seul supprimerait le zoom.

const SWIPE_MIN_PX = 60;
const SWIPE_FLICK_MS = 250;
const SWIPE_FLICK_PX = 25;
// En deçà, le geste reste indécis : on ne le confisque pas au contenu, qui doit
// pouvoir défiler verticalement.
const SWIPE_LOCK_PX = 12;

export interface SwipeOptions {
  // Un geste qui commence ici n'est pas un changement de joueur (zone qui
  // défile elle-même à l'horizontale, par exemple).
  ignore?: (target: EventTarget | null) => boolean;
}

// `onSwipe(1)` : joueur suivant (la page part à gauche, comme la flèche ➡️) ;
// `onSwipe(-1)` : joueur précédent.
export function onHorizontalSwipe(
  el: HTMLElement,
  onSwipe: (direction: 1 | -1) => void,
  options: SwipeOptions = {},
): void {
  let id: number | undefined;
  let startX = 0;
  let startY = 0;
  let startAt = 0;
  // Geste reconnu comme horizontal : à partir de là il nous appartient.
  let taken = false;
  // Un geste horizontal vient de se terminer : le clic qu'il produit est à jeter.
  let clickPending = false;

  const reset = (): void => {
    id = undefined;
    taken = false;
  };

  el.addEventListener("pointerdown", (e) => {
    // Un geste précédent peut ne pas avoir produit de clic (élément reconstruit,
    // doigt relâché hors d'un bouton) : le drapeau se purge ici, jamais plus tard.
    clickPending = false;
    if (e.pointerType === "mouse" || !e.isPrimary) return;
    if (options.ignore?.(e.target)) return;
    id = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    startAt = e.timeStamp;
    taken = false;
  });

  el.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id || taken) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    // L'axe dominant décide, une fois pour toutes : un swipe qui dérive ensuite
    // vers le bas reste un swipe, et un défilement amorcé ne devient jamais un
    // changement de joueur.
    if (Math.abs(dx) < SWIPE_LOCK_PX || Math.abs(dx) <= Math.abs(dy)) return;
    taken = true;
  });

  el.addEventListener("pointerup", (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - startX;
    const elapsed = e.timeStamp - startAt;
    const wasTaken = taken;
    reset();
    if (!wasTaken) return;

    // Même en deçà du seuil (glissement hésitant, ou aller-retour) : le doigt a
    // balayé l'écran, il n'a pas visé un bouton.
    clickPending = true;

    const far = Math.abs(dx) >= SWIPE_MIN_PX;
    const flick = elapsed <= SWIPE_FLICK_MS && Math.abs(dx) >= SWIPE_FLICK_PX;
    if (far || flick) onSwipe(dx < 0 ? 1 : -1);
  });

  el.addEventListener("pointercancel", reset);

  // En capture : le clic de fin de geste doit être coupé avant d'atteindre
  // l'élément survolé, qui ouvrirait sa fenêtre de saisie.
  el.addEventListener(
    "click",
    (e) => {
      if (!clickPending) return;
      clickPending = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );
}
