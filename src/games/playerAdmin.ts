// Renommer ou supprimer un joueur PARTOUT où il laisse une trace : joueurs
// connus, compteur de parties, brouillon d'avant-partie, et tout ce que chaque
// jeu conserve à son nom (partie en cours comprise, cf. GameDef.renamePlayer).
//
// Sans DOM, donc testable : l'écran des Paramètres ne fait que l'appeler. Un
// endroit oublié ici produit un joueur fantôme — l'ancien nom réécrit par une
// partie en cours, qui réapparaît dans les stats et les classements.
//
// À côté du registre et non dans `core/` : parcourir les jeux, c'est connaître
// le catalogue.

import { GAMES } from "./registry";
import { compareNames, foldName, sameName } from "../core/playerName";
import {
  getKnownNames,
  removeKnownName,
  renameKnownName,
} from "../core/storage/knownPlayersRepo";
import {
  getPlayerGames,
  removePlayerGames,
  renamePlayerGames,
} from "../core/storage/playerGamesRepo";
import { getDraft, saveDraft } from "../core/storage/draftRepo";

// Refuse (renvoie false) si le nouveau nom est vide ou déjà porté par un autre
// joueur : rien n'est alors modifié.
export function renamePlayer(oldName: string, newName: string): boolean {
  const next = newName.trim();
  if (!renameKnownName(oldName, next)) return false;
  renamePlayerGames(oldName, next);
  renameInDraft(oldName, next);
  for (const game of GAMES) game.renamePlayer(oldName, next);
  return true;
}

// Les parties en cours qui comptent ce joueur sont abandonnées (chaque jeu s'en
// charge, cf. GameDef.removePlayer).
export function removePlayer(name: string): void {
  removeKnownName(name);
  removePlayerGames(name);
  removeFromDraft(name);
  for (const game of GAMES) game.removePlayer(name);
}

// Tous les noms qui laissent une trace quelque part, une fois chacun (casse et
// espaces ignorés), triés. Sert à pouvoir supprimer un reliquat même s'il ne
// figure plus dans la liste des joueurs connus.
export function allPlayerNames(): string[] {
  const seen = new Map<string, string>(); // forme repliée -> forme d'affichage
  const add = (raw: string): void => {
    const name = raw.trim();
    if (name && !seen.has(foldName(name))) seen.set(foldName(name), name);
  };
  getKnownNames().forEach(add);
  Object.keys(getPlayerGames()).forEach(add);
  getDraft()?.playerNames.forEach(add);
  for (const game of GAMES) game.playerNames().forEach(add);
  return [...seen.values()].sort(compareNames);
}

// Un brouillon peut déjà contenir le nouveau nom (« jean » et « Jean » cochés
// par une ancienne version) : on dédoublonne après le remplacement.
function renameInDraft(from: string, to: string): void {
  const draft = getDraft();
  if (!draft || !draft.playerNames.some((n) => sameName(n, from))) return;
  const renamed = draft.playerNames.map((n) => (sameName(n, from) ? to : n));
  const playerNames = renamed.filter(
    (n, i) => renamed.findIndex((m) => sameName(m, n)) === i,
  );
  saveDraft({ ...draft, playerNames });
}

function removeFromDraft(name: string): void {
  const draft = getDraft();
  if (!draft) return;
  const kept = draft.playerNames.filter((n) => !sameName(n, name));
  if (kept.length !== draft.playerNames.length) {
    saveDraft({ ...draft, playerNames: kept });
  }
}
