// Local synthetic smoke for #58. Requires the integrated demo stack and Docker Compose.
const path = require("node:path");
process.chdir(path.resolve(__dirname, ".."));
const { chromium } = require("playwright");
const { expect } = require("@playwright/test");
const { execFileSync } = require("node:child_process");
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
    { cwd: process.cwd(), encoding: "utf8" },
  );
const id = (n) => `58000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
(async () => {
  // Fixed same-day slots keep the visual evidence reproducible.
  const clinicHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Belem",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  if (clinicHour >= 8)
    throw new Error(
      "Execute este smoke antes das 08h no fuso America/Belem; os horários sintéticos são fixos.",
    );
  let browser,
    page,
    seeded = false;
  try {
    const statements = [];
    const names = [
      "Lia Pereira",
      "Tiago Martins",
      "Rosa Almeida",
      "Pedro Santos",
    ];
    for (let i = 0; i < 4; i++) {
      statements.push(`INSERT INTO paciente(id,clinica_id,nome,subject,version) VALUES ('${id(i + 1)}','00000000-0000-0000-0000-000000000001','${names[i]}','qa58-${i}',0);
INSERT INTO agendamento(id,clinica_id,paciente_id,medico_id,especialidade_id,consultorio_id,inicio,fim,status,version) VALUES ('${id(i + 11)}','00000000-0000-0000-0000-000000000001','${id(i + 1)}','30000000-0000-0000-0000-000000000004','31000000-0000-0000-0000-000000000021','31000000-0000-0000-0000-000000000011',CURRENT_DATE + TIME '${10 + i}:00' AT TIME ZONE 'America/Belem',CURRENT_DATE + TIME '${10 + i}:30' AT TIME ZONE 'America/Belem','AGENDADA',0);`);
    }
    statements.push(
      `INSERT INTO regra_agenda(id,clinica_id,medico_id,especialidade_id,consultorio_id,dia_semana,hora_inicio,hora_fim,duracao_minutos,vigente_de,vigente_ate,ativo,version) VALUES('${id(21)}','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004','31000000-0000-0000-0000-000000000021','31000000-0000-0000-0000-000000000011',EXTRACT(ISODOW FROM CURRENT_DATE),'08:00','18:00',30,CURRENT_DATE,CURRENT_DATE+30,true,0);`,
    );
    sql("BEGIN;" + statements.join("\n") + "COMMIT;");
    seeded = true;
    browser = await chromium.launch();
    page = await browser.newPage({
      viewport: { width: 1366, height: 768 },
      locale: "pt-BR",
    });
    await page.goto("http://localhost:4200/workspace/reception");
    await page.waitForURL(/:8085/);
    await page.getByLabel(/username|usuário/i).fill("recepcionista");
    await page.locator("input[type=password]").fill("recepcionista");
    await page.getByRole("button", { name: /sign in|entrar/i }).click();
    await page.getByRole("row").filter({ hasText: "Lia Pereira" }).waitFor();
    await page.screenshot({
      path: "docs/qa/ui58/reception-actions-desktop.png",
      fullPage: true,
      animations: "disabled",
    });
    const arrival = page
      .getByRole("row")
      .filter({ hasText: "Lia Pereira" })
      .getByRole("button", { name: "Confirmar chegada" });
    await arrival.focus();
    await arrival.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Chegada confirmada" }),
    ).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: "Lia Pereira" }),
    ).toContainText("Em espera");
    console.log("REAL check-in: success, row and queue refreshed");
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({
      path: "docs/qa/ui58/reception-actions-tablet.png",
      fullPage: true,
      animations: "disabled",
    });
    const card = page.locator("article").filter({ hasText: "Tiago Martins" });
    await card.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page
      .getByRole("button", { name: "Cancelar consulta", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Consulta cancelada" }),
    ).toBeVisible();
    await expect(card).toContainText("Cancelada");
    console.log("REAL tablet cancellation: success");
    await page.setViewportSize({ width: 1366, height: 768 });
    sql(`UPDATE agendamento SET version=version+1 WHERE id='${id(13)}'`);
    await page
      .getByRole("row")
      .filter({ hasText: "Rosa Almeida" })
      .getByRole("button", { name: "Confirmar chegada" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Consulta atualizada" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Chegada confirmada" }),
    ).toHaveCount(0);
    await page.screenshot({
      path: "docs/qa/ui58/reception-conflict.png",
      fullPage: true,
      animations: "disabled",
    });
    console.log("REAL stale-version: 409, no false success");
    await page
      .getByRole("row")
      .filter({ hasText: "Pedro Santos" })
      .getByRole("link", { name: "Reagendar" })
      .click();
    await page.getByRole("heading", { name: "Horários disponíveis" }).waitFor();
    await page.getByRole("button", { name: /08:00/ }).first().click();
    await page.getByRole("button", { name: "Revisar novo horário" }).click();
    await page.getByRole("heading", { name: "Revisar alteração" }).waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "docs/qa/ui58/reception-reschedule-review.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Confirmar novo horário" }).click();
    await expect(
      page.getByRole("heading", { name: "Agenda do dia" }),
    ).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: "Pedro Santos" }),
    ).toContainText("08:00");
    console.log("REAL rescheduling: selected, reviewed, saved");
  } catch (e) {
    if (page)
      await page.screenshot({
        path: "/tmp/ui58-smoke-failure.png",
        fullPage: true,
        animations: "disabled",
      });
    throw e;
  } finally {
    if (browser) await browser.close();
    if (seeded)
      sql(
        `DELETE FROM agendamento WHERE id IN ('${id(11)}','${id(12)}','${id(13)}','${id(14)}'); DELETE FROM regra_agenda WHERE id='${id(21)}'; DELETE FROM paciente WHERE id IN ('${id(1)}','${id(2)}','${id(3)}','${id(4)}');`,
      );
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
