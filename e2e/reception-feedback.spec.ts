import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const appointment = {
  id: "58000000-0000-0000-0000-000000000001",
  version: 3,
  inicio: "2026-11-04T10:00:00-03:00",
  fim: "2026-11-04T10:30:00-03:00",
  status: "AGENDADA",
  checkInEm: null,
  pendenteDeDiaAnterior: false,
  paciente: { id: "patient", nome: "Lia Pereira" },
  medico: { id: "doctor", nome: "Dra. Camila Ramos" },
  especialidade: { id: "specialty", nome: "Clínica geral" },
  unidade: { id: "unit", nome: "Unidade Central" },
  consultorio: { id: "room", nome: "Consultório 101" },
  allowedActions: { canCheckIn: true, canCancel: true, canReschedule: true },
};
const pageOf = (items: unknown[]) => ({
  items,
  page: 0,
  size: 20,
  totalElements: items.length,
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 768, height: 1024 },
]) {
  test(`recepção ${viewport.width}: conflito preserva filtros e não confirma chegada`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/recepcao/agenda?*", (route) =>
      route.fulfill({ json: pageOf([appointment]) }),
    );
    await page.route("**/api/recepcao/fila?*", (route) =>
      route.fulfill({ json: pageOf([]) }),
    );
    await page.route(
      `**/api/agendamentos/${appointment.id}/check-in`,
      async (route) => {
        expect(route.request().postDataJSON()).toEqual({ expectedVersion: 3 });
        await route.fulfill({
          status: 409,
          json: { code: "VERSAO_DESATUALIZADA" },
        });
      },
    );
    await page.goto("/workspace/reception?data=2026-11-04");
    await page.waitForURL(/:8085/);
    await page.getByLabel(/username|usuário/i).fill("recepcionista");
    await page.locator('input[type="password"]').fill("recepcionista");
    await page.getByRole("button", { name: /sign in|entrar/i }).click();
    const checkIn = page
      .getByRole("button", { name: "Confirmar chegada" })
      .filter({ visible: true });
    await expect(checkIn).toBeVisible();
    await checkIn.click();
    await expect(
      page.getByRole("heading", { name: "Consulta atualizada" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Chegada confirmada" }),
    ).toHaveCount(0);
    await expect(page.locator("#operation-date")).toHaveValue("2026-11-04");
    await expect(
      page.getByRole("button", { name: "Recarregar operação" }),
    ).toBeVisible();
    await expect(page.getByText("Nenhum paciente aguardando")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const violations = (
      await new AxeBuilder({ page }).analyze()
    ).violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );
    expect(violations).toEqual([]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page
        .locator("html")
        .evaluate((el) => getComputedStyle(el).scrollBehavior),
    ).toBe("auto");
  });
}

test("recepção: carregamento, erro regional e recuperação para vazio", async ({
  page,
}, testInfo) => {
  let releaseAgenda!: () => void;
  const pending = new Promise<void>((resolve) => {
    releaseAgenda = resolve;
  });
  let fail = true;
  await page.route("**/api/recepcao/agenda?*", async (route) => {
    await pending;
    await route.fulfill(
      fail
        ? { status: 503, json: { code: "FALHA_DE_REDE" } }
        : { json: pageOf([]) },
    );
  });
  await page.route("**/api/recepcao/fila?*", (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: { code: "FALHA_DE_REDE" } }
        : { json: pageOf([]) },
    ),
  );
  await page.goto("/workspace/reception?data=2026-11-04");
  await page.waitForURL(/:8085/);
  await page.getByLabel(/username|usuário/i).fill("recepcionista");
  await page.locator('input[type="password"]').fill("recepcionista");
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  const agenda = page.getByRole("region", { name: "Agenda", exact: true });
  await expect(agenda).toHaveAttribute("aria-busy", "true");
  await page.screenshot({
    path: testInfo.outputPath("loading.png"),
    animations: "disabled",
    fullPage: true,
  });
  releaseAgenda();
  await expect(
    agenda.getByRole("heading", { name: "Falha de conexão" }),
  ).toBeVisible();
  const queue = page.getByRole("complementary", { name: "Fila de espera" });
  await expect(
    queue.getByRole("heading", { name: "Falha de conexão" }),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("error.png"),
    animations: "disabled",
    fullPage: true,
  });
  fail = false;
  await agenda.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    agenda.getByRole("heading", { name: "Nenhuma consulta encontrada" }),
  ).toBeVisible();
  await queue.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("Nenhum paciente aguardando")).toBeVisible();
  await expect(page.locator("#operation-date")).toHaveValue("2026-11-04");
  await page.screenshot({
    path: testInfo.outputPath("empty.png"),
    animations: "disabled",
    fullPage: true,
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  expect(
    await page
      .locator(".reception-workspace")
      .evaluate(
        (el) =>
          getComputedStyle(el).backgroundColor ===
          getComputedStyle(document.body).backgroundColor,
      ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("empty-tablet.png"),
    animations: "disabled",
    fullPage: true,
  });
});
