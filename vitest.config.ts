import { defineConfig } from "vitest/config";

// Config distincte de vite.config.ts : les tests portent sur la logique sans
// DOM (barèmes et moteurs des jeux, records, stockage, migration, sauvegarde)
// et n'ont besoin ni du plugin PWA ni des points d'entrée HTML.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Les tests de pages ont leur propre configuration (jsdom) :
    // vitest.pages.config.ts, `npm run test:pages`.
    exclude: ["src/test/pages/**", "node_modules/**"],
    setupFiles: ["src/test/setup.ts"],
  },
});
