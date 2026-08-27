import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as { version: string };

// https://vite.dev/config/
export default defineConfig({
  // Doit correspondre exactement au nom du repo GitHub pour le déploiement
  // sur GitHub Pages (https://paddadie.github.io/YamsApp/).
  base: "/YamsApp/",

  // Exposé au code applicatif via la constante globale __APP_VERSION__.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  plugins: [
    VitePWA({
      registerType: "prompt", // on gère nous-mêmes le bandeau "Mettre à jour"
      injectRegister: false, // enregistrement fait à la main dans src/pwa/updatePrompt.ts
      includeAssets: ["de.png", "podium.png"],
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
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
