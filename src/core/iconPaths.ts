// Tracés des pictogrammes de l'application : un seul dessin au trait, à la
// couleur du texte (currentColor), dans un repère de 24 × 24.
//
// Sans accès au DOM : ce module sert aussi au build (htmlFragments.ts injecte
// les pictogrammes écrits dans les pages HTML avec <!--@icon:nom-->). Le rendu
// en élément SVG pour les écrans est dans icons.ts.
//
// Aucun emoji ni caractère de police à leur place : un emoji est dessiné par la
// police de l'appareil (taille, style et centrage variables, parfois rien du
// tout), et cinq styles d'icônes se côtoyaient. Tout est désormais tracé ici.

const dot = (cx: number, cy: number, r = 1.3): string =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor" stroke="none"/>`;

export const ICON_PATHS = {
  info: `<circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5"/>${dot(12, 7.6, 1.15)}`,
  pause: '<circle cx="12" cy="12" r="9.5"/><path d="M10 9v6M14 9v6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  play: '<path d="M7 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  check: '<path d="M5 12.5l4.3 4.3L19 7"/>',
  // La coche « au feutre » : un peu de travers, comme tracée à la main.
  tick: '<path d="M4 13c3 2 4 4 6 6.5C13 12 16 8 21 3.5"/>',
  trophy:
    '<path d="M8 21h8M12 16.5V21M7 4h10v5.5a5 5 0 0 1-10 0z"/><path d="M17 5.5h2.5v1.5A3.5 3.5 0 0 1 16.4 10.5M7 5.5H4.5v1.5A3.5 3.5 0 0 0 7.6 10.5"/>',
  crown: '<path d="M4 18.5h16M4.5 15.5L3 7l5 4 4-6 4 6 5-4-1.5 8.5z"/>',
  die: `<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/>${dot(8.5, 8.5)}${dot(15.5, 8.5)}${dot(12, 12)}${dot(8.5, 15.5)}${dot(15.5, 15.5)}`,
  // Emblèmes des jeux (ex-🍀 et 💰).
  clover:
    '<circle cx="12" cy="7.6" r="3.4"/><circle cx="16.4" cy="12" r="3.4"/><circle cx="12" cy="16.4" r="3.4"/><circle cx="7.6" cy="12" r="3.4"/><path d="M14.5 14.5l5.5 6"/>',
  bag: '<path d="M9 3.5h6L13.5 7h-3z"/><path d="M10.5 7C6.5 9 4.5 12.5 4.5 15.5c0 3.3 3.1 5 7.5 5s7.5-1.7 7.5-5c0-3-2-6.5-6-8.5"/><path d="M13.7 11.7c-.4-.6-1-.9-1.8-.9-1 0-1.9.6-1.9 1.4 0 1.9 3.9.9 3.9 2.9 0 .8-.9 1.5-2 1.5-.9 0-1.7-.4-2-1M12 9.7v1.1M12 16.6v1.1"/>',
  // Variantes du Yams.
  up: '<path d="M12 20V5M6 11l6-6 6 6"/><path d="M4 20h4M16 20h4"/>',
  down: '<path d="M12 4v15M6 13l6 6 6-6"/><path d="M4 4h4M16 4h4"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  // Variantes du 5000.
  crosshair: `<circle cx="12" cy="12" r="7"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>${dot(12, 12, 1.2)}`,
  bullseye: `<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/>${dot(12, 12, 1.6)}`,
  fifty:
    '<path d="M10.5 7H6l-.6 4.3c.6-.5 1.4-.8 2.3-.8 1.8 0 3.2 1.4 3.2 3.2S9.5 17 7.6 17c-1.1 0-2-.4-2.6-1.1"/><rect x="13.3" y="7" width="5.7" height="10" rx="2.85"/><path d="M3.5 20.5l17-17"/>',
  stop: '<path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z"/><path d="M8.5 12h7"/>',
  link: '<path d="M10 13.5a4.5 4.5 0 0 0 6.8.5l2.7-2.7a4.5 4.5 0 0 0-6.4-6.4l-1.5 1.5"/><path d="M14 10.5a4.5 4.5 0 0 0-6.8-.5l-2.7 2.7a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5"/>',
  // Records du 5000.
  flag: '<path d="M5 21V4M5 4h13l-2.5 4L18 12H5"/>',
  pot: '<path d="M6 9h12l-1.2 10a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8z"/><path d="M9 9c0-2.5 1.3-4 3-4s3 1.5 3 4"/><path d="M10 14h4"/>',
  flame:
    '<path d="M12 21c-3.9 0-6.5-2.7-6.5-6.3 0-3.3 2.3-5.3 3.5-8.2.9 1.6 1.8 2.6 3 3.1.1-2.6 1.2-4.9 3.2-6.6.3 3.2 4.3 6 4.3 11.4 0 3.8-3.1 6.6-7.5 6.6z"/>',
  burst:
    '<path d="M12 2.5l2 5.5 5.5-2-2.6 5L22 13l-5.5 1.3 1.8 5.5L13 17l-2.2 4.8-.8-5.5-5.4 2 3-4.8L2.5 11l5.6-1.2L6 4.5l5 3z"/>',
  fall: '<path d="M4 5l6 6 4-4 6 6"/><path d="M20 9v4h-4"/><path d="M4 20h16"/>',
  door: `<path d="M6 21V4h10v17M4 21h16"/>${dot(13, 12.5, 0.9)}`,
  hourglass: '<path d="M7 3h10M7 21h10M8 3c0 5 8 6 8 9s-8 4-8 9M16 3c0 5-8 6-8 9s8 4 8 9"/>',
  chart: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  // Actions.
  calc: `<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8"/>${dot(9, 12, 1)}${dot(12, 12, 1)}${dot(15, 12, 1)}${dot(9, 16, 1)}${dot(12, 16, 1)}${dot(15, 16, 1)}`,
  pen: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>',
  sheet: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  people:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.5-3.2 2.7-5 5.5-5s5 1.8 5.5 5"/><circle cx="16.5" cy="9" r="2.5"/><path d="M15.5 14.2c2.5.1 4.4 1.7 4.9 4.8"/>',
  disk: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/>',
  // Revenir au lancer précédent (calculette du 5000) : une flèche qui repart
  // en arrière, distincte du cercle de « Recommencer le tour ».
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  shuffle:
    '<path d="M4 7h3c4 0 6 10 10 10h3M4 17h3c1.6 0 2.8-1.6 3.9-3.6M13.1 9.6C14.2 8.1 15.4 7 17 7h3"/><path d="M18 4.5L20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5"/>',
  grip: `${dot(9, 6)}${dot(15, 6)}${dot(9, 12)}${dot(15, 12)}${dot(9, 18)}${dot(15, 18)}`,
  erase: '<path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
  // Le bouton Partager de Safari et l'entrée « Sur l'écran d'accueil » :
  // les deux gestes de l'installation sur iPhone, dessinés comme là-bas.
  share: '<path d="M12 14V3.5M8 7.5l4-4 4 4"/><path d="M8.5 10.5H6v10h12v-10h-2.5"/>',
  addSquare: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/>',
} as const satisfies Record<string, string>;

export type IconName = keyof typeof ICON_PATHS;

export const isIconName = (name: string): name is IconName =>
  Object.prototype.hasOwnProperty.call(ICON_PATHS, name);

// Le balisage d'un pictogramme, pour les pages HTML (build) : même rendu que
// icon() côté écrans.
export function iconMarkup(name: IconName, className = "ic"): string {
  return `<svg class="${className}" data-icon="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name]}</svg>`;
}
