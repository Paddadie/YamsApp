// Le catalogue des jeux — la SEULE liste de l'application.
//
// Ajouter un jeu, c'est écrire son dossier sous `games/` puis ajouter une ligne
// ici. Aucun écran existant n'est à rouvrir : l'accueil construit ses tuiles
// depuis cette liste, l'écran de sélection des joueurs y trouve quoi lancer, et
// la sauvegarde y trouve les clés à embarquer.
//
// Ce que ce module ne fait PAS : servir d'intermédiaire entre un écran de jeu
// et son moteur. `pages/yams/game.ts` importe `games/yams/scoring.ts`
// directement. Passer par le registre pour jouer transformerait ce catalogue en
// framework, et chaque jeu devrait se tordre pour entrer dedans.

import type { GameDef } from "./types";
import { YAMS } from "./yams/gameDef";
import { G5000 } from "./g5000/gameDef";

export const GAMES: GameDef[] = [YAMS, G5000];

export function gameById(id: string | null | undefined): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}
