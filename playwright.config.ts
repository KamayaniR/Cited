import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * One E2E run walks the full pipeline in mock mode (spec Section 10). Build first (`npm run e2e` does).
 * CITED_FORCE_MOCK keeps every vendor mocked even if .env.local has keys; SENDING_ENABLED=false is the kill switch.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", viewport: { width: 1440, height: 1000 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { CITED_FORCE_MOCK: "true", SENDING_ENABLED: "false", NODE_ENV: "production" },
  },
});
