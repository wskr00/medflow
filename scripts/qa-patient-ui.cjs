// Synthetic integrated smoke: patient booking, a real occupied slot, rescheduling and cancellation.
const path = require("node:path");
process.chdir(path.resolve(__dirname, ".."));
const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { chromium } = require("playwright");
const { expect } = require("@playwright/test");
const sql = (q) =>
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
      q,
    ],
    { encoding: "utf8" },
  );
(async () => {
  const rule = randomUUID(),
    otherPatient = randomUUID(),
    occupied = randomUUID();
  const created = new Set();
  let seeded = false,
    browser,
    page;
  try {
    sql(
      `BEGIN;INSERT INTO regra_agenda(id,clinica_id,medico_id,especialidade_id,consultorio_id,dia_semana,hora_inicio,hora_fim,duracao_minutos,vigente_de,vigente_ate,ativo,version) VALUES('${rule}','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004','31000000-0000-0000-0000-000000000021','31000000-0000-0000-0000-000000000011',EXTRACT(ISODOW FROM CURRENT_DATE+1),'20:00','22:00',30,CURRENT_DATE+1,CURRENT_DATE+1,true,0);INSERT INTO paciente(id,clinica_id,nome,subject,version) VALUES('${otherPatient}','00000000-0000-0000-0000-000000000001','Paciente sintético concorrente QA57','qa57-${otherPatient}',0);COMMIT;`,
    );
    seeded = true;
    browser = await chromium.launch();
    page = await browser.newPage({
      viewport: { width: 1366, height: 768 },
      locale: "pt-BR",
      timezoneId: "America/Belem",
    });
    page.on("response", async (response) => {
      if (
        response.url().includes("/api/disponibilidades?") &&
        response.status() >= 400
      ) {
        let code;
        try {
          code = (await response.json()).code;
        } catch {}
        console.error(
          "Availability failure",
          response.status(),
          new URL(response.url()).search,
          code,
        );
      }
      if (
        response.url().endsWith("/api/agendamentos") &&
        response.request().method() === "POST" &&
        response.status() === 201
      ) {
        const id = response.headers()["location"]?.split("/").pop();
        if (id && /^[0-9a-f-]{36}$/.test(id)) created.add(id);
      }
    });
    const capture = async (name) => {
      await page.evaluate(() => {
        scrollTo({ top: 0, behavior: "instant" });
        document.activeElement?.blur();
      });
      await page.screenshot({
        path: `docs/qa/ui57/${name}.png`,
        fullPage: true,
        animations: "disabled",
      });
    };
    await page.goto("http://localhost:4200/workspace/patient/agendar");
    await page.waitForURL(/:8085/);
    await page.getByLabel(/username|usuário/i).fill("paciente");
    await page.locator("input[type=password]").fill("paciente");
    await page.getByRole("button", { name: /sign in|entrar/i }).click();
    await page
      .locator("#specialty")
      .selectOption("31000000-0000-0000-0000-000000000021");
    await page
      .locator("#unit")
      .selectOption("31000000-0000-0000-0000-000000000001");
    await page
      .locator("#doctor")
      .selectOption("30000000-0000-0000-0000-000000000004");
    await page
      .getByRole("button", { name: "Escolher data e horário", exact: true })
      .click();
    const chooseTime = async (time) => {
      await page.locator("app-patient-slot-options").waitFor();
      const expand = page.getByRole("button", {
        name: "Ver mais horários",
        exact: true,
      });
      if (await expand.count()) await expand.click();
      await page
        .getByRole("button", { name: new RegExp(`${time}.*Camila`) })
        .click();
    };
    const tomorrow = async () => {
      const title = page.locator(
        "#booking-step-title, #reschedule-times-title",
      );
      if (await page.locator("#booking-step-title").count())
        await expect(title).toBeFocused();
      else await expect(page.locator("main")).toBeFocused();
      await page.locator('hlm-calendar button[aria-selected="true"]').focus();
      await page.keyboard.press("ArrowRight");
      const day = Number(
        sql("SELECT CURRENT_DATE+1")
          .match(/\d{4}-\d{2}-\d{2}/)[0]
          .slice(-2),
      );
      await expect(
        page
          .locator('hlm-calendar button[role="gridcell"]:not([data-outside])')
          .filter({ hasText: new RegExp(`^\\s*${day}(?:\\s|,|$)`) }),
      ).toBeFocused();
      await page.keyboard.press("Space");
    };
    await tomorrow();
    await chooseTime("20:00");
    await page
      .getByRole("button", { name: "Revisar consulta", exact: true })
      .click();
    await capture("real-booking-review-desktop");
    sql(
      `INSERT INTO agendamento(id,clinica_id,paciente_id,medico_id,especialidade_id,consultorio_id,inicio,fim,status,version) VALUES('${occupied}','00000000-0000-0000-0000-000000000001','${otherPatient}','30000000-0000-0000-0000-000000000004','31000000-0000-0000-0000-000000000021','31000000-0000-0000-0000-000000000011',(CURRENT_DATE+1+TIME '20:00') AT TIME ZONE 'America/Belem',(CURRENT_DATE+1+TIME '20:30') AT TIME ZONE 'America/Belem','AGENDADA',0)`,
    );
    await page
      .getByRole("button", { name: "Confirmar agendamento", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Horário indisponível", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Revisar consulta", exact: true }),
    ).toBeDisabled();
    await capture("real-booking-conflict-desktop");
    await page
      .getByRole("button", { name: "Alterar preferências", exact: true })
      .click();
    await expect(page.locator("#doctor")).toHaveValue(
      "30000000-0000-0000-0000-000000000004",
    );
    await expect(page.locator("#unit")).toHaveValue(
      "31000000-0000-0000-0000-000000000001",
    );
    await expect(page.locator("#specialty")).toHaveValue(
      "31000000-0000-0000-0000-000000000021",
    );
    await page
      .getByRole("button", { name: "Escolher data e horário", exact: true })
      .click();
    await chooseTime("20:30");
    await page
      .getByRole("button", { name: "Revisar consulta", exact: true })
      .click();
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/agendamentos") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Confirmar agendamento", exact: true })
      .click();
    const appointment = await (await response).json();
    created.add(appointment.id);
    await expect(
      page.getByRole("heading", { name: "Consulta agendada", exact: true }),
    ).toBeVisible();
    console.log(
      "REAL booking, occupied-slot refusal, preferences and explicit confirmation: OK",
    );
    await page
      .getByRole("link", { name: "Ver consultas", exact: true })
      .click();
    await page.getByRole("link", { name: "Reagendar", exact: true }).click();
    await tomorrow();
    await chooseTime("21:00");
    await page
      .getByRole("button", { name: "Revisar novo horário", exact: true })
      .click();
    await page.setViewportSize({ width: 768, height: 1024 });
    await capture("real-reschedule-comparison-tablet");
    sql(
      `UPDATE agendamento SET version=version+1 WHERE id='${appointment.id}'`,
    );
    await page
      .getByRole("button", { name: "Confirmar reagendamento", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Confira a consulta atualizada",
        exact: true,
      }),
    ).toBeVisible();
    await capture("real-reschedule-version-tablet");
    await page
      .getByRole("button", {
        name: "Conferi a consulta, escolher horário",
        exact: true,
      })
      .click();
    await chooseTime("21:00");
    await page
      .getByRole("button", { name: "Revisar novo horário", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirmar reagendamento", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Consulta reagendada", exact: true }),
    ).toBeVisible();
    await capture("real-reschedule-success-tablet");
    await page
      .getByRole("link", { name: "Ver consultas", exact: true })
      .click();
    await page.reload();
    await expect(page.locator(".date-time")).toContainText("21:00");
    await page
      .getByRole("button", { name: "Cancelar consulta", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Sim, cancelar consulta", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Consulta cancelada", exact: true }),
    ).toBeVisible();
    await capture("real-cancellation-tablet");
    const persisted = sql(
      `SELECT status FROM agendamento WHERE id='${appointment.id}'`,
    );
    expect(persisted).toContain("CANCELADA");
    console.log(
      "REAL reschedule, stale version, confirmation, persisted reload and cancellation: OK",
    );
  } catch (error) {
    if (page && !page.isClosed())
      await page.screenshot({
        path: "/tmp/qa57-failure.png",
        fullPage: true,
        animations: "disabled",
      });
    throw error;
  } finally {
    if (browser) await browser.close();
    const commands = [...created].map(
      (id) => `DELETE FROM agendamento WHERE id='${id}'`,
    );
    if (seeded)
      commands.push(
        `DELETE FROM agendamento WHERE id='${occupied}'`,
        `DELETE FROM paciente WHERE id='${otherPatient}'`,
        `DELETE FROM regra_agenda WHERE id='${rule}'`,
      );
    if (commands.length) sql(`BEGIN;${commands.join(";")};COMMIT;`);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
