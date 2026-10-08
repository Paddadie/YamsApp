// Ce que les deux écrans de fin (Yams, 5000) partagent : l'en-tête qui fête le
// vainqueur, le podium et sa mise en scène, et la ligne d'un record battu sur
// le post-it.

import { confetti, gommette } from "../core/icons";
import { podiumOrder } from "../core/ranking";
import { requireEl } from "../core/ui";

export interface Winner {
  name: string;
  color: string;
}

// « Bravo Alice ! » et des confettis de papier dans l'en-tête, qui prend la
// couleur de partie du vainqueur : la victoire change l'écran, pas seulement
// un mot (direction « La table de jeu », 08/10). À égalité de premier rang,
// tous les vainqueurs sont nommés (« Bravo Alice et Bob ! ») ; l'en-tête prend
// la couleur du premier, les autres noms sont surlignés à la leur.
export function celebrate(winners: Winner[]): void {
  const title = requireEl("end-title");
  const head = title.closest<HTMLElement>(".page-head");
  const headColor = winners[0]?.color;
  if (head && headColor) head.style.setProperty("--accent-paper", headColor);
  const parts: (Node | string)[] = ["Bravo "];
  winners.forEach((winner, i) => {
    if (i > 0) parts.push(i === winners.length - 1 ? " et " : ", ");
    const name = document.createElement("span");
    name.className = "end-winner";
    // Sur un en-tête de sa couleur, son surlignage serait invisible : blanc.
    name.style.setProperty("--winner", winner.color === headColor ? "var(--sheet)" : winner.color);
    name.textContent = winner.name;
    parts.push(name);
  });
  parts.push(" !");
  title.replaceChildren(...parts);
  head?.prepend(confetti());
}

// Une ligne de post-it : ce qui a été battu, puis À LA LIGNE qui et combien
// (demande de Paul, 08/10 : « Alice, 385 » coupé en fin de ligne n'était pas
// beau).
export function recordLine(what: string, who: string): HTMLElement {
  const text = document.createElement("span");
  text.className = "record-line";
  const label = document.createElement("span");
  label.className = "record-line-what";
  label.textContent = what;
  const holder = document.createElement("strong");
  holder.className = "record-line-who";
  holder.textContent = who;
  text.append(label, holder);
  return text;
}

/* ---------- Podium et mise en scène ---------- */
// Les marches sortent du sol de la dernière vers la première : on garde le
// vainqueur pour la fin, et son score défile jusqu'à son total. Le classement
// complet suit, du dernier au premier. Séquence jouée une fois par partie —
// c'est le moment fort, il peut se permettre de durer, contrairement aux
// animations du jeu lui-même. La même aux deux jeux (elle n'existait qu'au
// Yams jusqu'au 08/10).

const STEP_DELAYS: Record<number, number> = { 3: 0.08, 2: 0.26, 1: 0.44 };
const STEP_MS = 450;
// Ce qui suit le podium (classement, post-it du record) attend qu'il soit posé.
export const AFTER_PODIUM = 0.72;
const ROW_STAGGER = 0.07;

export interface PodiumEntry {
  name: string;
  score: number;
  rank: number; // deux ex æquo partagent le même rang, et la même marche
}

// Les trois premières places, chacune avec la gommette de son RANG : à
// égalité, deux joueurs montent sur une marche d'or au lieu d'être départagés
// par leur ordre de passage. `sorted` : le classement, du premier au dernier.
export function renderPodium(
  container: HTMLElement,
  sorted: PodiumEntry[],
  format: (n: number) => string,
): void {
  container.replaceChildren(...podiumOrder(sorted).map((entry) => podiumStep(entry, format)));
}

function podiumStep(entry: PodiumEntry, format: (n: number) => string): HTMLElement {
  const { rank } = entry;
  const step = document.createElement("div");
  step.className = `podium-step rank-${rank}`;
  const delay = STEP_DELAYS[rank] ?? 0;
  step.style.setProperty("--d", `${delay}s`);

  const name = document.createElement("span");
  name.className = "podium-name";
  name.textContent = entry.name;

  const score = document.createElement("span");
  score.className = "podium-score";
  score.textContent = format(entry.score);
  if (rank === 1) countUp(score, entry.score, delay * 1000 + STEP_MS, format);

  step.append(gommette(rank, { big: rank === 1 }), name, score);
  return step;
}

// Apparition différée d'un élément (cf. `.reveal` dans animations.css).
export function reveal(el: HTMLElement, delaySeconds: number): void {
  el.style.setProperty("--d", `${delaySeconds}s`);
  el.classList.add("reveal");
}

// Les lignes du classement, du dernier au premier, une fois le podium posé.
export function revealRanking(table: HTMLTableElement): void {
  const rows = table.querySelectorAll<HTMLTableRowElement>("tbody tr");
  rows.forEach((row, i) => {
    reveal(row, AFTER_PODIUM + (rows.length - 1 - i) * ROW_STAGGER);
  });
}

// Le score du vainqueur défile de 0 jusqu'à son total, au moment où sa marche
// se pose.
function countUp(el: HTMLElement, to: number, delayMs: number, format: (n: number) => string): void {
  const DURATION = 900;
  el.textContent = format(0);
  window.setTimeout(() => {
    const start = performance.now();
    const tick = (now: number): void => {
      // L'horodatage d'une image peut précéder `start` de quelques
      // millisecondes : sans plancher, la première image affichait un score
      // négatif.
      const p = Math.max(0, Math.min(1, (now - start) / DURATION));
      const eased = 1 - Math.pow(1 - p, 3); // ralentit en approchant du total
      el.textContent = format(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, delayMs);
}
