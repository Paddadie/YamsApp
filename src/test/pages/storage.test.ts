// Stockage : persistance demandée, échec d'écriture signalé.

import { describe, expect, it, vi } from "vitest";
import { button, click, el, openPage } from "./harness";
import { yamsGame } from "./fixtures";

const quotaError = (): DOMException => new DOMException("plein", "QuotaExceededError");

describe("stockage plein ou indisponible", () => {
  it("le bandeau s'affiche dès le chargement si le stockage refuse d'écrire", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw quotaError();
    });
    await openPage("home");
    spy.mockRestore();
    expect(el(".storage-alert").getAttribute("role")).toBe("alert");
  });

  it("une saisie qui ne peut pas être enregistrée fait apparaître le bandeau", async () => {
    yamsGame();
    await openPage("yamsGame");
    expect(document.querySelector(".storage-alert")).toBeNull();

    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw quotaError();
    });
    // jsdom signale l'exception de l'écouteur comme un navigateur (événement
    // `error` sur window) et l'écrit dans la console : « Uncaught
    // [QuotaExceededError: plein] » dans la sortie des tests est attendu.
    click(document.querySelectorAll<HTMLButtonElement>(".score-cell")[0]);
    click(button("3", el("#picker-values")));
    spy.mockRestore();

    expect(document.querySelector(".storage-alert")).not.toBeNull();
  });
});

describe("stockage persistant", () => {
  it("est demandé au navigateur s'il ne l'est pas déjà", async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal("navigator", {
      ...navigator,
      storage: { persisted: async () => false, persist },
    });
    await openPage("home");
    await Promise.resolve();
    await Promise.resolve();
    vi.unstubAllGlobals();
    expect(persist).toHaveBeenCalledOnce();
  });
});

describe("export de la sauvegarde", () => {
  it("dit que le fichier est parti, et lequel", async () => {
    vi.useFakeTimers();
    // jsdom ne fabrique pas d'URL de blob ni ne télécharge : on les bouchonne.
    URL.createObjectURL = vi.fn(() => "blob:sauvegarde");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await openPage("settings");
    click("#export-btn");

    const notice = el("#export-done");
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toMatch(/^Sauvegarde téléchargée : cornet-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);

    vi.runAllTimers();
    expect(notice.hidden).toBe(true);
  });
});
