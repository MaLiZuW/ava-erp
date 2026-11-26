import { defineConfig, devices } from "@playwright/test";

// Tests run against the static export (out/), exactly like the production hosting.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:3100" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx serve out -l 3100 --no-clipboard",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
  },
});
