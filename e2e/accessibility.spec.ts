import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type Workspace = {
  name: string;
  username: string;
  password: string;
  route: string;
  heading: RegExp;
};

const workspaces: readonly Workspace[] = [
  {
    name: "paciente",
    username: "paciente",
    password: "paciente",
    route: "/workspace/patient/consultas",
    heading: /Consultas|Próximas consultas/i,
  },
  {
    name: "recepção",
    username: "recepcionista",
    password: "recepcionista",
    route: "/workspace/reception",
    heading: /Recepção|Agenda/i,
  },
  {
    name: "médico",
    username: "medico",
    password: "medico",
    route: "/workspace/doctor/triagem",
    heading: /Minha agenda|Triagem/i,
  },
  {
    name: "administração",
    username: "administrador",
    password: "administrador",
    route: "/workspace/admin/estrutura",
    heading: /Unidades e consultórios/i,
  },
];

const viewports = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "tablet", width: 768, height: 1024 },
] as const;

async function login(page: Page, workspace: Workspace) {
  await page.goto(workspace.route);

  if (new URL(page.url()).port === "8085") {
    await page.getByLabel(/username|usuário/i).fill(workspace.username);
    await page.locator('input[type="password"]').fill(workspace.password);
    await page.getByRole("button", { name: /sign in|entrar|log in/i }).click();
  }

  await expect(page).toHaveURL(new RegExp(`${workspace.route.replaceAll("/", "\\/")}$`));
  await expect(page.getByRole("heading", { name: workspace.heading }).first()).toBeVisible();
}

for (const viewport of viewports) {
  test.describe(`${viewport.name} ${viewport.width}x${viewport.height}`, () => {
    for (const workspace of workspaces) {
      test(`${workspace.name}: sem violações críticas e com controles acessíveis`, async ({ page }) => {
        const apiFailures: string[] = [];
        const consoleErrors: string[] = [];
        page.on("response", (response) => {
          if (response.url().includes("/api/") && response.status() >= 500) {
            apiFailures.push(`${response.status()} ${response.url()}`);
          }
        });
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });

        await page.setViewportSize(viewport);
        await login(page, workspace);

        await page.locator("body").press("Tab");
        await expect
          .poll(() => page.evaluate(() => document.activeElement?.tagName))
          .not.toBe("BODY");

        const unlabeledControls = await page
          .locator("input, select, textarea")
          .evaluateAll((controls) =>
            controls
              .filter((control) => {
                const element = control as HTMLInputElement;
                return !element.labels?.length && !element.getAttribute("aria-label");
              })
              .map((control) => (control as HTMLElement).outerHTML),
          );
        expect(unlabeledControls).toEqual([]);

        const hasHorizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(hasHorizontalOverflow).toBe(false);

        const axe = await new AxeBuilder({ page }).analyze();
        const criticalViolations = axe.violations.filter(
          (violation) => violation.impact === "critical",
        );
        expect(criticalViolations).toEqual([]);
        expect(apiFailures).toEqual([]);
        expect(consoleErrors).toEqual([]);
      });
    }
  });
}
