import { registerSW } from "virtual:pwa-register";
import "./updatePrompt.css";

/**
 * Enregistre le service worker et affiche un bandeau "Mettre à jour" quand une
 * nouvelle version de l'app a été précachée. Pas de mise à jour silencieuse :
 * l'utilisateur choisit le moment (le rechargement peut interrompre une partie).
 */
export function initUpdatePrompt(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      showBanner(() => {
        void updateSW(true); // recharge la page sur la nouvelle version
      });
    },
    onRegisterError(error) {
      console.error("Échec de l'enregistrement du service worker :", error);
    },
  });
}

function showBanner(onUpdate: () => void): void {
  if (document.querySelector(".update-prompt")) return;

  const banner = document.createElement("div");
  banner.className = "update-prompt";
  banner.innerHTML = `
    <span class="update-prompt-text">Nouvelle version disponible</span>
    <div class="update-prompt-actions">
      <button type="button" class="update-prompt-dismiss">Plus tard</button>
      <button type="button" class="update-prompt-confirm">Mettre à jour</button>
    </div>`;

  banner
    .querySelector(".update-prompt-dismiss")
    ?.addEventListener("click", () => banner.remove());
  banner
    .querySelector(".update-prompt-confirm")
    ?.addEventListener("click", onUpdate);

  document.body.appendChild(banner);
}
