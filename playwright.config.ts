import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  projects: [
    { name: "storefront", testIgnore: ["admin.spec.ts", "batch-b.spec.ts"] },
    { name: "admin", testMatch: "admin.spec.ts", dependencies: ["storefront"] },
    { name: "batch-b", testMatch: "batch-b.spec.ts", dependencies: ["admin"] },
  ],
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    actionTimeout: 15_000,
  },
  webServer: {
    command: "node --conditions=react-server --import tsx tests/e2e/server.ts",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
