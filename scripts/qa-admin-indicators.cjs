// Integrated QA64: isolated synthetic records, real API, real Keycloak, deterministic assertions.
const path = require("node:path");
process.chdir(path.resolve(__dirname, ".."));
const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const { chromium } = require("playwright");
const { expect } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");
const sql = (query) =>
  execFileSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "medflow",
      "-d",
      "medflow",
      "-c",
      query,
    ],
    { encoding: "utf8" },
  );
const ids = {
  patient: randomUUID(),
  units: [randomUUID(), randomUUID()],
  rooms: [randomUUID(), randomUUID()],
  specialties: [randomUUID(), randomUUID()],
  appointments: Array.from({ length: 9 }, () => randomUUID()),
  care: Array.from({ length: 4 }, () => randomUUID()),
};
const list = (values) => values.map((value) => `'${value}'`).join(",");
const clinic = "00000000-0000-0000-0000-000000000001",
  doctor = "30000000-0000-0000-0000-000000000004";
const folder = "docs/qa/ui64";
const marker = "CONTEUDO_CLINICO_RESTRITO_QA64";
let seeded = false,
  browser;
async function login(page, user, target = "/workspace") {
  await page.goto("http://localhost:4200" + target);
  await page.waitForURL(/:8085/);
  await page.getByLabel(/username|usuário/i).fill(user);
  await page.locator("input[type=password]").fill(user);
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await page.waitForURL(/:4200/);
}
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
  const violations = (
    await new AxeBuilder({ page }).analyze()
  ).violations.filter((v) => ["serious", "critical"].includes(v.impact));
  expect(violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
(async () => {
  try {
    const statements = [
      `INSERT INTO paciente(id,clinica_id,nome,subject,version) VALUES('${ids.patient}','${clinic}','Paciente sintético QA64','qa64-${ids.patient}',0)`,
      ...ids.units.map(
        (id, i) =>
          `INSERT INTO unidade(id,clinica_id,nome,endereco,ativo,version) VALUES('${id}','${clinic}','Unidade QA64 ${i ? "Histórica" : "Centro"}','Endereço sintético',${!i},0)`,
      ),
      ...ids.rooms.map(
        (id, i) =>
          `INSERT INTO consultorio(id,unidade_id,nome,ativo,version) VALUES('${id}','${ids.units[i]}','Consultório sintético QA64',true,0)`,
      ),
      ...ids.specialties.map(
        (id, i) =>
          `INSERT INTO especialidade(id,clinica_id,nome,ativo,version) VALUES('${id}','${clinic}','Especialidade QA64 ${i ? "B" : "A"}',true,0)`,
      ),
    ];
    const rows = [
      ["2031-02-01", "AGENDADA", 0, 0],
      ["2031-02-02", "EM_ESPERA", 1, 0],
      ["2031-02-03", "EM_ATENDIMENTO", 0, 1],
      ["2031-02-04", "FINALIZADA", 0, 0],
      ["2031-02-05", "CANCELADA", 1, 1],
      ["2031-02-06", "AGENDADA", 1, 0],
      ["2031-02-07", "FINALIZADA", 0, 1],
      ["2031-01-31", "FINALIZADA", 1, 0],
      ["2031-01-30", "FINALIZADA", 1, 1],
    ];
    rows.forEach(([day, status, unit, specialty], i) =>
      statements.push(
        `INSERT INTO agendamento(id,clinica_id,paciente_id,medico_id,especialidade_id,consultorio_id,inicio,fim,status,version) VALUES('${ids.appointments[i]}','${clinic}','${ids.patient}','${doctor}','${ids.specialties[specialty]}','${ids.rooms[unit]}','${day}T23:30:00-03:00','${day}T23:59:00-03:00','${status}',0)`,
      ),
    );
    const careDates = [
      [3, "2031-02-04", "2031-02-05"],
      [6, "2031-02-07", "2031-02-08"],
      [7, "2031-01-31", "2031-02-01"],
      [8, "2031-01-30", "2031-02-02"],
    ];
    careDates.forEach(([index, start, end], i) =>
      statements.push(
        `INSERT INTO atendimento(id,agendamento_id,iniciado_em,finalizado_em,queixa_principal,version) VALUES('${ids.care[i]}','${ids.appointments[index]}','${start}T23:50:00-03:00','${end}T00:20:00-03:00','${marker}',0)`,
      ),
    );
    sql(`BEGIN;${statements.join(";")};COMMIT;`);
    seeded = true;
    mkdirSync(folder, { recursive: true });
    browser = await chromium.launch();
    const mainContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      locale: "pt-BR",
      timezoneId: "America/Los_Angeles",
    });
    const page = await mainContext.newPage();
    const errors = [],
      forbidden = [];
    let authorization;
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("request", (r) => {
      if (r.url().includes("/api/")) {
        authorization = r.headers().authorization || authorization;
        if (
          /\/api\/(agendamentos|atendimentos|pacientes|medico\/pacientes)/.test(
            r.url(),
          )
        )
          forbidden.push(new URL(r.url()).pathname);
      }
    });
    const target =
      "/workspace/admin/indicadores?inicio=2031-02-01&fim=2031-02-07";
    const initial = page.waitForResponse(
      (r) => r.url().includes("/api/admin/indicadores?") && r.status() === 200,
    );
    await login(page, "administrador", target);
    const first = await (await initial).json();
    expect(first.consultasPorDataAgendada.totalConsultas).toBe(7);
    expect(first.consultasPorDataAgendada.finalizadas).toBe(2);
    expect(first.finalizacoesPorDataReal.totalFinalizadas).toBe(3);
    expect(JSON.stringify(first)).not.toContain(marker);
    expect(JSON.stringify(first)).not.toMatch(
      /paciente|queixa|anamnese|conduta|observacoes|atendimentoId/,
    );
    await expect(page.getByTestId("scheduled-total")).toHaveText("7");
    await expect(page.getByTestId("scheduled-finalized")).toHaveText("2");
    await expect(page.getByTestId("completed-total")).toHaveText("3");
    await expect(page.locator("body")).not.toContainText(marker);
    await expect(page.locator("canvas")).toHaveCount(2);
    await settle(page);
    await page.screenshot({
      path: `${folder}/real-desktop.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 768, height: 1024 });
    await settle(page);
    await page.screenshot({
      path: `${folder}/real-tablet.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByRole("button", {
        name: "Ver dados: Consultas por dia",
        exact: true,
      })
      .click();
    await expect(page.locator("#scheduled-table tbody tr")).toHaveCount(7);
    await page
      .getByRole("button", {
        name: "Ver dados: Conclusões por dia",
        exact: true,
      })
      .click();
    await expect(page.locator("#completed-table tbody tr")).toHaveCount(3);
    await settle(page);
    await page.screenshot({
      path: `${folder}/real-tables-tablet.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByLabel("Unidade", { exact: true })
      .selectOption(ids.units[0]);
    await page
      .getByLabel("Especialidade", { exact: true })
      .selectOption(ids.specialties[0]);
    await expect(page.getByTestId("scheduled-total")).toHaveText("7");
    let next = page.waitForResponse(
      (r) =>
        r.url().includes("/api/admin/indicadores?") &&
        r.url().includes(ids.units[0]) &&
        r.status() === 200,
    );
    await page
      .getByRole("button", { name: "Aplicar filtros", exact: true })
      .click();
    const filtered = await (await next).json();
    expect(filtered.consultasPorDataAgendada.totalConsultas).toBe(2);
    expect(filtered.finalizacoesPorDataReal.totalFinalizadas).toBe(1);
    await expect(page.getByTestId("scheduled-total")).toHaveText("2");
    await expect(page.getByTestId("completed-total")).toHaveText("1");
    await page.reload();
    await expect(page.getByTestId("scheduled-total")).toHaveText("2");
    await expect(page.getByLabel("Unidade", { exact: true })).toHaveValue(
      ids.units[0],
    );
    await settle(page);
    await page.screenshot({
      path: `${folder}/real-filtered-tablet.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByLabel("Unidade", { exact: true })
      .selectOption(ids.units[1]);
    await page
      .getByRole("button", { name: "Aplicar filtros", exact: true })
      .click();
    await expect(page.getByTestId("scheduled-total")).toHaveText("2");
    await expect(page.locator(".applied-context")).toContainText(
      "Histórica (inativa)",
    );
    await page.reload();
    await expect(page.getByLabel("Unidade", { exact: true })).toHaveValue(
      ids.units[1],
    );
    await page.getByLabel("Período", { exact: true }).selectOption("custom");
    await page.getByLabel("Data inicial", { exact: true }).fill("2031-03-01");
    await page.getByLabel("Data final", { exact: true }).fill("2031-03-07");
    await page
      .getByRole("button", { name: "Aplicar filtros", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Nenhuma consulta ou conclusão neste recorte",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("scheduled-total")).toHaveText("0");
    await expect(page.locator("canvas")).toHaveCount(0);
    await settle(page);
    await page.screenshot({
      path: `${folder}/real-empty-tablet.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(forbidden).toEqual([]);
    expect(errors).toEqual([]);
    writeFileSync(
      `${folder}/integrated-results.json`,
      JSON.stringify(
        {
          period: {
            inicio: first.inicio,
            fim: first.fim,
            timeZone: first.timeZone,
          },
          scheduled: first.consultasPorDataAgendada,
          completed: first.finalizacoesPorDataReal,
          filtered: {
            scheduled: filtered.consultasPorDataAgendada.totalConsultas,
            completed: filtered.finalizacoesPorDataReal.totalFinalizadas,
          },
          consoleErrors: errors,
          clinicalRequests: forbidden,
        },
        null,
        2,
      ) + "\n",
    );
    await page.close();
    for (const user of ["paciente", "recepcionista", "medico"]) {
      const context = await browser.newContext();
      const negative = await context.newPage();
      let bearer;
      negative.on("request", (r) => {
        if (r.url().includes("/api/"))
          bearer = r.headers().authorization || bearer;
      });
      await login(negative, user);
      await expect.poll(() => !!bearer).toBe(true);
      const response = await negative.request.get(
        "http://localhost:4200/api/admin/indicadores?inicio=2031-02-01&fim=2031-02-07",
        { headers: { Authorization: bearer } },
      );
      expect(response.status()).toBe(403);
      await negative.goto("http://localhost:4200" + target);
      await expect(negative).toHaveURL(/access-denied/);
      await expect(negative.getByTestId("scheduled-total")).toHaveCount(0);
      await context.close();
      console.log(`REAL ${user}: API 403 and route denied OK`);
    }
    console.log(
      "REAL independent populations, combined and inactive filters, persisted reload, empty, Axe and viewports: OK",
    );
  } finally {
    await browser?.close();
    if (seeded)
      sql(
        `BEGIN;DELETE FROM atendimento WHERE id IN (${list(ids.care)});DELETE FROM agendamento WHERE id IN (${list(ids.appointments)});DELETE FROM paciente WHERE id='${ids.patient}';DELETE FROM consultorio WHERE id IN (${list(ids.rooms)});DELETE FROM unidade WHERE id IN (${list(ids.units)});DELETE FROM especialidade WHERE id IN (${list(ids.specialties)});COMMIT;`,
      );
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
