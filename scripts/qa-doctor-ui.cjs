// Synthetic integrated smoke. Requires the local demonstration stack.
const path = require("node:path");
process.chdir(path.resolve(__dirname, ".."));
const { execFileSync } = require("node:child_process");
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
const patient = "59000000-0000-0000-0000-000000000001",
  appointment = "59000000-0000-0000-0000-000000000011";
(async () => {
  let seeded = false,
    b,
    p;
  try {
    sql(
      `BEGIN;INSERT INTO paciente(id,clinica_id,nome,subject,version) VALUES('${patient}','00000000-0000-0000-0000-000000000001','Paciente sintético QA59','qa59',0);INSERT INTO agendamento(id,clinica_id,paciente_id,medico_id,especialidade_id,consultorio_id,inicio,fim,status,check_in_em,version) VALUES('${appointment}','00000000-0000-0000-0000-000000000001','${patient}','30000000-0000-0000-0000-000000000004','31000000-0000-0000-0000-000000000021','31000000-0000-0000-0000-000000000011',now(),now()+interval '30 minutes','EM_ESPERA',now(),1);COMMIT;`,
    );
    seeded = true;
    b = await chromium.launch();
    p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    await p.goto("http://localhost:4200/workspace/doctor/triagem");
    await p.waitForURL(/:8085/);
    await p.getByLabel(/username|usuário/i).fill("medico");
    await p.locator("input[type=password]").fill("medico");
    await p.getByRole("button", { name: /sign in|entrar/i }).click();
    await p
      .getByRole("listitem")
      .filter({ hasText: "Paciente sintético QA59" })
      .getByRole("button", { name: "Iniciar atendimento" })
      .click();
    await p.locator("#complaint").fill("Queixa exclusivamente sintética");
    await p.locator("#history").fill("Anamnese exclusivamente sintética");
    await p.locator("#plan").fill("Conduta exclusivamente sintética");
    await p
      .getByRole("button", { name: "Salvar rascunho", exact: true })
      .first()
      .click();
    await expect(p.locator(".draft-status")).toContainText("Rascunho salvo");
    console.log("REAL start and explicit save: OK");
    await p.reload();
    await expect(p.locator("#complaint")).toHaveValue(
      "Queixa exclusivamente sintética",
    );
    sql(
      `UPDATE atendimento SET version=version+1 WHERE agendamento_id='${appointment}'`,
    );
    await p.locator("#complaint").fill("Edição local sintética");
    await p
      .getByRole("button", { name: "Salvar rascunho", exact: true })
      .first()
      .click();
    await expect(
      p.getByRole("heading", { name: "Registro atualizado em outro acesso" }),
    ).toBeVisible();
    await p.getByRole("button", { name: "Recarregar para comparar" }).click();
    await expect(
      p.getByRole("region", { name: "Comparação de registros" }),
    ).toContainText("Queixa exclusivamente sintética");
    await p.screenshot({
      path: "docs/qa/ui59/real-comparison.png",
      fullPage: true,
      animations: "disabled",
    });
    await p
      .getByRole("button", { name: "Manter texto local e continuar" })
      .click();
    await p
      .getByRole("button", { name: "Salvar rascunho", exact: true })
      .first()
      .click();
    await expect(p.locator(".draft-status")).toContainText("Rascunho salvo");
    console.log("REAL version conflict, comparison and recovery: OK");
    await p.setViewportSize({ width: 768, height: 1024 });
    await p
      .getByRole("button", { name: "Finalizar atendimento", exact: true })
      .click();
    await p.getByRole("button", { name: "Confirmar finalização" }).click();
    await expect(p.locator("textarea")).toHaveCount(0);
    await expect(
      p.getByRole("heading", { name: "Atendimento finalizado", exact: true }),
    ).toBeVisible();
    await p.screenshot({
      path: "docs/qa/ui59/real-completed-tablet.png",
      fullPage: true,
      animations: "disabled",
    });
    await p.getByRole("button", { name: "Histórico do paciente" }).click();
    await expect(p.getByRole("dialog")).toContainText(
      "Conduta exclusivamente sintética",
    );
    await p.screenshot({
      path: "docs/qa/ui59/real-history-tablet.png",
      fullPage: true,
      animations: "disabled",
    });
    console.log("REAL finalization, read-only and authorized history: OK");
  } finally {
    if (b) await b.close();
    if (seeded)
      sql(
        `DELETE FROM atendimento WHERE agendamento_id='${appointment}';DELETE FROM agendamento WHERE id='${appointment}';DELETE FROM paciente WHERE id='${patient}';`,
      );
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
