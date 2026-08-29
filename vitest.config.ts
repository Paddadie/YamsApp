import { defineConfig } from "vitest/config";

// Config distincte de vite.config.ts : les tests portent sur la logique pure
// (règles, Hall of Fame, dates) et n'ont besoin ni du plugin PWA ni des
// points d'entrée HTML.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
  },
});
