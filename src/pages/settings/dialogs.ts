// Pop-up de message des Paramètres, partagée par les panneaux (aide de
// l'indice de bonus, résultat d'un import).

import { makeDismissible, requireEl } from "../../ui";

const messageDialog = requireEl<HTMLDialogElement>("message-dialog");
const messageTitle = requireEl("message-title");
const messageText = requireEl("message-text");

// Le dialogue est réutilisé : ses façons de le fermer sont posées une fois pour
// toutes, seul son contenu change.
export function setupMessageDialog(): void {
  makeDismissible(messageDialog, "message-ok");
}

// Remplace les anciens alert() : même habillage que les autres pop-ups.
// `onClose` part sur l'événement `close` et non sur le clic « OK », pour être
// honoré quelle que soit la façon de fermer (OK, fond, Échap).
export function showMessage(title: string, text: string, onClose?: () => void): void {
  messageTitle.textContent = title;
  messageText.textContent = text;

  // Le dialogue est réutilisé : l'écouteur ne vaut que pour cette ouverture.
  const open = new AbortController();
  messageDialog.addEventListener(
    "close",
    () => {
      open.abort();
      onClose?.();
    },
    { signal: open.signal },
  );

  messageDialog.showModal();
}
