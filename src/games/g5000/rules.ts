// Barème du 5000 : ce que vaut un lancer, et ce qu'on peut y garder.
// Aucun accès au DOM — uniquement des données et des fonctions pures.
//
// Le barème par défaut, arrêté avec Paul :
//   un 1 = 100 · un 5 = 50 · brelan = valeur × 100 (1 000 pour les as)
//   carré = 2 × brelan · quinte = 2 × carré · chaque suite de 5 dés = 1 000
// Brelan, carré, quinte et suite se règlent dans ⚙️ : un multiple courant
// (carré à 1,5 × le brelan comme au 10 000, quinte au double du brelan…) ou
// des valeurs saisies chiffre par chiffre.
// Une figure ne compte que dans un SEUL lancer : on ne construit jamais une
// combinaison sur plusieurs jets.
//
// Variante « Combo » : un brelan (ou mieux) active son chiffre pour le reste du
// tour, et chaque dé de ce chiffre vaut alors sa valeur habituelle + 100 — donc
// 200 pour un 1, 150 pour un 5, 100 pour les autres. Un groupe est toujours
// compté de la façon la plus favorable au joueur : une fois le 2 activé, trois
// 2 valent mieux en « trois dés activés » (300) qu'en brelan (200).

import type {
  DiceCounts,
  Face,
  FaceTable,
  FiveKind,
  FourKind,
  G5000Rules,
  TripleKind,
} from "./types";
import { hasVariant, VARIANT_IDS } from "./variants";

export const FACES: Face[] = [1, 2, 3, 4, 5, 6];

// Valeur d'un dé isolé, chiffre non activé.
const BASE: Record<Face, number> = { 1: 100, 2: 0, 3: 0, 4: 0, 5: 50, 6: 0 };

// Brelan classique : trois 1 = 1 000, sinon le chiffre × 100.
const CLASSIC_TRIPLE: Record<Face, number> = {
  1: 1000, 2: 200, 3: 300, 4: 400, 5: 500, 6: 600,
};

// Ce qu'ajoute l'activation d'un chiffre (Combo) à chacun de ses dés.
export const OPEN_BONUS = 100;

// Valeur d'un dé isolé, chiffre activé ou non.
const unitValue = (face: Face, open: boolean): number =>
  BASE[face] + (open ? OPEN_BONUS : 0);

// Tous les scores du jeu sont des multiples de 50 : sinon l'objectif peut
// devenir inatteignable avec « Dans le mille ». Les valeurs saisies y sont
// ramenées, et un multiple qui tomberait à côté (1,5 × un brelan saisi à 250)
// est arrondi au pas.
export const SCORE_STEP = 50;
const toStep = (n: number): number => Math.round(n / SCORE_STEP) * SCORE_STEP;

// Les objectifs proposés sur l'accueil du jeu. 5 000 par défaut : la
// simulation donne ~14 tours par joueur, une demi-heure à trois. Tous sont des
// centaines : atteignables avec « Dans le mille » comme avec « Sans
// demi-mesure ».
export const TARGETS = [5000, 10000, 20000];

export const DEFAULT_RULES: G5000Rules = {
  target: 5000,
  openAt: 500,
  runPoints: 1000,
  tripleKind: "classic",
  fourKind: "double",
  fiveKind: "doubleFour",
  customTriples: null,
  customFours: null,
  customFives: null,
  blankTurnsPenalty: 3,
  lastRound: true,
  variants: [],
};

const TARGET_MIN = 500;
const TARGET_MAX = 20000;
// Bornes des valeurs saisies dans ⚙️ : une figure vaut au moins un pas, et au
// plus l'objectif le plus haut proposé.
export const FIGURE_MIN = SCORE_STEP;
export const FIGURE_MAX = TARGET_MAX;
export const OPEN_AT_MAX = 5000;

// Le plus haut millier proposé à la saisie manuelle (« les paliers ») : deux
// fois l'objectif, jamais au-delà de 20 000 — 10 950 au plus à 5 000. Au-delà
// de l'objectif, un tour ne change plus rien à la partie, seulement au record
// du plus gros tour : assez pour qui prend tous les risques, sans faire
// défiler quarante milliers à 20 000 (décision de Paul, 08/10/2026).
const ENTRY_THOUSANDS_MAX = 20000;
export const highestThousand = (target: number): number =>
  Math.min(2 * target, ENTRY_THOUSANDS_MAX);
export const RUN_MAX = 5000;
export const BLANK_TURNS_MAX = 9;

const TRIPLE_KINDS: TripleKind[] = ["classic", "custom"];
const FOUR_KINDS: FourKind[] = ["half", "double", "custom"];
const FIVE_KINDS: FiveKind[] = ["doubleFour", "doubleThree", "custom"];

const clampStep = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, toStep(n)));

// Six valeurs saisies, ramenées au pas et bornées ; `null` si ce n'en est pas.
function faceTable(raw: unknown): FaceTable | null {
  if (!Array.isArray(raw) || raw.length !== 6) return null;
  if (!raw.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return raw.map((n: number) => clampStep(n, FIGURE_MIN, FIGURE_MAX));
}

// Une partie commencée avant les variantes portait des interrupteurs : on les
// relit pour qu'elle se termine avec les règles de son lancement. Leurs
// valeurs par défaut d'alors (égalité et score exact activés) valent ici.
// Sans aucun de ces interrupteurs, ce n'est pas une ancienne partie : pas de
// variante. Les réglages enregistrés, eux, ne passent pas par là (cf.
// repo.getRules).
const LEGACY_KEYS = ["tieRule", "exactTarget", "hotDiceMustReroll", "openDigits"];

function legacyVariants(s: Record<string, unknown>): G5000Rules["variants"] {
  if (!LEGACY_KEYS.some((key) => key in s)) return [];
  return VARIANT_IDS.filter(
    (id) =>
      (id === "sniper" && s.tieRule !== false) ||
      (id === "exact" && s.exactTarget !== false) ||
      (id === "freeHotDice" && s.hotDiceMustReroll === false) ||
      (id === "combo" && s.openDigits === true),
  );
}

// Complète / répare / borne un objet de règles quelconque (stockage, partie
// sauvegardée par une version antérieure).
export function normalizeRules(raw: unknown): G5000Rules {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (key: string, fallback: number, lo: number, hi: number): number =>
    typeof s[key] === "number" && Number.isFinite(s[key])
      ? clampStep(s[key] as number, lo, hi)
      : fallback;
  const oneOf = <T extends string>(key: string, allowed: T[], fallback: T): T =>
    allowed.includes(s[key] as T) ? (s[key] as T) : fallback;

  const customTriples = faceTable(s.customTriples);
  const customFours = faceTable(s.customFours);
  const customFives = faceTable(s.customFives);
  // « Perso » sans valeurs à lire retombe sur le réglage par défaut.
  const kind = <T extends string>(key: string, allowed: T[], fallback: T, table: FaceTable | null): T => {
    const value = oneOf(key, allowed, fallback);
    return value === "custom" && table === null ? fallback : value;
  };

  const variants = Array.isArray(s.variants)
    ? VARIANT_IDS.filter((id) => (s.variants as unknown[]).includes(id))
    : legacyVariants(s);

  return {
    target: num("target", DEFAULT_RULES.target, TARGET_MIN, TARGET_MAX),
    openAt: num("openAt", DEFAULT_RULES.openAt, 0, OPEN_AT_MAX),
    runPoints: num("runPoints", DEFAULT_RULES.runPoints, 0, RUN_MAX),
    tripleKind: kind("tripleKind", TRIPLE_KINDS, DEFAULT_RULES.tripleKind, customTriples),
    fourKind: kind("fourKind", FOUR_KINDS, DEFAULT_RULES.fourKind, customFours),
    fiveKind: kind("fiveKind", FIVE_KINDS, DEFAULT_RULES.fiveKind, customFives),
    customTriples,
    customFours,
    customFives,
    blankTurnsPenalty:
      typeof s.blankTurnsPenalty === "number" &&
      Number.isFinite(s.blankTurnsPenalty)
        ? Math.min(BLANK_TURNS_MAX, Math.max(0, Math.round(s.blankTurnsPenalty)))
        : DEFAULT_RULES.blankTurnsPenalty,
    lastRound: typeof s.lastRound === "boolean" ? s.lastRound : DEFAULT_RULES.lastRound,
    variants,
  };
}

/* ---------- Lecture d'un lancer ---------- */

export const emptyCounts = (): DiceCounts => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });

export function countsOf(dice: Face[]): DiceCounts {
  const counts = emptyCounts();
  for (const die of dice) counts[die]++;
  return counts;
}

export const totalDice = (counts: DiceCounts): number =>
  FACES.reduce((n, face) => n + counts[face], 0);

// Les deux suites reconnues, en nombre de dés par face.
function runOf(counts: DiceCounts): Face[] | null {
  const has = (faces: Face[]): boolean => faces.every((f) => counts[f] === 1);
  if (totalDice(counts) !== 5) return null;
  if (has([1, 2, 3, 4, 5])) return [1, 2, 3, 4, 5];
  if (has([2, 3, 4, 5, 6])) return [2, 3, 4, 5, 6];
  return null;
}

type Scale = Pick<
  G5000Rules,
  "tripleKind" | "fourKind" | "fiveKind" | "customTriples" | "customFours" | "customFives"
>;

// Ce que vaut une figure de `size` dés identiques (3, 4 ou 5) de ce chiffre,
// sortie d'un seul lancer.
export function figureValue(face: Face, size: number, scale: Scale): number {
  const i = face - 1;
  const triple =
    scale.tripleKind === "custom" && scale.customTriples
      ? scale.customTriples[i]
      : CLASSIC_TRIPLE[face];
  if (size === 3) return triple;
  const four =
    scale.fourKind === "custom" && scale.customFours
      ? scale.customFours[i]
      : toStep(triple * (scale.fourKind === "half" ? 1.5 : 2));
  if (size === 4) return four;
  if (scale.fiveKind === "custom" && scale.customFives) return scale.customFives[i];
  return scale.fiveKind === "doubleThree" ? 2 * triple : 2 * four;
}

// Ce que valent `k` dés d'une même face dans un seul lancer, au mieux : une
// figure et le reste en dés isolés, ou tout en dés isolés. Avec des valeurs
// saisies, une petite figure plus des dés isolés peut battre la grande.
export function groupValue(face: Face, k: number, open: boolean, scale: Scale): number {
  if (k <= 0) return 0;
  const unit = unitValue(face, open);
  let best = k * unit;
  for (let size = 3; size <= Math.min(k, 5); size++) {
    best = Math.max(best, figureValue(face, size, scale) + (k - size) * unit);
  }
  return best;
}

// `k` dés de cette face peuvent-ils être mis de côté ? Un 2 isolé ne marque
// rien et ne peut donc pas être gardé — sauf si le 2 a été activé.
export function isKeepable(face: Face, k: number, open: boolean): boolean {
  if (k <= 0) return true;
  return BASE[face] > 0 || open || k >= 3;
}

/* ---------- Combinaisons proposées au joueur ---------- */

export interface Combo {
  // Identifiant stable, pour que l'écran retrouve une option après un rendu.
  id: string;
  label: string;
  points: number;
  dice: Face[];
  // Chiffre activé par cette combinaison (un brelan ou mieux, variante Combo),
  // s'il y en a un.
  opens: Face | null;
  // Dés d'un chiffre déjà activé : l'écran les met en valeur.
  boosted?: boolean;
}

const repeat = (face: Face, k: number): Face[] => Array.from({ length: k }, () => face);

const FIGURE_NAMES: Record<number, string> = { 3: "Brelan", 4: "Carré", 5: "Quinte" };

// Les chiffres activés ce tour, si la partie joue la variante Combo.
const activeDigits = (openDigits: Face[], rules: G5000Rules): Face[] =>
  hasVariant(rules, "combo") ? openDigits : [];

// Tout ce que le joueur peut mettre de côté dans ce lancer. Une liste vide
// signifie un bust.
export function combosOf(
  counts: DiceCounts,
  openDigits: Face[],
  rules: G5000Rules,
): Combo[] {
  const active = activeDigits(openDigits, rules);
  const combo = hasVariant(rules, "combo");

  // Une suite consomme les cinq dés : elle exclut toute autre lecture du lancer.
  const run = rules.runPoints > 0 ? runOf(counts) : null;
  if (run) {
    return [
      {
        id: "run",
        label: `Suite ${run.join("·")}`,
        points: rules.runPoints,
        dice: run,
        opens: null,
      },
    ];
  }

  const combos: Combo[] = [];
  for (const face of FACES) {
    const k = counts[face];
    const open = active.includes(face);
    const opens = combo && !open ? face : null;

    // La figure entière, puis le brelan seul : un brelan sorti à quatre ou
    // cinq exemplaires laisse le choix d'en garder seulement trois, pour
    // relancer le reste.
    const sizes = k > 3 ? [k, 3] : k === 3 ? [3] : [];

    for (const size of sizes) {
      combos.push({
        id: `g${face}x${size}`,
        label: `${FIGURE_NAMES[size]} de ${face}${size < k ? ` (garder ${size})` : ""}`,
        points: groupValue(face, size, open, rules),
        dice: repeat(face, size),
        opens,
        boosted: open || undefined,
      });
    }

    // Dés isolés : les 1, les 5, et tout chiffre activé.
    if (!isKeepable(face, 1, open)) continue;
    for (let i = 1; i <= k; i++) {
      combos.push({
        id: `s${face}x${i}`,
        label: i === 1 ? `Un ${face}` : `${i} × ${face}`,
        points: i * unitValue(face, open),
        dice: repeat(face, i),
        opens: null,
        boosted: open || undefined,
      });
    }
  }
  // Le plus gros gain en tête : construite face par face, la liste plaçait
  // « Un 1 » (100) au-dessus d'un « Brelan de 3 » (300), alors que c'est le
  // brelan qu'on cherche des yeux. À gain égal, ce qui coûte le moins de dés
  // passe devant — on garde ainsi le plus de dés à relancer.
  return combos
    .filter((c) => c.points > 0)
    .sort((a, b) => b.points - a.points || a.dice.length - b.dice.length);
}

// La combinaison peut-elle rejoindre celles déjà retenues dans ce lancer ? Les
// options proposées se recouvrent (« Carré de 1 », « Un 1 », « 2 × 1 »… sur les
// mêmes dés) : on vérifie face par face qu'aucun dé n'est compté deux fois.
// Sur 1-1-1-1-2, « Carré de 1 » + « Un 1 » demanderait cinq 1 pour quatre.
export function canKeep(picked: Combo[], combo: Combo, counts: DiceCounts): boolean {
  const used = emptyCounts();
  for (const die of [...picked.flatMap((c) => c.dice), ...combo.dice]) used[die]++;
  return FACES.every((face) => used[face] <= counts[face]);
}

// Le joueur touche une combinaison : elle est retenue, et celles qui ne peuvent
// plus l'accompagner (mêmes dés) sont lâchées d'elles-mêmes — pas besoin de
// désélectionner le brelan pour prendre la quinte. Les autres restent : garder
// « Un 1 » puis toucher « Brelan de 3 » retient les deux.
export function pickCombo(picked: Combo[], combo: Combo, counts: DiceCounts): Combo[] {
  const kept: Combo[] = [];
  for (const previous of picked) {
    if (canKeep([combo, ...kept], previous, counts)) kept.push(previous);
  }
  return [...kept, combo];
}

// Le lancer ne marque rien : le tour est perdu.
export const isBust = (
  counts: DiceCounts,
  openDigits: Face[],
  rules: G5000Rules,
): boolean => combosOf(counts, openDigits, rules).length === 0;

// Meilleur score possible pour ce lancer, tous dés gardés. Aucun écran ne s'en
// sert : c'est le barème dit en une fonction, et les tests le vérifient par
// elle.
export function bestValue(
  counts: DiceCounts,
  openDigits: Face[],
  rules: G5000Rules,
): number {
  const run = rules.runPoints > 0 ? runOf(counts) : null;
  if (run) return rules.runPoints;
  const active = activeDigits(openDigits, rules);
  let total = 0;
  for (const face of FACES) {
    total += groupValue(face, counts[face], active.includes(face), rules);
  }
  return total;
}
