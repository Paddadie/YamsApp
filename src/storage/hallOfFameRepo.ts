// Meilleurs et pires scores, conservés entre les parties (5 de chaque).

import type { ScoreEntry } from "../types";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./localStore";

export function getBestScores(): ScoreEntry[] {
  return readJson<ScoreEntry[]>(STORAGE_KEYS.bestScores) ?? [];
}

export function getWorstScores(): ScoreEntry[] {
  return readJson<ScoreEntry[]>(STORAGE_KEYS.worstScores) ?? [];
}

export function saveBestScores(list: ScoreEntry[]): void {
  writeJson(STORAGE_KEYS.bestScores, list);
}

export function saveWorstScores(list: ScoreEntry[]): void {
  writeJson(STORAGE_KEYS.worstScores, list);
}
