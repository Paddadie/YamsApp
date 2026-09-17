import { registerSW } from "virtual:pwa-register";
import "./updatePrompt.css";

// Enregistre le service worker et affiche un bandeau "Mettre à jour" quand une
// nouvelle version de l'app a été précachée. Pas de mise à jour silencieuse :
// l'utilisateur choisit le moment (le rechargement peut interrompre une partie).
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
  // Le bandeau surgit sans action de l'utilisateur : `status` le fait annoncer
  // sans interrompre ce qu'il est en train de faire.
  banner.setAttribute("role", "status");

  const text = document.createElement("span");
  text.className = "update-prompt-text";
  text.textContent = "Nouvelle version disponible";

  const actions = document.createElement("div");
  actions.className = "update-prompt-actions";
  actions.append(
    button("update-prompt-dismiss", "Plus tard", () => banner.remove()),
    button("update-prompt-confirm", "Mettre à jour", onUpdate),
  );

  banner.append(text, actions);
  document.body.appendChild(banner);
}

function button(cls: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}
