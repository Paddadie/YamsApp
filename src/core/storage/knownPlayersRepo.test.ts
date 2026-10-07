import { beforeEach, describe, expect, it } from "vitest";
import {
  addKnownName,
  getKnownNames,
  removeKnownName,
  renameKnownName,
  resolveName,
} from "./knownPlayersRepo";
import { STORAGE_KEYS } from "./keys";

beforeEach(() => localStorage.clear());

const write = (names: unknown): void =>
  localStorage.setItem(STORAGE_KEYS.knownNames, JSON.stringify(names));

describe("getKnownNames", () => {
  it("renvoie une liste vide quand rien n'est stocké", () => {
    expect(getKnownNames()).toEqual([]);
  });

  it("ignore un contenu qui n'est pas une liste de noms", () => {
    write([{ name: "Jean" }]);
    expect(getKnownNames()).toEqual([]);
  });
});

describe("addKnownName", () => {
  it("ajoute un nom et garde la liste triée", () => {
    addKnownName("Marie");
    addKnownName("Alice");
    expect(getKnownNames()).toEqual(["Alice", "Marie"]);
  });

  it("nettoie les espaces de bord", () => {
    addKnownName("  Jean  ");
    expect(getKnownNames()).toEqual(["Jean"]);
  });

  it("n'ajoute pas un nom déjà connu, même avec une autre casse", () => {
    addKnownName("Jean");
    addKnownName("jean");
    addKnownName("JEAN ");
    expect(getKnownNames()).toEqual(["Jean"]);
  });

  it("refuse un nom vide", () => {
    addKnownName("   ");
    expect(getKnownNames()).toEqual([]);
  });

  it("trie en ignorant la casse et les accents", () => {
    addKnownName("Zoé");
    addKnownName("élise");
    addKnownName("Alice");
    expect(getKnownNames()).toEqual(["Alice", "élise", "Zoé"]);
  });
});

describe("resolveName", () => {
  it("retrouve la forme canonique d'un nom déjà connu", () => {
    addKnownName("Jean");
    expect(resolveName(" jean ")).toBe("Jean");
  });

  it("nettoie un nom inconnu sans l'enregistrer", () => {
    expect(resolveName("  Marie  ")).toBe("Marie");
    expect(getKnownNames()).toEqual([]);
  });
});

describe("removeKnownName", () => {
  it("retire le nom quelle que soit la casse", () => {
    addKnownName("Jean");
    addKnownName("Marie");
    removeKnownName(" JEAN ");
    expect(getKnownNames()).toEqual(["Marie"]);
  });
});

describe("renameKnownName", () => {
  it("renomme et retrie", () => {
    addKnownName("Marie");
    addKnownName("Jean");
    expect(renameKnownName("Marie", "Alice")).toBe(true);
    expect(getKnownNames()).toEqual(["Alice", "Jean"]);
  });

  it("accepte une simple correction de casse", () => {
    addKnownName("jean");
    expect(renameKnownName("jean", "Jean")).toBe(true);
    expect(getKnownNames()).toEqual(["Jean"]);
  });

  it("refuse un nom déjà porté par un autre joueur", () => {
    addKnownName("Jean");
    addKnownName("Marie");
    expect(renameKnownName("Jean", "marie")).toBe(false);
    expect(getKnownNames()).toEqual(["Jean", "Marie"]);
  });

  it("refuse un nom vide", () => {
    addKnownName("Jean");
    expect(renameKnownName("Jean", "   ")).toBe(false);
    expect(getKnownNames()).toEqual(["Jean"]);
  });

  it("nettoie les espaces du nouveau nom", () => {
    addKnownName("Jean");
    expect(renameKnownName("Jean", "  Jeanne  ")).toBe(true);
    expect(getKnownNames()).toEqual(["Jeanne"]);
  });
});
