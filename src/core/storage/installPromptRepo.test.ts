import { beforeEach, describe, expect, it } from "vitest";
import { neverOfferInstall, shouldOfferInstall, snoozeInstall } from "./installPromptRepo";

beforeEach(() => localStorage.clear());

describe("fenêtre « Installer Cornet »", () => {
  const monday = new Date(2026, 9, 5, 20, 30);

  it("se propose tant qu'on n'a rien répondu", () => {
    expect(shouldOfferInstall(monday)).toBe(true);
  });

  it("« Plus tard » la repousse d'une semaine, pas plus", () => {
    snoozeInstall(monday);
    expect(shouldOfferInstall(new Date(2026, 9, 11, 22, 0))).toBe(false);
    expect(shouldOfferInstall(new Date(2026, 9, 12, 20, 30))).toBe(true);
  });

  it("« Ne plus demander » l'arrête pour de bon, même après une semaine", () => {
    snoozeInstall(monday);
    neverOfferInstall();
    expect(shouldOfferInstall(new Date(2027, 0, 1))).toBe(false);
  });

  it("un contenu abîmé ne bloque rien", () => {
    localStorage.setItem("app-install-prompt", "[1, 2]");
    expect(shouldOfferInstall(monday)).toBe(true);
  });
});
