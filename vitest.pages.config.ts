import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests de PAGES : chaque scénario charge le <body> d'un écran dans jsdom,
// importe son module d'entrée et rejoue des gestes. Séparés de la suite
// logique (vitest.config.ts), qui reste sans DOM : `npm run test:pages`.
//
// Ils attrapent ce que ni `tsc` ni les tests de logique ne voient : une
// constante lue en zone morte, un `id` manquant dans le HTML, une garde de
// redirection cassée.

const fromRoot = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url));

const pkg = JSON.parse(readFileSync(fromRoot("package.json"), "utf-8")) as {
  version: string;
};

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      // Le module virtuel du plugin PWA n'existe qu'au build.
      "virtual:pwa-register": fromRoot("src/test/pages/pwaRegisterStub.ts"),
    },
  },
  test: {
    include: ["src/test/pages/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: ["src/test/pages/setup.ts"],
  },
});
