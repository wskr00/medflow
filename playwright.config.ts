import { defineConfig } from "@playwright/test";

/**
 * Exercita a aplicação já integrada (Angular + API + Keycloak). A suíte não
 * sobe serviços, para não mascarar problemas de configuração do ambiente.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
