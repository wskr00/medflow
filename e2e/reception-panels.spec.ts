import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

test("painéis permanecem acessíveis com rolagem, fila longa e janela baixa", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const events: string[] = [];
    Object.assign(window, { receptionAnimations: events });
    document.addEventListener("animationstart", (event) =>
      events.push(event.animationName),
    );
  });
  const items = Array.from({ length: 25 }, (_, index) => ({
    id: `58000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
    inicio: "2026-11-04T10:00:00-03:00",
    fim: "2026-11-04T10:30:00-03:00",
    checkInEm: "2026-11-04T09:50:00-03:00",
    status: "EM_ESPERA",
    version: 1,
    paciente: {
      id: `patient-${index}`,
      nome: `Paciente sintético ${index + 1}`,
    },
    medico: { id: "doctor", nome: "Dra. Camila Ramos" },
    especialidade: { id: "specialty", nome: "Clínica geral" },
    unidade: { id: "unit", nome: "Unidade Central" },
    consultorio: { id: "room", nome: "Consultório 101" },
    pendenteDeDiaAnterior: false,
    allowedActions: {
      canCheckIn: false,
      canReschedule: false,
      canCancel: false,
    },
  }));
  await page.route("**/api/recepcao/agenda?*", (route) =>
    route.fulfill({
      json: {
        items: items.slice(0, 20).map((item, index) =>
          index === 0
            ? {
                ...item,
                status: "AGENDADA",
                allowedActions: {
                  ...item.allowedActions,
                  canReschedule: true,
                },
              }
            : item,
        ),
        page: 0,
        size: 20,
        totalElements: 25,
      },
    }),
  );
  await page.route("**/api/recepcao/fila?*", (route) => {
    const current = Number(
      new URL(route.request().url()).searchParams.get("page"),
    );
    return route.fulfill({
      json: {
        items: items.slice(current * 20, current * 20 + 20),
        page: current,
        size: 20,
        totalElements: 25,
      },
    });
  });
  await page.route(`**/api/agendamentos/${items[0].id}`, (route) =>
    route.fulfill({ json: { ...items[0], status: "AGENDADA" } }),
  );
  await page.route(
    `**/api/agendamentos/${items[0].id}/disponibilidades?*`,
    (route) =>
      route.fulfill({ json: { items: [], timeZone: "America/Belem" } }),
  );
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/workspace/reception?data=2026-11-04");
  await page.waitForURL(/:8085/);
  await page.getByLabel(/username|usuário/i).fill("recepcionista");
  await page.locator('input[type="password"]').fill("recepcionista");
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  const queue = page.getByRole("complementary", { name: "Fila de espera" });
  const list = page.getByRole("list", { name: "Pacientes aguardando" });
  await expect(list.locator("li")).toHaveCount(20);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { receptionAnimations: string[] })
            .receptionAnimations,
      ),
    )
    .toContain("medflow-page-enter");
  // The user name can be much longer than the synthetic realm's default.
  await page.locator(".rail-session app-session-actions p").evaluate((el) => {
    el.textContent = "Maria de Fátima Albuquerque de Vasconcelos";
  });
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1024, height: 500 },
    { width: 768, height: 1024 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const exit = await page.locator(".rail-session button").boundingBox();
    expect(exit!.x).toBeGreaterThanOrEqual(0);
    expect(exit!.x + exit!.width).toBeLessThanOrEqual(viewport.width);
    expect(exit!.y + exit!.height).toBeLessThanOrEqual(viewport.height);
    if (viewport.width === 320)
      await page.screenshot({
        path: testInfo.outputPath("header-320.png"),
        animations: "disabled",
      });
    await page.evaluate(() =>
      window.scrollTo({ top: 900, behavior: "instant" }),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (viewport.width >= 1024) {
      const bounds = await page.locator(".rail-session").boundingBox();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
      expect((await page.locator(".reception-rail").boundingBox())!.y).toBe(0);
    }
    await page.screenshot({
      path: testInfo.outputPath(`scroll-${viewport.width}.png`),
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await queue.scrollIntoViewIfNeeded();
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
  await list.focus();
  await list.press("End");
  await expect
    .poll(() =>
      list.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop),
    )
    .toBeLessThan(2);
  const bounds = await queue
    .getByRole("button", { name: "Próximos", exact: true })
    .boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(768);
  await page.screenshot({
    path: testInfo.outputPath("queue-long.png"),
    animations: "disabled",
  });
  await queue.getByRole("button", { name: "Próximos", exact: true }).click();
  await expect(list.locator("li")).toHaveCount(5);
  await expect(list).toContainText("Paciente sintético 21");
  await queue.getByRole("button", { name: "Anteriores", exact: true }).click();
  await expect(list.locator("li")).toHaveCount(20);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await page
    .locator("app-reception-operation")
    .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
  expect(duration).toBeLessThan(0.001);
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".rail-current")).toHaveAttribute(
    "aria-current",
    "page",
  );
  const transitionsBefore = await page.evaluate(
    () =>
      (
        window as typeof window & { receptionAnimations: string[] }
      ).receptionAnimations.filter((name) => name === "medflow-page-enter")
        .length,
  );
  await page
    .getByRole("link", { name: "Reagendar", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reagendar consulta", exact: true }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator("#reception-main")).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & { receptionAnimations: string[] }
          ).receptionAnimations.filter((name) => name === "medflow-page-enter")
            .length,
      ),
    )
    .toBeGreaterThan(transitionsBefore);
  await page.screenshot({
    path: testInfo.outputPath("reschedule-viewport.png"),
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Voltar à agenda" }).click();
  await expect(
    page.getByRole("heading", { name: "Agenda do dia", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#reception-main")).toBeFocused();
});
