// « Installer Cornet » : la fenêtre du menu et la ligne de Paramètres ›
// Sauvegarde (core/pwa/install.ts).

import { afterEach, describe, expect, it, vi } from "vitest";
import { click, el, openPage } from "./harness";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

function device(userAgent: string, standalone = false): void {
  vi.stubGlobal("navigator", { ...navigator, userAgent, maxTouchPoints: 5, standalone });
}

const dialog = (): HTMLDialogElement => el<HTMLDialogElement>("#install-dialog");
const stored = (): Record<string, unknown> =>
  JSON.parse(localStorage.getItem("app-install-prompt") ?? "{}");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("au menu, sur iPhone", () => {
  it("propose d'installer, avec les deux gestes et sans bouton « Installer »", async () => {
    device(IPHONE);
    await openPage("home");
    expect(dialog().open).toBe(true);
    expect(el("#install-steps").textContent).toContain("Partager");
    expect(el("#install-steps").textContent).toContain("Sur l'écran d'accueil");
    expect(el("#install-go").hidden).toBe(true);
  });

  it("« Plus tard » la repousse d'une semaine", async () => {
    device(IPHONE);
    await openPage("home");
    click("#install-later");
    expect(dialog().open).toBe(false);
    expect(typeof stored().snoozedUntil).toBe("string");

    await openPage("home");
    expect(dialog().open).toBe(false);
  });

  it("fermée sans répondre, c'est « Plus tard »", async () => {
    device(IPHONE);
    await openPage("home");
    dialog().close();
    expect(typeof stored().snoozedUntil).toBe("string");
  });

  it("« Ne plus demander » l'arrête pour de bon", async () => {
    device(IPHONE);
    await openPage("home");
    click("#install-never");
    expect(stored().never).toBe(true);
  });

  it("rien une fois l'appli installée", async () => {
    device(IPHONE, true);
    await openPage("home");
    expect(dialog().open).toBe(false);
  });
});

describe("au menu, ailleurs", () => {
  it("rien sur un navigateur qui ne sait pas installer", async () => {
    device(DESKTOP);
    await openPage("home");
    expect(dialog().open).toBe(false);
  });

  it("Android / Chrome : la fenêtre attend l'invitation du navigateur, et « Installer » l'ouvre", async () => {
    device(DESKTOP);
    await openPage("home");
    expect(dialog().open).toBe(false);

    const prompt = vi.fn(async () => {});
    const invitation = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    window.dispatchEvent(invitation);
    expect(invitation.defaultPrevented).toBe(true); // pas la bannière du navigateur
    expect(dialog().open).toBe(true);
    expect(el("#install-go").hidden).toBe(false);
    expect(el("#install-steps").textContent).toBe("");

    click("#install-go");
    expect(prompt).toHaveBeenCalled();
    await vi.waitFor(() => expect(stored().never).toBe(true));
    expect(dialog().open).toBe(false);
  });
});

describe("dans Paramètres › Sauvegarde", () => {
  it("sur iPhone, la ligne montre les deux gestes, même après « Ne plus demander »", async () => {
    device(IPHONE);
    localStorage.setItem("app-install-prompt", JSON.stringify({ never: true }));
    await openPage("settings");
    expect(el("#install-row").hidden).toBe(false);
    expect(el("#settings-install-steps").textContent).toContain("Partager");
    expect(el("#settings-install-go").hidden).toBe(true);
  });

  it("disparaît une fois l'appli installée", async () => {
    device(IPHONE, true);
    await openPage("settings");
    expect(el("#install-row").hidden).toBe(true);
  });
});
