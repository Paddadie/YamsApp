// Paramètres, par l'écran : renommer, supprimer un joueur, importer une
// sauvegarde. La logique est testée sans DOM (playerAdmin, backup) ; ici, le
// parcours — boutons, pop-ups de confirmation, liste rafraîchie.

import { describe, expect, it, vi } from "vitest";
import { click, el, navigations, openPage } from "./harness";
import { knownPlayers, savedYams, yamsGame } from "./fixtures";
import { getKnownNames } from "../../core/storage/knownPlayersRepo";

const adminNames = (): string[] =>
  [...document.querySelectorAll("#players-admin .score-admin-name")].map((n) => n.textContent ?? "");
const byLabel = (label: string): HTMLButtonElement => el(`button[aria-label="${label}"]`);
const dialog = (id: string): HTMLDialogElement => el<HTMLDialogElement>(`#${id}`);

describe("renommer un joueur", () => {
  it("la liste, les joueurs connus et la partie en cours suivent", async () => {
    knownPlayers("Alice", "Bob");
    yamsGame(["Alice", "Bob"]);
    await openPage("settings");

    click(byLabel("Modifier le nom d'Alice"));
    expect(dialog("player-edit-dialog").open).toBe(true);
    el<HTMLInputElement>("#player-edit-input").value = "Alicia";
    click("#player-edit-save");

    expect(dialog("player-edit-dialog").open).toBe(false);
    expect(adminNames()).toEqual(["Alicia", "Bob"]);
    expect(getKnownNames()).toEqual(["Alicia", "Bob"]);
    expect(savedYams()?.players.map((p) => p.name)).toEqual(["Alicia", "Bob"]);
  });

  it("un nom déjà pris est refusé, sans rien changer", async () => {
    knownPlayers("Alice", "Bob");
    await openPage("settings");

    click(byLabel("Modifier le nom d'Alice"));
    el<HTMLInputElement>("#player-edit-input").value = "bob";
    click("#player-edit-save");

    expect(dialog("player-edit-dialog").open).toBe(true);
    expect(el("#player-edit-error").hidden).toBe(false);
    expect(getKnownNames()).toEqual(["Alice", "Bob"]);
  });
});

describe("supprimer un joueur", () => {
  it("la pop-up dit ce qui partira ; confirmer l'efface partout", async () => {
    knownPlayers("Alice", "Bob");
    yamsGame(["Alice", "Bob"]);
    await openPage("settings");

    click(byLabel("Supprimer Bob"));
    expect(dialog("player-delete-dialog").open).toBe(true);
    expect(el("#player-delete-summary").textContent).toContain("Partie de Yams en courssera abandonnée");

    click("#player-delete-confirm");
    expect(adminNames()).toEqual(["Alice"]);
    expect(savedYams()).toBeNull();
  });

  it("« Annuler » ne touche à rien", async () => {
    knownPlayers("Alice", "Bob");
    await openPage("settings");
    click(byLabel("Supprimer Bob"));
    click("#player-delete-cancel");
    expect(getKnownNames()).toEqual(["Alice", "Bob"]);
  });
});

describe("importer une sauvegarde", () => {
  // Choisir un fichier : jsdom ne laisse pas écrire `files`, on le pose. Il
  // ne connaît pas non plus `File.text()`, que tous les navigateurs ont.
  function chooseFile(content: string, name = "cornet-sauvegarde.json"): void {
    const input = el<HTMLInputElement>("#import-input");
    const file = new File([content], name, { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => content });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input.dispatchEvent(new Event("change"));
  }

  it("récapitule le fichier, remplace tout après confirmation, puis revient au menu", async () => {
    knownPlayers("Alice", "Bob");
    await openPage("settings");
    chooseFile(JSON.stringify({ version: 5, exportedAt: "", data: { "yams-player-names": ["Zoé"] } }));

    await vi.waitFor(() => expect(dialog("import-dialog").open).toBe(true));
    expect(el("#import-summary").textContent).toContain("Joueurs1");

    click("#import-confirm");
    await vi.waitFor(() => expect(dialog("message-dialog").open).toBe(true));
    expect(el("#message-title").textContent).toBe("Sauvegarde restaurée");
    expect(getKnownNames()).toEqual(["Zoé"]);

    click("#message-ok");
    expect(navigations()).toEqual(["home"]);
  });

  it("un fichier qui n'est pas une sauvegarde est refusé, rien n'est écrit", async () => {
    knownPlayers("Alice");
    await openPage("settings");
    chooseFile(JSON.stringify({ bonjour: true }));

    await vi.waitFor(() => expect(dialog("message-dialog").open).toBe(true));
    expect(el("#message-title").textContent).toBe("Import impossible");
    expect(el("#message-text").textContent).toBe("Ce fichier n'est pas une sauvegarde de Cornet.");
    expect(dialog("import-dialog").open).toBe(false);
    expect(getKnownNames()).toEqual(["Alice"]);
  });
});
