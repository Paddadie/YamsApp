// Joueurs de la partie : l'ordre se règle en faisant glisser un joueur
// sélectionné, sur toute sa ligne ou par sa poignée (demande de Paul, 06/10).
// Un glissement court reste un toucher ; le toucher émis au lâcher d'un vrai
// glissement ne désélectionne pas le joueur posé.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { click, el, openPage, pointer } from "./harness";
import { draft, knownPlayers } from "./fixtures";
import { getDraft } from "../../core/storage/draftRepo";

// Hauteur d'une ligne : jsdom ne calcule aucune mise en page, le geste se
// mesure pourtant en lignes.
const ROW_H = 50;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    height: ROW_H,
    width: 300,
    top: 0,
    left: 0,
    right: 300,
    bottom: ROW_H,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
});

const row = (name: string): HTMLElement => el(`#roster .roster-row[data-name="${name}"]`);
const selectedOrder = (): string[] =>
  [...document.querySelectorAll<HTMLElement>("#roster .roster-row.selected")].map(
    (r) => r.dataset.name ?? "",
  );

async function threeSelected(): Promise<void> {
  knownPlayers("Alice", "Bob", "Chloé");
  draft("yams", ["Alice", "Bob", "Chloé"], { variants: ["Classique"] });
  await openPage("players");
}

describe("réordonner les joueurs", () => {
  it("glisser une ligne d'un cran la pose à la place suivante", async () => {
    await threeSelected();
    const alice = row("Alice");
    pointer(alice, "pointerdown", { y: 100 });
    pointer(alice, "pointermove", { y: 110 }); // le geste part (> 6 px)
    pointer(alice, "pointermove", { y: 155 }); // un peu plus d'une ligne
    pointer(alice, "pointerup", { y: 155 });

    expect(selectedOrder()).toEqual(["Bob", "Alice", "Chloé"]);
    expect(getDraft()?.playerNames).toEqual(["Bob", "Alice", "Chloé"]);
  });

  it("par la poignée aussi, et vers le haut", async () => {
    await threeSelected();
    const handle = el(`#roster .roster-row[data-name="Chloé"] .drag-handle`);
    pointer(handle, "pointerdown", { y: 200 });
    pointer(handle, "pointermove", { y: 100 }); // deux lignes plus haut
    pointer(handle, "pointerup", { y: 100 });

    expect(selectedOrder()).toEqual(["Chloé", "Alice", "Bob"]);
  });

  it("le toucher émis au lâcher ne désélectionne pas le joueur posé", async () => {
    await threeSelected();
    const alice = row("Alice");
    pointer(alice, "pointerdown", { y: 100 });
    pointer(alice, "pointermove", { y: 110 });
    pointer(alice, "pointermove", { y: 160 });
    pointer(alice, "pointerup", { y: 160 });
    click(row("Alice")); // le navigateur envoie un clic à la fin du geste

    expect(selectedOrder()).toEqual(["Bob", "Alice", "Chloé"]);
  });

  it("un glissement de quelques pixels reste un toucher : il désélectionne", async () => {
    await threeSelected();
    const alice = row("Alice");
    pointer(alice, "pointerdown", { y: 100 });
    pointer(alice, "pointermove", { y: 103 });
    pointer(alice, "pointerup", { y: 103 });
    click(alice);

    expect(selectedOrder()).toEqual(["Bob", "Chloé"]);
  });
});
