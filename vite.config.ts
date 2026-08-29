import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const fromRoot = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url));

const pkg = JSON.parse(readFileSync(fromRoot("package.json"), "utf-8")) as {
  version: string;
};

// Partie commune du <head> des six pages : viewport, icône, réglages PWA iOS.
// Seuls <title> et <meta charset> restent dans chaque fichier.
const COMMON_HEAD = `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <link rel="icon" href="/de.png" />
    <meta name="theme-color" content="#ffffff" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Yams" />`;

// `order: "pre"` : l'injection doit passer AVANT le traitement HTML de Vite,
// sinon le chemin absolu /de.png ne serait pas réécrit avec `base`.
const sharedHead = (): Plugin => ({
  name: "yams-shared-head",
  transformIndexHtml: {
    order: "pre",
    handler: (html) => html.replace("<!--@head-->", COMMON_HEAD),
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
        game: fromRoot("game.html"),
        end: fromRoot("end.html"),
        hall: fromRoot("hall.html"),
        settings: fromRoot("settings.html"),
      },
    },
  },

  plugins: [
    sharedHead(),
    VitePWA({
      registerType: "prompt", // on gère nous-mêmes le bandeau "Mettre à jour"
      injectRegister: false, // enregistrement fait à la main dans src/pwa/updatePrompt.ts
      includeAssets: ["de.png"],
      manifest: {
        lang: "fr",
        name: "Score de Yams",
        short_name: "Yams",
        description: "Feuille de score de Yams (classique, montante, descendante, one shot).",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/YamsApp/",
        scope: "/YamsApp/",
        icons: [
          { src: "de.png", sizes: "192x192", type: "image/png" },
          { src: "de.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
      },
      workbox: {
        // Précache les six pages + le JS/CSS produit.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        // Workbox compare l'URL complète, paramètres compris : sans ce réglage
        // `game.html?review=1` ne correspond à aucune entrée du précache, la
        // requête retombe sur la NavigationRoute (liée à index.html) et
        // l'utilisateur atterrit sur l'accueil au lieu des feuilles de score.
        // Invisible en développement, où il n'y a pas de service worker.
        // Les deux premiers motifs sont les valeurs par défaut de Workbox.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^review$/],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
