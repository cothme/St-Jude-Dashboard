import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    setupFiles: ["./test/setupEnv.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["dist/**", "node_modules/**", "test/**", "prisma/migrations/**", "**/*.config.*"],
    },
  },
});
