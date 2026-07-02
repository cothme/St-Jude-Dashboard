import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./test/setupTests.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["dist/**", "node_modules/**", "test/**", "**/*.config.*"],
    },
  },
});
