import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // Los tests comparten la base de desarrollo (bloqueos de login, reservas): de a uno.
  workers: 1,
  use: { baseURL: "http://localhost:7777" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:7777",
    reuseExistingServer: true,
  },
});
