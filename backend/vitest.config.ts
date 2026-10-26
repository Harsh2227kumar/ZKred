import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    setupFiles: ["test/setup-env.ts"],
    // Integration suites share one chain account (the accreditor); parallel files would race on its nonce.
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
