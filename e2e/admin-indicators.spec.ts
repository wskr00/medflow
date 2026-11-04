import { test, expect, Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
const unitA = {
  id: "64000000-0000-0000-0000-000000000001",
  nome: "Unidade sintética Centro",
  ativo: true,
};
const unitB = {
  id: "64000000-0000-0000-0000-000000000002",
  nome: "Unidade sintética histórica",
  ativo: false,
};
const specialty = {
  id: "64000000-0000-0000-0000-000000000003",
  nome: "Especialidade sintética",
  ativo: true,
};
const path = "/workspace/admin/indicadores";
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
                agendadas: 4,
                emEspera: 0,
                finalizadas: 0,
                canceladas: 0,
              },
              { data: fim, ...states, totalConsultas: 5, agendadas: 0 },
            ],
      porUnidade: empty ? [] : [{ ...unitB, ...states }],
      porEspecialidade: empty ? [] : [{ ...specialty, ...states }],
    },
    finalizacoesPorDataReal: {
      totalFinalizadas: empty ? 0 : 5,
      porDia: empty
        ? []
        : inicio === fim
          ? [{ data: inicio, totalFinalizadas: 5 }]
          : [
              { data: inicio, totalFinalizadas: 2 },
              { data: fim, totalFinalizadas: 3 },
            ],
      porUnidade: empty ? [] : [{ ...unitB, totalFinalizadas: 5 }],
      porEspecialidade: empty ? [] : [{ ...specialty, totalFinalizadas: 5 }],
    },
  };
}
async function login(page: Page, target = path, user = "administrador") {
  await page.goto(target);
  await page.waitForURL(/:8085/);
  await page.getByLabel(/username|usuário/i).fill(user);
  await page.locator("input[type=password]").fill(user);
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await page.waitForURL(/:4200/);
}
async function catalogs(page: Page) {
  await page.route("**/api/unidades?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get("incluirInativas")).toBe("true");
    return route.fulfill({
      json: {
        items: [params.get("page") === "0" ? unitA : unitB],
        page: Number(params.get("page")),
        size: 1,
        totalElements: 2,
      },
    });
  });
  await page.route("**/api/especialidades?*", (route) =>
    route.fulfill({
      json: { items: [specialty], page: 0, size: 100, totalElements: 1 },
    }),
  );
  await page.route(`**/api/unidades/${unitB.id}`, (route) =>
    route.fulfill({ json: unitB }),
  );
  await page.route(`**/api/especialidades/${specialty.id}`, (route) =>
    route.fulfill({ json: specialty }),
  );
}
async function accessible(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((value) =>
      ["serious", "critical"].includes(value.impact ?? ""),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
for (const width of [1366, 768])
  test(`indicadores ${width}: filtros aplicados, tabelas, gráficos e teclado`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1024 });
    const errors: string[] = [],
      requests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      if (request.url().includes("/api/"))
        requests.push(new URL(request.url()).pathname);
    });
    await catalogs(page);
    const reads: string[] = [];
    await page.route("**/api/admin/indicadores?*", (route) => {
      reads.push(route.request().url());
      return route.fulfill({
        json: report(new URL(route.request().url()).searchParams),
      });
    });
    await login(page);
    await expect(page.getByTestId("scheduled-total")).toHaveText("9");
    await expect(page.getByTestId("scheduled-finalized")).toHaveText("3");
    await expect(page.getByTestId("completed-total")).toHaveText("5");
    await expect(page.locator("nav a")).toHaveCount(7);
    await expect(page.locator("main")).toBeFocused();
    await expect(
      page.locator('#indicators-unidadeId option[value="' + unitB.id + '"]'),
    ).toContainText("(inativa)");
    const context = await page.locator(".applied-context").innerText(),
      before = reads.length;
    await page.getByLabel("Unidade", { exact: true }).selectOption(unitB.id);
    await page
      .getByLabel("Especialidade", { exact: true })
      .selectOption(specialty.id);
    await page.getByLabel("Período", { exact: true }).selectOption("custom");
    await page.getByLabel("Data inicial", { exact: true }).fill("2031-01-01");
    await page.getByLabel("Data final", { exact: true }).fill("2031-01-03");
    await expect(page.locator(".draft-notice")).toBeVisible();
    expect(await page.locator(".applied-context").innerText()).toBe(context);
    expect(reads.length).toBe(before);
    await page
      .getByRole("button", { name: "Aplicar filtros", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      new RegExp(
        `inicio=2031-01-01.*fim=2031-01-03.*unidadeId=${unitB.id}.*especialidadeId=${specialty.id}`,
      ),
    );
    await expect(page.getByTestId("scheduled-total")).toHaveText("9");
    await expect(page.locator(".applied-context")).toContainText(
      "histórica (inativa)",
    );
    await expect(page.locator(".draft-notice")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Por data agendada", exact: true }),
    ).toBeVisible();
    await expect(page.locator("canvas[data-chart-kind=bar]")).toHaveCount(2);
    await page
      .getByRole("button", {
        name: "Ver dados: Consultas por dia",
        exact: true,
      })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#scheduled-table")).toBeVisible();
    await expect(page.locator("#scheduled-table tbody tr")).toHaveCount(2);
    await page
      .getByRole("button", {
        name: "Ver detalhamento: Por unidade",
        exact: true,
      })
      .click();
    await expect(page.locator("#units-detail")).toBeVisible();
    await accessible(page);
    await page.screenshot({
      path: info.outputPath(`indicadores-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page.reload();
    await expect(page.getByTestId("completed-total")).toHaveText("5");
    await expect(page.getByLabel("Unidade", { exact: true })).toHaveValue(
      unitB.id,
    );
    await page.getByLabel("Período", { exact: true }).selectOption("custom");
    await page.getByLabel("Data inicial", { exact: true }).fill("2031-01-01");
    await page.getByLabel("Data final", { exact: true }).fill("2031-04-01");
    await page
      .getByRole("button", { name: "Aplicar filtros", exact: true })
      .click();
    await expect(page.locator("canvas[data-chart-kind=line]")).toHaveCount(2);
    await page.goBack();
    await expect(page.getByLabel("Data final", { exact: true })).toHaveValue(
      "2031-01-03",
    );
    await expect(page.locator("canvas[data-chart-kind=bar]")).toHaveCount(2);
    await expect(
      page.getByText("O gráfico não pôde ser desenhado.", { exact: false }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(
      requests.filter((value) =>
        /agendamentos|atendimentos|pacientes/.test(value),
      ),
    ).toEqual([]);
  });

test("indicadores: vazio, séries independentes, rede, acesso negado e recuperação", async ({
  page,
}) => {
  await catalogs(page);
  let mode = "empty";
  await page.route("**/api/admin/indicadores?*", (route) => {
    if (mode === "network") return route.abort();
    if (["403", "404", "503"].includes(mode))
      return route.fulfill({ status: Number(mode), json: { code: "ERRO" } });
    const value = report(new URL(route.request().url()).searchParams, true);
    if (mode === "completed-only")
      value.finalizacoesPorDataReal = report(
        new URL(route.request().url()).searchParams,
      ).finalizacoesPorDataReal;
    return route.fulfill({ json: value });
  });
  await login(page);
  await expect(
    page.getByRole("heading", {
      name: "Nenhuma consulta ou conclusão neste recorte",
    }),
  ).toBeVisible();
  await expect(page.getByTestId("scheduled-total")).toHaveText("0");
  await expect(page.locator("canvas")).toHaveCount(0);
  mode = "completed-only";
  await page.getByRole("button", { name: "Atualizar", exact: true }).click();
  await expect(page.getByTestId("completed-total")).toHaveText("5");
  await expect(page.getByTestId("scheduled-total")).toHaveText("0");
  await expect(
    page.getByRole("heading", {
      name: "Nenhuma consulta ou conclusão neste recorte",
    }),
  ).toHaveCount(0);
  for (const [next, title] of [
    ["network", "Não foi possível carregar os indicadores"],
    ["503", "Não foi possível carregar os indicadores"],
    ["404", "Recorte indisponível"],
    ["403", "Acesso aos indicadores não permitido"],
  ]) {
    mode = next;
    await page.getByRole("button", { name: "Atualizar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("scheduled-total")).toHaveCount(0);
    await accessible(page);
  }
  await expect(
    page.getByRole("button", { name: "Entrar novamente", exact: true }),
  ).toBeVisible();
  mode = "empty";
  await page.getByRole("button", { name: "Atualizar", exact: true }).click();
  await expect(page.getByTestId("scheduled-total")).toHaveText("0");
});

test("indicadores: URL inválida, validação por campo e correção sem consulta inválida", async ({
  page,
}) => {
  await catalogs(page);
  let reads = 0;
  await page.route("**/api/admin/indicadores?*", (route) => {
    reads++;
    return route.fulfill({
      json: report(new URL(route.request().url()).searchParams),
    });
  });
  await login(page, path + "?inicio=2031-01-01&fim=2030-01-01");
  await expect(
    page.getByRole("heading", { name: "Revise os filtros do endereço" }),
  ).toBeVisible();
  expect(reads).toBe(0);
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await expect(page.getByLabel("Data final", { exact: true })).toBeFocused();
  await expect(page.locator("#indicators-end-error")).toContainText(
    "posterior",
  );
  await expect(page.getByLabel("Data final", { exact: true })).toHaveAttribute(
    "aria-describedby",
    "indicators-end-error",
  );
  await page.getByLabel("Data final", { exact: true }).fill("2032-01-02");
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await expect(page.locator("#indicators-end-error")).toContainText("366");
  expect(reads).toBe(0);
  await page
    .getByRole("button", { name: "Limpar filtros", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await expect(page.getByTestId("scheduled-total")).toHaveText("9");
  expect(reads).toBe(1);
});

test("indicadores: resposta antiga não sobrescreve novo recorte; loading não mostra números antigos", async ({
  page,
}) => {
  await catalogs(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let first = true,
    finished = false;
  await page.route("**/api/admin/indicadores?*", async (route) => {
    if (first) {
      first = false;
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
  await expect(
    page.getByText("Carregando indicadores", { exact: true }),
  ).toHaveCount(1);
  await expect(page.getByTestId("scheduled-total")).toHaveCount(0);
  await page.getByLabel("Período", { exact: true }).selectOption("1");
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await expect(page.getByTestId("scheduled-total")).toHaveText("9");
  release();
  await expect.poll(() => finished).toBe(true);
  await expect(page.getByTestId("scheduled-total")).toHaveText("9");
});

test("indicadores: movimento reduzido e navegação em janela estreita", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 760 });
  await catalogs(page);
  await page.route("**/api/admin/indicadores?*", (route) =>
    route.fulfill({
      json: report(new URL(route.request().url()).searchParams),
    }),
  );
  await login(page);
  await expect(page.getByTestId("scheduled-total")).toHaveText("9");
  await accessible(page);
  expect(
    await page
      .locator(".indicators-page")
      .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
  ).toBeLessThan(0.01);
});

test("indicadores: falha do catálogo não apaga o filtro; distribuição completa e ordenada", async ({
  page,
}) => {
  await catalogs(page);
  let failed = true;
  await page.route("**/api/unidades?*", (route) => {
    if (failed)
      return route.fulfill({ status: 503, json: { code: "ERRO_INTERNO" } });
    return route.fulfill({
      json: { items: [unitA, unitB], page: 0, size: 100, totalElements: 2 },
    });
  });
  await page.route("**/api/admin/indicadores?*", (route) => {
    const value = report(new URL(route.request().url()).searchParams);
    value.consultasPorDataAgendada.porUnidade = Array.from(
      { length: 7 },
      (_, i) => ({
        id: `64000000-0000-0000-0000-${String(i + 10).padStart(12, "0")}`,
        nome: `Unidade ${i + 1}`,
        ativo: true,
        totalConsultas: i < 2 ? 2 : 1,
        agendadas: i < 2 ? 2 : 0,
        emEspera: i === 2 ? 1 : 0,
        emAtendimento: 0,
        finalizadas: i >= 3 && i <= 5 ? 1 : 0,
        canceladas: i === 6 ? 1 : 0,
      }),
    );
    return route.fulfill({ json: value });
  });
  await login(
    page,
    `${path}?inicio=2031-01-01&fim=2031-01-07&unidadeId=${unitB.id}`,
  );
  await expect(page.getByTestId("scheduled-total")).toHaveText("9");
  await expect(page.getByLabel("Unidade", { exact: true })).toHaveValue(
    unitB.id,
  );
  await expect(page.locator(".applied-context")).toContainText(
    "histórica (inativa)",
  );
  failed = false;
  await page
    .getByRole("button", { name: "Tentar carregar os cadastros novamente" })
    .click();
  await expect(page.getByLabel("Unidade", { exact: true })).toHaveValue(
    unitB.id,
  );
  await expect(
    page.getByRole("option", {
      name: "Unidade sintética histórica (inativa)",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(page.locator("#units-rows tbody tr")).toHaveCount(6);
  const expand = page.getByRole("button", {
    name: "Ver todas as unidades",
    exact: true,
  });
  await expand.click();
  await expect(page.locator("#units-rows tbody tr")).toHaveCount(7);
  await expect(
    page.getByRole("button", { name: "Mostrar menos unidades", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await accessible(page);
});

test("indicadores: fallback de gráfico e resposta sem contagem não viram números inventados", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await catalogs(page);
  let invalid = false;
  await page.route("**/api/admin/indicadores?*", (route) => {
    const value = report(new URL(route.request().url()).searchParams);
    if (invalid)
      return route.fulfill({
        json: {
          ...value,
          consultasPorDataAgendada: {
            ...value.consultasPorDataAgendada,
            totalConsultas: null,
          },
        },
      });
    return route.fulfill({ json: value });
  });
  await login(page);
  await expect(page.getByTestId("scheduled-total")).toHaveText("9");
  await expect(page.locator("#scheduled-table")).toBeVisible();
  await expect(page.locator("#completed-table")).toBeVisible();
  await expect(
    page.getByText("O gráfico não pôde ser desenhado.", { exact: false }),
  ).toHaveCount(2);
  invalid = true;
  await page.getByRole("button", { name: "Atualizar", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Não foi possível carregar os indicadores",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("scheduled-total")).toHaveCount(0);
});
