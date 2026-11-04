// QA63: real scoped reads for two medical identities; only isolated synthetic records are inserted/deleted.
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
  unit: randomUUID(),
  rooms: [randomUUID(), randomUUID()],
  specialty: randomUUID(),
  appointments: Array.from({ length: 12 }, () => randomUUID()),
  care: Array.from({ length: 5 }, () => randomUUID()),
  doctor: randomUUID(),
};
const list = (values) => values.map((v) => `'${v}'`).join(",");
const clinic = "00000000-0000-0000-0000-000000000001",
  mainDoctor = "30000000-0000-0000-0000-000000000004",
  otherDoctor = ids.doctor;
const folder = "docs/qa/ui63",
  marker = "CONTEUDO_CLINICO_RESTRITO_QA63",
  target = "/workspace/doctor/indicadores?inicio=2031-05-01&fim=2031-05-07";
const temporaryUser = `qa63-medico-${randomUUID()}`,
  temporaryPassword = randomUUID();
let seeded = false,
  browser,
  temporaryUserId;
async function adminRequest(resource, options = {}) {
  const response = await fetch(
    "http://localhost:8085/realms/master/protocol/openid-connect/token",
    {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "admin-cli",
        username: "admin",
        password: "admin",
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      `Local QA admin authentication failed (${response.status})`,
    );
  const token = (await response.json()).access_token;
  return fetch(`http://localhost:8085/admin/realms/medflow/${resource}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}
async function provisionTemporaryDoctor() {
  const created = await adminRequest("users", {
    method: "POST",
    body: JSON.stringify({
      username: temporaryUser,
      enabled: true,
      emailVerified: true,
      firstName: "Médico",
      lastName: "sintético QA63",
      email: `${temporaryUser}@medflow.local`,
      credentials: [
        { type: "password", value: temporaryPassword, temporary: false },
      ],
    }),
  });
  if (created.status !== 201)
    throw new Error(
      `Temporary QA identity creation failed (${created.status})`,
    );
  temporaryUserId = created.headers.get("location").split("/").pop();
  const clients = await (
    await adminRequest("clients?clientId=medflow-api")
  ).json();
  const client = clients.find((value) => value.clientId === "medflow-api");
  if (!client) throw new Error("Local API client not found");
  const role = await (
    await adminRequest(`clients/${client.id}/roles/DOCTOR`)
  ).json();
  const mapped = await adminRequest(
    `users/${temporaryUserId}/role-mappings/clients/${client.id}`,
    { method: "POST", body: JSON.stringify([role]) },
  );
  if (mapped.status !== 204)
    throw new Error(`Temporary QA role mapping failed (${mapped.status})`);
}
async function login(
  page,
  user,
  url = target,
  password = user.startsWith("medico") ? "medico" : user,
) {
  await page.goto("http://localhost:4200" + url);
  await page.waitForURL(/:8085/);
  await page.getByLabel(/username|usuário/i).fill(user);
  await page.locator("input[type=password]").fill(password);
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
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
      ["serious", "critical"].includes(v.impact),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function screenshot(page, name) {
  await settle(page);
  await page.screenshot({
    path: `${folder}/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
}
function noClinical(report) {
  expect(JSON.stringify(report)).not.toContain(marker);
  expect(JSON.stringify(report)).not.toMatch(
    /paciente|queixa|anamnese|conduta|observacoes|atendimentoId|medicoId/,
  );
}
(async () => {
  try {
    await provisionTemporaryDoctor();
    const statements = [
      `INSERT INTO paciente(id,clinica_id,nome,subject,version) VALUES('${ids.patient}','${clinic}','Paciente sintético QA63','qa63-${ids.patient}',0)`,
      `INSERT INTO unidade(id,clinica_id,nome,endereco,ativo,version) VALUES('${ids.unit}','${clinic}','Unidade sintética QA63','Endereço sintético',true,0)`,
      ...ids.rooms.map(
        (id, i) =>
          `INSERT INTO consultorio(id,unidade_id,nome,ativo,version) VALUES('${id}','${ids.unit}','Consultório QA63 ${i}',true,0)`,
      ),
      `INSERT INTO especialidade(id,clinica_id,nome,ativo,version) VALUES('${ids.specialty}','${clinic}','Especialidade sintética QA63',true,0)`,
      `INSERT INTO medico(id,clinica_id,nome,crm_numero,crm_uf,subject,ativo,version) VALUES('${otherDoctor}','${clinic}','Médico sintético QA63','QA63${otherDoctor.slice(0, 8)}','PA','${temporaryUserId}',true,0)`,
    ];
    const rows = [
      ["2031-05-01", "AGENDADA", 0],
      ["2031-05-02", "EM_ESPERA", 0],
      ["2031-05-03", "EM_ATENDIMENTO", 0],
      ["2031-05-04", "FINALIZADA", 0],
      ["2031-05-05", "CANCELADA", 0],
      ["2031-05-06", "AGENDADA", 0],
      ["2031-05-07", "FINALIZADA", 0],
      ["2031-04-30", "FINALIZADA", 0],
      ["2031-04-29", "FINALIZADA", 0],
      ["2031-05-01", "FINALIZADA", 1],
      ["2031-05-02", "AGENDADA", 1],
      ["2031-05-03", "CANCELADA", 1],
    ];
    rows.forEach(([day, status, doctor], i) =>
      statements.push(
        `INSERT INTO agendamento(id,clinica_id,paciente_id,medico_id,especialidade_id,consultorio_id,inicio,fim,status,version) VALUES('${ids.appointments[i]}','${clinic}','${ids.patient}','${doctor ? otherDoctor : mainDoctor}','${ids.specialty}','${ids.rooms[doctor]}','${day}T23:30:00-03:00','${day}T23:59:00-03:00','${status}',0)`,
      ),
    );
    const careDates = [
      [3, "2031-05-04T23:50:00-03:00", "2031-05-05T00:40:00-03:00"],
      [6, "2031-05-07T23:50:00-03:00", "2031-05-08T00:30:00-03:00"],
      [7, "2031-04-30T23:55:00-03:00", "2031-05-01T00:05:00-03:00"],
      [8, "2031-05-01T10:00:00-03:00", "2031-05-01T10:30:00-03:00"],
      [9, "2031-05-01T23:45:00-03:00", "2031-05-01T23:55:00-03:00"],
    ];
    careDates.forEach(([index, start, end], i) =>
      statements.push(
        `INSERT INTO atendimento(id,agendamento_id,iniciado_em,finalizado_em,queixa_principal,version) VALUES('${ids.care[i]}','${ids.appointments[index]}','${start}','${end}','${marker}',0)`,
      ),
    );
    sql(`BEGIN;${statements.join(";")};COMMIT;`);
    seeded = true;
    mkdirSync(folder, { recursive: true });
    browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        locale: "pt-BR",
        timezoneId: "America/Los_Angeles",
      }),
      page = await context.newPage();
    const errors = [],
      forbidden = [];
    let bearer;
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("request", (r) => {
      if (r.url().includes("/api/")) {
        bearer = r.headers().authorization || bearer;
        if (
          /\/api\/(admin|clinica|unidades|medico\/agenda|medico\/fila|atendimentos|agendamentos|medico\/pacientes)/.test(
            r.url(),
          )
        )
          forbidden.push(new URL(r.url()).pathname);
      }
    });
    const [, initial] = await Promise.all([
      login(page, "medico"),
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/medico/indicadores?") && r.status() === 200,
      ),
    ]);
    const first = await initial.json();
    noClinical(first);
    expect(first.consultasPorDataAgendada.totalConsultas).toBe(7);
    expect(first.consultasPorDataAgendada.finalizadas).toBe(2);
    expect(first.finalizacoesPorDataReal.totalFinalizadas).toBe(3);
    expect(first.finalizacoesPorDataReal.duracaoMediaSegundos).toBe(1800);
    expect(
      first.finalizacoesPorDataReal.porDia.map((d) => d.duracaoMediaSegundos),
    ).toEqual([1200, 3000]);
    await expect(page.getByTestId("activity-scheduled")).toHaveText("7");
    await expect(page.getByTestId("activity-state-done")).toHaveText("2");
    await expect(page.getByTestId("activity-completed")).toHaveText("3");
    await expect(page.getByTestId("activity-average")).toHaveText("30 min");
    await expect(page.locator("body")).not.toContainText(marker);
    await screenshot(page, "real-desktop");
    await page.setViewportSize({ width: 768, height: 1024 });
    await screenshot(page, "real-tablet");
    await page
      .getByRole("button", {
        name: "Ver dados: Consultas por dia",
        exact: true,
      })
      .click();
    await expect(page.locator("#doctor-scheduled-table tbody tr")).toHaveCount(
      7,
    );
    await expect(page.locator("#doctor-scheduled-table thead th")).toHaveCount(
      7,
    );
    await screenshot(page, "real-details-tablet");
    const cross = await page.request.get(
      `http://localhost:4200/api/medico/indicadores?inicio=2031-05-01&fim=2031-05-07&medicoId=${otherDoctor}`,
      { headers: { Authorization: bearer } },
    );
    expect(cross.status()).toBe(200);
    expect((await cross.json()).consultasPorDataAgendada.totalConsultas).toBe(
      7,
    );
    async function period(inicio, fim) {
      await page.getByLabel("Período", { exact: true }).selectOption("custom");
      await page.getByLabel("Data inicial", { exact: true }).fill(inicio);
      await page.getByLabel("Data final", { exact: true }).fill(fim);
      const next = page.waitForResponse(
        (r) =>
          r.url().includes("/api/medico/indicadores?") &&
          r.url().includes(`inicio=${inicio}`) &&
          r.url().includes(`fim=${fim}`) &&
          r.status() === 200,
      );
      await page
        .getByRole("button", { name: "Aplicar período", exact: true })
        .click();
      return (await next).json();
    }
    const one = await period("2031-05-01", "2031-05-01");
    expect(one.consultasPorDataAgendada.totalConsultas).toBe(1);
    expect(one.finalizacoesPorDataReal.totalFinalizadas).toBe(2);
    expect(one.finalizacoesPorDataReal.duracaoMediaSegundos).toBe(1200);
    await expect(page.getByTestId("activity-average")).toHaveText("20 min");
    await expect(page.locator("canvas")).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel("Data final", { exact: true })).toHaveValue(
      "2031-05-01",
    );
    await expect(page.getByTestId("activity-average")).toHaveText("20 min");
    await screenshot(page, "real-one-day-tablet");
    await period("2031-05-02", "2031-05-02");
    await expect(page.getByTestId("activity-scheduled")).toHaveText("1");
    await expect(page.getByTestId("activity-completed")).toHaveText("0");
    await expect(page.getByTestId("activity-average")).toHaveText("Sem dados");
    await screenshot(page, "real-no-completions-tablet");
    await period("2031-06-01", "2031-06-07");
    await expect(
      page.getByRole("heading", {
        name: "Nenhuma atividade registrada neste recorte",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("activity-scheduled")).toHaveText("0");
    await expect(page.getByTestId("activity-average")).toHaveText("Sem dados");
    await expect(page.locator("canvas")).toHaveCount(0);
    await screenshot(page, "real-empty-tablet");
    expect(errors).toEqual([]);
    expect(forbidden).toEqual([]);
    const otherContext = await browser.newContext({
        viewport: { width: 768, height: 1024 },
        locale: "pt-BR",
      }),
      other = await otherContext.newPage();
    let otherBearer;
    other.on("request", (r) => {
      if (r.url().includes("/api/"))
        otherBearer = r.headers().authorization || otherBearer;
    });
    const [, otherRead] = await Promise.all([
      login(other, temporaryUser, target, temporaryPassword),
      other.waitForResponse(
        (r) =>
          r.url().includes("/api/medico/indicadores?") && r.status() === 200,
      ),
    ]);
    const second = await otherRead.json();
    noClinical(second);
    expect(second.consultasPorDataAgendada.totalConsultas).toBe(3);
    expect(second.finalizacoesPorDataReal.totalFinalizadas).toBe(1);
    expect(second.finalizacoesPorDataReal.duracaoMediaSegundos).toBe(600);
    await expect(other.getByTestId("activity-scheduled")).toHaveText("3");
    await expect(other.getByTestId("activity-average")).toHaveText("10 min");
    await screenshot(other, "real-second-doctor-tablet");
    const otherCross = await other.request.get(
      `http://localhost:4200/api/medico/indicadores?inicio=2031-05-01&fim=2031-05-07&medicoId=${mainDoctor}`,
      { headers: { Authorization: otherBearer } },
    );
    expect(
      (await otherCross.json()).consultasPorDataAgendada.totalConsultas,
    ).toBe(3);
    await otherContext.close();
    const negatives = [];
    for (const user of ["paciente", "recepcionista", "administrador"]) {
      const deniedContext = await browser.newContext(),
        denied = await deniedContext.newPage();
      let token;
      denied.on("request", (r) => {
        if (r.url().includes("/api/"))
          token = r.headers().authorization || token;
      });
      await login(denied, user, "/workspace");
      await expect.poll(() => !!token).toBe(true);
      const response = await denied.request.get(
        "http://localhost:4200/api/medico/indicadores?inicio=2031-05-01&fim=2031-05-07",
        { headers: { Authorization: token } },
      );
      expect(response.status()).toBe(403);
      await denied.goto("http://localhost:4200" + target);
      await expect(denied).toHaveURL(/access-denied/);
      await expect(denied.getByTestId("activity-scheduled")).toHaveCount(0);
      negatives.push({ profile: user, apiStatus: 403, routeDenied: true });
      await deniedContext.close();
      console.log(`REAL ${user}: 403 and route denied OK`);
    }
    writeFileSync(
      `${folder}/integrated-results.json`,
      JSON.stringify(
        {
          period: {
            inicio: first.inicio,
            fim: first.fim,
            timeZone: first.timeZone,
          },
          main: first,
          secondDoctor: second,
          oneDay: one,
          negatives,
          otherDoctorParameterIgnored: true,
          consoleErrors: errors,
          forbiddenRequests: forbidden,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "REAL independent populations, weighted duration, date boundaries, reload, partial/empty, two doctors and negative profiles: OK",
    );
  } finally {
    await browser?.close();
    try {
      if (seeded)
        sql(
          `BEGIN;DELETE FROM atendimento WHERE id IN (${list(ids.care)});DELETE FROM agendamento WHERE id IN (${list(ids.appointments)});DELETE FROM paciente WHERE id='${ids.patient}';DELETE FROM consultorio WHERE id IN (${list(ids.rooms)});DELETE FROM unidade WHERE id='${ids.unit}';DELETE FROM especialidade WHERE id='${ids.specialty}';DELETE FROM medico WHERE id='${otherDoctor}';COMMIT;`,
        );
    } finally {
      if (temporaryUserId) {
        const removed = await adminRequest(`users/${temporaryUserId}`, {
          method: "DELETE",
        });
        if (![204, 404].includes(removed.status))
          throw new Error(
            `Temporary QA identity cleanup failed (${removed.status})`,
          );
      }
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
