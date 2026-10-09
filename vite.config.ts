import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { expandFragments } from "./htmlFragments";

const fromRoot = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url));

const pkg = JSON.parse(readFileSync(fromRoot("package.json"), "utf-8")) as {
  version: string;
};

// Fragments communs des pages (<head>, pictogrammes) : voir htmlFragments.ts.
// Seuls <title> et <meta charset> restent dans chaque fichier.
// `order: "pre"` : l'injection doit passer AVANT le traitement HTML de Vite,
// sinon les chemins absolus des icônes (/favicon.svg…) ne seraient pas
// réécrits avec `base`.
const sharedHead = (): Plugin => ({
  name: "cornet-shared-head",
  transformIndexHtml: {
    order: "pre",
    handler: expandFragments,
  },
});

// https://vite.dev/config/
export default defineConfig({
  // Doit correspondre exactement au nom du repo GitHub pour le déploiement
  // sur GitHub Pages (https://paddadie.github.io/YamsApp/).
  base: "/YamsApp/",

  // Exposé au code applicatif via la constante globale __APP_VERSION__.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  // Application multi-pages : un fichier HTML (donc un point d'entrée) par écran.
  build: {
    rollupOptions: {
      input: {
        home: fromRoot("index.html"),
        players: fromRoot("players.html"),
        settings: fromRoot("settings.html"),
        rules: fromRoot("rules.html"),
        yamsHome: fromRoot("yams.html"),
        yamsGame: fromRoot("yams-game.html"),
        yamsEnd: fromRoot("yams-end.html"),
        yamsHall: fromRoot("yams-hall.html"),
        g5000Home: fromRoot("5000.html"),
        g5000Game: fromRoot("5000-game.html"),
        g5000End: fromRoot("5000-end.html"),
        g5000Records: fromRoot("5000-records.html"),
      },
    },
  },

  plugins: [
    sharedHead(),
    VitePWA({
      registerType: "prompt", // on gère nous-mêmes le bandeau "Mettre à jour"
      injectRegister: false, // enregistrement fait à la main dans src/core/pwa/updatePrompt.ts
      includeAssets: ["favicon.svg", "favicon-48.png", "apple-touch-icon.png"],
      manifest: {
        lang: "fr",
        name: "Cornet — jeux de dés",
        short_name: "Cornet",
        description: "Feuilles de score pour jeux de dés : Yams et 5000.",
        theme_color: "#f3efe6",
        background_color: "#f3efe6",
        display: "standalone",
        start_url: "/YamsApp/",
        scope: "/YamsApp/",
        icons: [
          // Le cornet du menu, sur le papier de l'appli, fond opaque. La
          // version « maskable » garde le dessin dans le cercle qu'Android
          // découpe.
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Précache toutes les pages + le JS/CSS produit, et la police Archivo
        // (alphabets latins seulement : le fichier vietnamien n'est jamais
        // demandé par une page en français) — sans elle, hors ligne, tout
        // retomberait sur la police du système.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}", "**/archivo-latin-*.woff2"],
        // Workbox compare l'URL complète, paramètres compris : une page appelée
        // avec un paramètre (`yams-game.html?review=1`, `settings.html?game=yams`,
        // `rules.html?game=g5000`) ne correspond à aucune entrée du précache, la
        // requête retombe sur la NavigationRoute (liée à index.html) et
        // l'utilisateur atterrit sur le menu des jeux. Invisible en
        // développement, où il n'y a pas de service worker.
        // On ignore donc TOUS les paramètres plutôt que de les lister : le piège
        // a mordu deux fois (`review`, puis `game`), et aucune page n'a de
        // version en cache qui dépende de ses paramètres — elles les lisent en JS.
        ignoreURLParametersMatching: [/.*/],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
