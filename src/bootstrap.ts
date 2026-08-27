// Amorçage commun à toutes les pages : styles globaux + enregistrement du
// service worker (avec le bandeau "Mettre à jour").

import "./style.css";
import { initUpdatePrompt } from "./pwa/updatePrompt";

export function bootstrap(): void {
  initUpdatePrompt();
}
