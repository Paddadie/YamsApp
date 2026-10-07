// Environnement des tests de pages : ce que jsdom n'implémente pas, et la
// navigation, qui est notée au lieu d'être suivie.

import { afterEach, beforeEach, vi } from "vitest";

// `goTo` change de page : sous jsdom on se contente de noter où l'écran
// voulait aller (cf. navigations() dans harness.ts).
vi.mock("../../core/nav", () => ({
  goTo: (page: string) => {
    (globalThis as { __navigations?: string[] }).__navigations?.push(page);
  },
}));

// <dialog> : jsdom connaît l'élément mais ni showModal() ni close(). La
// fermeture doit émettre `close`, comme dans un navigateur — plusieurs écrans
// enchaînent sur cet événement — et ne rien faire sur un dialogue déjà fermé.
const dialogProto = HTMLDialogElement.prototype as HTMLDialogElement & {
  showModal(): void;
  close(): void;
};
dialogProto.showModal = function (this: HTMLDialogElement) {
  this.open = true;
};
dialogProto.close = function (this: HTMLDialogElement) {
  if (!this.open) return;
  this.open = false;
  this.dispatchEvent(new Event("close"));
};

Element.prototype.scrollTo = () => {};
HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

beforeEach(() => {
  localStorage.clear();
  (globalThis as { __navigations?: string[] }).__navigations = [];
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});
