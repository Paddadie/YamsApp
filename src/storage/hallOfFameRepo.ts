// Meilleurs et pires scores, conservés entre les parties (5 de chaque).

import type { ScoreEntry } from "../types";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./localStore";

const isScoreEntryArray = (v: unknown): v is ScoreEntry[] =>
  Array.isArray(v) &&
  v.every(
    (e) =>
      !!e &&
      typeof e === "object" &&
      typeof (e as ScoreEntry).name === "string" &&
      typeof (e as ScoreEntry).score === "number" &&
      typeof (e as ScoreEntry).date === "string",
  );

export function getBestScores(): ScoreEntry[] {
  return readJson(STORAGE_KEYS.bestScores, isScoreEntryArray) ?? [];
}

export function getWorstScores(): ScoreEntry[] {
  return readJson(STORAGE_KEYS.worstScores, isScoreEntryArray) ?? [];
}

export function saveBestScores(list: ScoreEntry[]): void {
  writeJson(STORAGE_KEYS.bestScores, list);
}

export function saveWorstScores(list: ScoreEntry[]): void {
  writeJson(STORAGE_KEYS.worstScores, list);
}
