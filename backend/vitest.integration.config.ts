import { defineConfig } from "vitest/config";

const DATABASE_URL =
  "postgresql://pulse:pulse@localhost:5433/pulse_test?schema=public";

process.env.DATABASE_URL = DATABASE_URL;

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.spec.ts"],
    fileParallelism: false,
    globalSetup: ["./vitest.integration.global-setup.ts"],
    env: {
      DATABASE_URL,
    },
  },
});
