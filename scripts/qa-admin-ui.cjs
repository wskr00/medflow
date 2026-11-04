// Integrated smoke with isolated synthetic configuration. Requires the demo stack.
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
  const ids = {},
    suffix = Date.now().toString(),
    patient = randomUUID(),
    appointment = randomUUID();
  let browser,
    page,
    seeded = false;
  try {
    browser = await chromium.launch();
    page = await browser.newPage({
      viewport: { width: 1366, height: 768 },
    });
    await page.goto("http://localhost:4200/workspace/admin/estrutura");
    await page.waitForURL(/:8085/);
    await page.getByLabel(/username|usuário/i).fill("administrador");
    await page.locator("input[type=password]").fill("administrador");
    await page.getByRole("button", { name: /sign in|entrar/i }).click();
    await page.waitForURL(/:4200/);
    // Track created IDs from Location before reading bodies, so interrupted runs still clean up.
    page.on("response", (response) => {
      const match = new URL(response.url()).pathname.match(
        /^\/api\/(unidades|consultorios|especialidades|medicos|regras-agenda|bloqueios-agenda)$/,
      );
      if (
        match &&
        response.request().method() === "POST" &&
        response.status() === 201
      ) {
        const id = response.headers()["location"]?.split("/").pop();
        if (id && /^[0-9a-f-]{36}$/.test(id)) ids[match[1]] = id;
      }
    });
    const go = async (route) => {
      await page.locator(`nav a[href="/workspace/admin/${route}"]`).click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    };
    const create = async (resource, button) => {
      const response = page.waitForResponse(
        (r) =>
          r.url().endsWith(`/api/${resource}`) &&
          r.request().method() === "POST",
      );
      await page.getByRole("button", { name: button, exact: true }).click();
      let r;
      try {
        r = await response;
      } catch (error) {
        await page.evaluate(() => {
          scrollTo({ top: 0, behavior: "instant" });
          document.activeElement?.blur();
        });
        await page.screenshot({
          path: "/tmp/qa60-failure.png",
          fullPage: true,
        });
        console.error(await page.locator("main").innerText());
        throw error;
      }
      const body = await r.json();
      expect(r.ok(), JSON.stringify(body)).toBe(true);
      ids[resource] = body.id;
      await expect(
        page.getByRole("heading", { name: "Alterações salvas", exact: true }),
      ).toBeVisible();
      return body;
    };
    await go("clinica");
    const original = await page.locator("#clinic-name").inputValue();
    await page.locator("#clinic-name").fill(original + " ");
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Alterações salvas", exact: true }),
    ).toBeVisible();
    await expect(page.locator("#clinic-name")).toHaveValue(original);
    await go("estrutura");
    await page
      .getByRole("button", { name: "Nova unidade", exact: true })
      .click();
    await page.locator("#unit-name").fill(`Unidade sintética QA60 ${suffix}`);
    await page.locator("#unit-address").fill("Endereço sintético QA60");
    await create("unidades", "Salvar unidade");
    await page
      .getByRole("button", { name: "Novo consultório", exact: true })
      .click();
    await page
      .locator("#room-name")
      .fill(`Consultório sintético QA60 ${suffix}`);
    await create("consultorios", "Salvar consultório");
    await go("especialidades");
    await page
      .getByRole("button", { name: "Nova especialidade", exact: true })
      .click();
    await page
      .locator("#specialty-name")
      .fill(`Especialidade sintética QA60 ${suffix}`);
    await create("especialidades", "Salvar");
    await go("profissionais");
    await page
      .getByRole("button", { name: "Novo médico", exact: true })
      .click();
    await page.locator("#doctor-name").fill(`Médico sintético QA60 ${suffix}`);
    await page.locator("#crm-number").fill(suffix);
    await page.locator("#crm-uf").fill("PA");
    await page
      .locator("hlm-toggle-group button")
      .filter({ hasText: `Especialidade sintética QA60 ${suffix}` })
      .click();
    await create("medicos", "Salvar alterações");
    // A real stale version must keep the local text and block retries until refresh.
    sql(`UPDATE medico SET version=version+1 WHERE id='${ids.medicos}'`);
    await page.locator("#doctor-name").fill(`Edição sintética QA60 ${suffix}`);
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Configuração alterada", exact: true }),
    ).toBeVisible();
    await expect(page.locator("#doctor-name")).toHaveValue(
      `Edição sintética QA60 ${suffix}`,
    );
    await page.evaluate(() => {
      scrollTo({ top: 0, behavior: "instant" });
      document.activeElement?.blur();
    });
    await page.screenshot({
      path: "docs/qa/ui60/real-version-conflict.png",
      fullPage: true,
      animations: "disabled",
    });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Carregar versão atual" }).click();
    await expect(page.locator("#doctor-name")).toHaveValue(
      `Médico sintético QA60 ${suffix}`,
    );
    await page
      .locator("#doctor-name")
      .fill(`Médico sintético QA60 ${suffix} revisado`);
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Alterações salvas", exact: true }),
    ).toBeVisible();
    console.log(
      "REAL clinic, unit, room, specialty, professional, stale version and recovery: OK",
    );
    await go("agenda");
    await page
      .getByRole("button", { name: "Novo horário", exact: true })
      .click();
    await page.locator("#rule-doctor").selectOption(ids.medicos);
    await page.locator("#rule-specialty").selectOption(ids.especialidades);
    await page.locator("#rule-room").selectOption(ids.consultorios);
    await page.locator("#rule-day").selectOption("3");
    await page.locator("#rule-start").fill("09:00");
    await page.locator("#rule-end").fill("11:00");
    await page.locator("#rule-validity").fill("2031-11-05");
    await page.locator("#rule-valid-until").fill("2031-12-31");
    await create("regras-agenda", "Salvar horário");
    // A synthetic future appointment exercises the actual reservation constraint.
    sql(
      `BEGIN; INSERT INTO paciente(id,clinica_id,nome,subject,version) VALUES('${patient}','00000000-0000-0000-0000-000000000001','Paciente sintético QA60','qa60-${suffix}',0); INSERT INTO agendamento(id,clinica_id,paciente_id,medico_id,especialidade_id,consultorio_id,inicio,fim,status,version) VALUES('${appointment}','00000000-0000-0000-0000-000000000001','${patient}','${ids.medicos}','${ids.especialidades}','${ids.consultorios}','2031-11-05T09:00:00-03:00','2031-11-05T09:30:00-03:00','AGENDADA',0); COMMIT;`,
    );
    seeded = true;
    await page.setViewportSize({ width: 768, height: 1024 });
    await go("bloqueios");
    await page
      .getByRole("button", { name: "Novo bloqueio", exact: true })
      .click();
    await page.locator("#block-doctor").selectOption(ids.medicos);
    await page.locator("#block-start").fill("2031-11-05T09:00");
    await page.locator("#block-end").fill("2031-11-05T10:00");
    await page
      .getByRole("button", { name: "Salvar bloqueio", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Alteração bloqueada por reservas",
        exact: true,
      }),
    ).toBeVisible();
    await page.evaluate(() => {
      scrollTo({ top: 0, behavior: "instant" });
      document.activeElement?.blur();
    });
    await page.screenshot({
      path: "docs/qa/ui60/real-reservation-conflict-tablet.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.locator("#block-start").fill("2031-11-05T12:00");
    await page.locator("#block-end").fill("2031-11-05T13:00");
    await create("bloqueios-agenda", "Salvar bloqueio");
    await page.reload();
    await page
      .locator(".record-option")
      .filter({ hasText: `Médico sintético QA60 ${suffix} revisado` })
      .click();
    await expect(page.locator("#block-start")).toHaveValue("2031-11-05T12:00");
    await page.evaluate(() => {
      scrollTo({ top: 0, behavior: "instant" });
      document.activeElement?.blur();
    });
    await page.screenshot({
      path: "docs/qa/ui60/real-block-saved-tablet.png",
      fullPage: true,
      animations: "disabled",
    });
    console.log(
      "REAL schedule, reservation refusal, corrected block and persisted reload: OK",
    );
  } catch (error) {
    if (page && !page.isClosed()) {
      await page.evaluate(() => {
        scrollTo({ top: 0, behavior: "instant" });
        document.activeElement?.blur();
      });
      await page.screenshot({ path: "/tmp/qa60-failure.png", fullPage: true });
      console.error(await page.locator("main").innerText());
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    const commands = [];
    if (seeded)
      commands.push(
        `DELETE FROM agendamento WHERE id='${appointment}'`,
        `DELETE FROM paciente WHERE id='${patient}'`,
      );
    for (const [resource, table] of [
      ["bloqueios-agenda", "bloqueio_agenda"],
      ["regras-agenda", "regra_agenda"],
      ["medicos", "medico"],
      ["consultorios", "consultorio"],
      ["especialidades", "especialidade"],
      ["unidades", "unidade"],
    ]) {
      if (!ids[resource]) continue;
      if (resource === "medicos")
        commands.push(
          `DELETE FROM medico_especialidade WHERE medico_id='${ids.medicos}'`,
        );
      commands.push(`DELETE FROM ${table} WHERE id='${ids[resource]}'`);
    }
    if (commands.length) sql(`BEGIN;${commands.join(";")};COMMIT;`);
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
