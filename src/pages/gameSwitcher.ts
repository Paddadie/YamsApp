// Sélecteur de jeu : le titre de l'écran d'accueil d'un jeu est un bouton, et
// il déroule la liste des jeux juste en dessous. On passe ainsi du Yams au 5000
// sans repasser par le menu, et c'est aussi le chemin de retour vers ce menu.
//
// Un menu déroulant et non une fenêtre modale : le chevron promet un déroulé,
// et changer d'écran n'est pas un événement qui mérite d'assombrir la page. Le
// contexte reste visible derrière, et le menu s'ouvre sous le doigt plutôt qu'au
// centre de l'écran.
//
// Partagé par les accueils de jeux : chacun pose le même balisage (le bouton
// `game-switch` dans son `<h1>`, la liste `game-switcher`) et appelle
// `setupGameSwitcher(sonId)`. Le contenu vient du registre, donc un jeu ajouté
// apparaît ici sans qu'on touche à ce fichier.

import { icon, type IconName } from "../core/icons";
import { requireEl } from "../core/ui";
import { GAMES } from "../games/registry";

// Chevron, emblèmes et coche dessinés plutôt qu'écrits : les caractères de ce
// genre (⌄, ▾, ✓, emoji) sont rendus par la police du système, donc de taille
// et de dessin variables d'un appareil à l'autre — et parfois pas rendus du
// tout. En SVG, ils suivent la taille du texte et restent posés au même
// endroit partout.

function span(className: string, content: string | Node, decorative = false): HTMLElement {
  const el = document.createElement("span");
  el.className = className;
  el.append(content);
  if (decorative) el.setAttribute("aria-hidden", "true");
  return el;
}

function buildRow(
  emblem: IconName,
  label: string,
  href: string,
  current: boolean,
  accent?: string,
): HTMLAnchorElement {
  const row = document.createElement("a");
  row.className = current ? "switcher-row is-current" : "switcher-row";
  row.href = href;
  if (accent) row.style.setProperty("--row-accent", accent);
  if (current) row.setAttribute("aria-current", "page");

  row.append(
    span("switcher-icon", icon(emblem), true),
    span("switcher-label", label),
  );
  // La coche dit où l'on est déjà ; la ligne reste cliquable (elle recharge le
  // même écran) plutôt que désactivée, ce qui la ferait paraître cassée.
  if (current) row.appendChild(span("switcher-mark", icon("tick"), true));
  return row;
}

export function setupGameSwitcher(currentId: string): void {
  const button = requireEl<HTMLButtonElement>("game-switch");
  const menu = requireEl<HTMLUListElement>("game-switcher");

  const current = GAMES.find((g) => g.id === currentId);
  // Le nom seul, en grand, à l'encre du jeu : l'emblème n'est que dans la
  // liste, où il aide à distinguer les lignes.
  button.replaceChildren(
    span("game-switch-name", current?.title ?? "Jeu"),
    icon("chevronDown", "game-switch-chevron"),
  );

  menu.replaceChildren();
  for (const game of GAMES) {
    const li = document.createElement("li");
    li.appendChild(
      buildRow(game.icon, game.title, game.pages.home, game.id === currentId, game.accent),
    );
    menu.appendChild(li);
  }
  const separator = document.createElement("li");
  separator.className = "switcher-separator";
  menu.appendChild(separator);

  const allGames = document.createElement("li");
  allGames.appendChild(buildRow("die", "Tous les jeux", "index.html", false));
  menu.appendChild(allGames);

  // Les écouteurs posés à l'ouverture sont retirés à la fermeture par un
  // AbortController, et non par `{ once: true }` : une fermeture au clavier
  // laisserait sinon celui du clic extérieur accroché au document.
  let openController: AbortController | null = null;

  const rows = (): HTMLAnchorElement[] => [...menu.querySelectorAll<HTMLAnchorElement>("a")];

  // `refocus` : rendre le focus au bouton (fermeture au clavier), sinon il
  // resterait sur une ligne masquée.
  function close(refocus = false): void {
    if (!openController) return;
    openController.abort();
    openController = null;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (refocus) button.focus();
  }

  // Flèches haut / bas : d'une ligne à l'autre, en boucle.
  function moveFocus(step: 1 | -1): void {
    const all = rows();
    const at = all.indexOf(document.activeElement as HTMLAnchorElement);
    all[(at + step + all.length) % all.length]?.focus();
  }

  function open(): void {
    if (openController) return;
    openController = new AbortController();
    const { signal } = openController;
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    // Le focus entre dans le menu, sur le jeu où l'on est : au clavier comme
    // au lecteur d'écran, on sait tout de suite où l'on se trouve.
    (menu.querySelector<HTMLAnchorElement>("a.is-current") ?? rows()[0])?.focus();

    // Le clic qui vient d'ouvrir le menu remonterait aussitôt jusqu'au document
    // et le refermerait : on n'écoute qu'à partir du tour suivant.
    setTimeout(() => {
      if (!openController) return;
      document.addEventListener(
        "click",
        (e) => {
          const target = e.target as Node | null;
          if (target && (menu.contains(target) || button.contains(target))) return;
          close();
        },
        { signal },
      );
    });

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") close(true);
        else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault(); // pas de défilement de la page
          moveFocus(e.key === "ArrowDown" ? 1 : -1);
        }
      },
      { signal },
    );
  }

  button.setAttribute("aria-expanded", "false");
  menu.hidden = true;
  button.addEventListener("click", () => (menu.hidden ? open() : close()));
}
