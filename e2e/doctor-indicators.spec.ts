import { test, expect, Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
const path = "/workspace/doctor/indicadores";
function report(query: URLSearchParams, empty = false) {
  const inicio = query.get("inicio")!,
    fim = query.get("fim")!;
  const states = {
    totalConsultas: empty ? 0 : 9,
    agendadas: empty ? 0 : 4,
    emEspera: empty ? 0 : 1,
    emAtendimento: 0,
    finalizadas: empty ? 0 : 3,
    canceladas: empty ? 0 : 1,
  };
  return {
    inicio,
    fim,
    timeZone: "America/Belem",
    consultasPorDataAgendada: {
      ...states,
      porDia: empty
        ? []
        : inicio === fim
          ? [{ data: inicio, ...states }]
          : [
              {
                data: inicio,
                ...states,
                totalConsultas: 4,
                emEspera: 0,
                finalizadas: 0,
                canceladas: 0,
              },
              { data: fim, ...states, totalConsultas: 5, agendadas: 0 },
            ],
    },
    finalizacoesPorDataReal: {
      totalFinalizadas: empty ? 0 : 4,
      duracaoMediaSegundos: empty ? null : 1500,
      porDia: empty
        ? []
        : inicio === fim
          ? [{ data: inicio, totalFinalizadas: 4, duracaoMediaSegundos: 1500 }]
          : [
              { data: inicio, totalFinalizadas: 1, duracaoMediaSegundos: 600 },
              { data: fim, totalFinalizadas: 3, duracaoMediaSegundos: 1800 },
            ],
    },
  };
}
async function login(page: Page, target = path) {
  await page.goto(target);
  await page.waitForURL(/:8085/);
  await page.getByLabel(/username|usuário/i).fill("medico");
  await page.locator("input[type=password]").fill("medico");
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await page.waitForURL(/:4200/);
}
async function accessible(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
for (const width of [1366, 768])
  test(`minha atividade ${width}: filtros, média global, detalhamento e navegação`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1024 });
    const errors: string[] = [],
      requests: string[] = [],
      reads: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("request", (r) => {
      if (r.url().includes("/api/")) requests.push(new URL(r.url()).pathname);
    });
    await page.route("**/api/medico/indicadores?*", (route) => {
      reads.push(route.request().url());
      const query = new URL(route.request().url()).searchParams;
      expect([...query.keys()]).toEqual(["inicio", "fim"]);
      return route.fulfill({
        json: {
          ...report(query),
          paciente: "CONTEUDO_RESTRITO_NAO_RENDERIZAR",
        },
      });
    });
    await login(page);
    await expect(page.getByTestId("activity-scheduled")).toHaveText("9");
    await expect(page.getByTestId("activity-state-done")).toHaveText("3");
    await expect(page.getByTestId("activity-completed")).toHaveText("4");
    await expect(page.getByTestId("activity-average")).toHaveText("25 min");
    await expect(page.locator("#doctor-main")).toBeFocused();
    await expect(
      page.getByRole("link", { name: "Minha atividade", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.locator("body")).not.toContainText(
      "CONTEUDO_RESTRITO_NAO_RENDERIZAR",
    );
    const context = await page.locator(".applied-context").innerText(),
      before = reads.length;
    await page.getByLabel("Período", { exact: true }).selectOption("custom");
    await page.getByLabel("Data inicial", { exact: true }).fill("2031-01-01");
    await page.getByLabel("Data final", { exact: true }).fill("2031-01-07");
    expect(await page.locator(".applied-context").innerText()).toBe(context);
    expect(reads.length).toBe(before);
    await expect(page.locator(".draft-notice")).toBeVisible();
    await page
      .getByRole("button", { name: "Aplicar período", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/inicio=2031-01-01&fim=2031-01-07/);
    await expect(page.getByTestId("activity-average")).toHaveText("25 min");
    await expect(
      page.getByRole("button", { name: "Aplicar período", exact: true }),
    ).toBeFocused();
    await expect(page.locator("canvas[data-chart-kind=bar]")).toHaveCount(1);
    await expect(page.locator("#doctor-completed-days tbody tr")).toHaveCount(
      2,
    );
    await page
      .getByRole("button", {
        name: "Ver dados: Consultas por dia",
        exact: true,
      })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#doctor-scheduled-table")).toBeVisible();
    await expect(page.locator("#doctor-scheduled-table thead th")).toHaveCount(
      7,
    );
    await expect(page.locator("#doctor-scheduled-table tbody tr")).toHaveCount(
      2,
    );
    await accessible(page);
    await page.screenshot({
      path: info.outputPath(`atividade-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page.reload();
    await expect(page.getByLabel("Data final", { exact: true })).toHaveValue(
      "2031-01-07",
    );
    await expect(page.getByTestId("activity-average")).toHaveText("25 min");
    await page.getByLabel("Data final", { exact: true }).fill("2031-04-01");
    await page
      .getByRole("button", { name: "Aplicar período", exact: true })
      .click();
    await expect(page.locator("canvas[data-chart-kind=line]")).toHaveCount(1);
    await page.goBack();
    await expect(page.getByLabel("Data final", { exact: true })).toHaveValue(
      "2031-01-07",
    );
    await expect(page.locator("canvas[data-chart-kind=bar]")).toHaveCount(1);
    expect(errors).toEqual([]);
    expect(
      requests.filter((url) =>
        /admin|clinica|agenda|fila|atendimentos|pacientes/.test(url),
      ),
    ).toEqual([]);
  });

test("minha atividade: vazio parcial, média nula, zero registrado e ausência de valor", async ({
  page,
}) => {
  let mode = "empty";
  await page.route("**/api/medico/indicadores?*", (route) => {
    const q = new URL(route.request().url()).searchParams,
      value = report(q, true);
    if (mode === "scheduled-only")
      value.consultasPorDataAgendada = report(q).consultasPorDataAgendada;
    if (mode === "completed-only")
      value.finalizacoesPorDataReal = report(q).finalizacoesPorDataReal;
    if (mode === "zero")
      value.finalizacoesPorDataReal = {
        totalFinalizadas: 1,
        duracaoMediaSegundos: 0,
        porDia: [
          {
            data: q.get("inicio")!,
            totalFinalizadas: 1,
            duracaoMediaSegundos: 0,
          },
        ],
      };
    if (mode === "null-positive")
      value.finalizacoesPorDataReal = {
        totalFinalizadas: 1,
        duracaoMediaSegundos: null,
        porDia: [
          {
            data: q.get("inicio")!,
            totalFinalizadas: 1,
            duracaoMediaSegundos: null,
          },
        ],
      };
    if (mode === "invalid")
      return route.fulfill({
        json: {
          ...value,
          finalizacoesPorDataReal: { totalFinalizadas: 1, porDia: [] },
        },
      });
    return route.fulfill({ json: value });
  });
  await login(page);
  await expect(
    page.getByRole("heading", {
      name: "Nenhuma atividade registrada neste recorte",
    }),
  ).toBeVisible();
  await expect(page.getByTestId("activity-average")).toHaveText("Sem dados");
  await expect(page.locator("canvas")).toHaveCount(0);
  for (const [next, total, completed, average] of [
    ["scheduled-only", "9", "0", "Sem dados"],
    ["completed-only", "0", "4", "25 min"],
    ["zero", "0", "1", "0 s"],
    ["null-positive", "0", "1", "Sem dados"],
  ]) {
    mode = next;
    await page.getByRole("button", { name: "Atualizar", exact: true }).click();
    await expect(page.getByTestId("activity-scheduled")).toHaveText(total);
    await expect(page.getByTestId("activity-completed")).toHaveText(completed);
    await expect(page.getByTestId("activity-average")).toHaveText(average);
    await accessible(page);
  }
  mode = "invalid";
  await page.getByRole("button", { name: "Atualizar", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Não foi possível carregar sua atividade",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("activity-average")).toHaveCount(0);
});

test("minha atividade: URL inválida e erros por campo sem consultar recorte inválido", async ({
  page,
}) => {
  let reads = 0;
  await page.route("**/api/medico/indicadores?*", (route) => {
    reads++;
    return route.fulfill({
      json: report(new URL(route.request().url()).searchParams),
    });
  });
  await login(page, path + "?inicio=2031-01-02&fim=2031-01-01&medicoId=outro");
  await expect(
    page.getByRole("heading", { name: "Revise o período do endereço" }),
  ).toBeVisible();
  expect(reads).toBe(0);
  await page
    .getByRole("button", { name: "Aplicar período", exact: true })
    .click();
  await expect(page.getByLabel("Data final", { exact: true })).toBeFocused();
  await expect(page.locator("#activity-end-error")).toContainText("posterior");
  await expect(page.getByLabel("Data final", { exact: true })).toHaveAttribute(
    "aria-describedby",
    "activity-end-error",
  );
  await page.getByLabel("Data final", { exact: true }).fill("2032-01-03");
  await page
    .getByRole("button", { name: "Aplicar período", exact: true })
    .click();
  await expect(page.locator("#activity-end-error")).toContainText("366");
  expect(reads).toBe(0);
  await page
    .getByRole("button", { name: "Restaurar últimos 7 dias", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Aplicar período", exact: true })
    .click();
  await expect(page.getByTestId("activity-scheduled")).toHaveText("9");
  expect(reads).toBe(1);
  expect(new URL(page.url()).searchParams.has("medicoId")).toBe(false);
});

test("minha atividade: rede, 403/404, contexto e recuperação", async ({
  page,
}) => {
  let contextFailed = true,
    mode = "success",
    reads = 0;
  await page.route("**/api/me", (route) =>
    contextFailed
      ? route.fulfill({ status: 503, json: { code: "ERRO_INTERNO" } })
      : route.continue(),
  );
  await page.route("**/api/medico/indicadores?*", (route) => {
    reads++;
    if (mode === "network") return route.abort();
    if (["403", "404", "503"].includes(mode))
      return route.fulfill({ status: Number(mode), json: { code: "ERRO" } });
    return route.fulfill({
      json: report(new URL(route.request().url()).searchParams),
    });
  });
  await login(page);
  await expect(
    page.getByRole("heading", {
      name: "Não foi possível carregar seu contexto",
    }),
  ).toBeVisible();
  expect(reads).toBe(0);
  contextFailed = false;
  await page
    .getByRole("button", { name: "Tentar carregar o contexto novamente" })
    .click();
  await expect(page.getByTestId("activity-average")).toHaveText("25 min");
  for (const [next, title] of [
    ["network", "Não foi possível carregar sua atividade"],
    ["503", "Não foi possível carregar sua atividade"],
    ["403", "Acesso à atividade não permitido"],
    ["404", "Contexto da atividade indisponível"],
  ]) {
    mode = next;
    await page.getByRole("button", { name: "Atualizar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("activity-scheduled")).toHaveCount(0);
    await accessible(page);
  }
  mode = "success";
  await page
    .getByRole("button", { name: "Recarregar identidade", exact: true })
    .click();
  await expect(page.getByTestId("activity-average")).toHaveText("25 min");
});

test("minha atividade: resposta antiga não vence recorte novo e loading não mostra números antigos", async ({
  page,
}) => {
  let pending = false,
    finished = false,
    release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/medico/indicadores?*", async (route) => {
    if (pending) {
      pending = false;
      await gate;
      try {
        await route.fulfill({
          json: report(new URL(route.request().url()).searchParams, true),
        });
      } catch {}
      finished = true;
      return;
    }
    return route.fulfill({
      json: report(new URL(route.request().url()).searchParams),
    });
  });
  await login(page);
  await expect(page.getByTestId("activity-scheduled")).toHaveText("9");
  pending = true;
  await page.getByRole("button", { name: "Atualizar", exact: true }).click();
  await expect(
    page.getByText("Carregando sua atividade", { exact: true }),
  ).toHaveCount(1);
  await expect(page.getByTestId("activity-scheduled")).toHaveCount(0);
  await page.getByLabel("Período", { exact: true }).selectOption("1");
  await page
    .getByRole("button", { name: "Aplicar período", exact: true })
    .click();
  await expect(page.getByTestId("activity-average")).toHaveText("25 min");
  release();
  await expect.poll(() => finished).toBe(true);
  await expect(page.getByTestId("activity-scheduled")).toHaveText("9");
});

test("minha atividade: todos os dias acessíveis, fallback gráfico e movimento reduzido em 320 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.route("**/api/medico/indicadores?*", (route) => {
    const value = report(new URL(route.request().url()).searchParams);
    value.finalizacoesPorDataReal = {
      totalFinalizadas: 20,
      duracaoMediaSegundos: 60.5,
      porDia: Array.from({ length: 20 }, (_, i) => ({
        data: `2031-01-${String(i + 1).padStart(2, "0")}`,
        totalFinalizadas: 1,
        duracaoMediaSegundos: 60.5,
      })),
    };
    return route.fulfill({ json: value });
  });
  await login(page, path + "?inicio=2031-01-01&fim=2031-01-31");
  await expect(page.getByTestId("activity-average")).toHaveText("1 min 1 s");
  await expect(page.locator("#doctor-scheduled-table")).toBeVisible();
  await expect(
    page.getByText("O gráfico não pôde ser desenhado.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("#doctor-completed-days tbody tr")).toHaveCount(14);
  await page
    .getByRole("button", { name: "Ver todos os dias (20)", exact: true })
    .click();
  await expect(page.locator("#doctor-completed-days tbody tr")).toHaveCount(20);
  await expect(
    page.getByRole("button", { name: "Mostrar menos dias (20)", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await accessible(page);
  expect(
    await page
      .locator(".activity-page")
      .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
  ).toBeLessThan(0.01);
});
