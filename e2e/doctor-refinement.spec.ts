import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
const blank = {
  queixaPrincipal: "",
  resumoAnamnese: "",
  conduta: "",
  observacoes: "",
};
const appointment = {
  id: "59000000-0000-0000-0000-000000000011",
  version: 1,
  inicio: "2026-11-04T10:00:00-03:00",
  fim: "2026-11-04T10:30:00-03:00",
  status: "EM_ATENDIMENTO",
  paciente: { id: "patient", nome: "Paciente sintético" },
  medico: { id: "doctor", nome: "Dra. Camila Ramos" },
  especialidade: { id: "specialty", nome: "Clínica geral" },
  unidade: { id: "unit", nome: "Unidade Central" },
  consultorio: { id: "room", nome: "Consultório 101" },
  atendimentoId: "care59",
  allowedActions: { canStart: false, canResume: true },
};
for (const width of [1366, 768])
  test(`médico ${width}: edição, conflito, histórico e finalização`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1024 });
    let data = {
      agendamento: appointment,
      atendimento: {
        id: "care59",
        agendamentoId: appointment.id,
        version: 1,
        iniciadoEm: appointment.inicio,
        finalizadoEm: null as string | null,
        registroClinico: { ...blank },
      },
    };
    let conflict = false;
    let rejectFinish = true;
    await page.route("**/api/atendimentos/care59", (r) =>
      r.fulfill({ json: data }),
    );
    await page.route("**/api/medico/pacientes/patient/historico?*", (r) =>
      r.fulfill({
        json: {
          items: [
            {
              ...data,
              atendimento: {
                ...data.atendimento,
                finalizadoEm: "2026-11-03T12:00:00Z",
                registroClinico: {
                  ...blank,
                  queixaPrincipal: "Histórico sintético",
                  conduta: "Orientação anterior",
                },
              },
            },
          ],
          page: 0,
          size: 20,
          totalElements: 1,
        },
      }),
    );
    await page.route(
      "**/api/atendimentos/care59/registro-clinico",
      async (r) => {
        const body = r.request().postDataJSON();
        if (conflict) {
          conflict = false;
          data = {
            ...data,
            atendimento: {
              ...data.atendimento,
              version: 3,
              registroClinico: {
                ...data.atendimento.registroClinico,
                queixaPrincipal: "Versão de outro acesso",
              },
            },
          };
          await r.fulfill({
            status: 409,
            json: { code: "VERSAO_DESATUALIZADA" },
          });
          return;
        }
        expect(body.expectedVersion).toBe(data.atendimento.version);
        const { expectedVersion, ...record } = body;
        data = {
          ...data,
          atendimento: {
            ...data.atendimento,
            version: expectedVersion + 1,
            registroClinico: record,
          },
        };
        await r.fulfill({ json: data });
      },
    );
    await page.route("**/api/atendimentos/care59/finalizacao", (r) => {
      if (rejectFinish) {
        rejectFinish = false;
        return r.fulfill({
          status: 409,
          json: { code: "REGISTRO_INCOMPLETO" },
        });
      }
      data = {
        agendamento: { ...appointment, status: "FINALIZADA" },
        atendimento: {
          ...data.atendimento,
          finalizadoEm: "2026-11-04T13:30:00Z",
        },
      };
      return r.fulfill({ json: data });
    });
    await page.goto("/workspace/doctor/atendimentos/care59");
    await page.waitForURL(/:8085/);
    await page.getByLabel(/username|usuário/i).fill("medico");
    await page.locator("input[type=password]").fill("medico");
    await page.getByRole("button", { name: /sign in|entrar/i }).click();
    await expect(page.locator("#complaint")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Finalizar atendimento", exact: true }),
    ).toBeDisabled();
    await page.locator("#complaint").fill("Texto local sintético");
    await expect(page.locator(".draft-status")).toContainText("não salvas");
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("link", { name: "Voltar para minha agenda" }).click();
    await expect(page.locator("#complaint")).toHaveValue(
      "Texto local sintético",
    );
    await page.locator("#history").fill("Resumo sintético");
    await page.locator("#plan").fill("Conduta sintética");
    await page
      .getByRole("button", { name: "Salvar rascunho", exact: true })
      .first()
      .click();
    await expect(page.locator(".draft-status")).toContainText("Rascunho salvo");
    await page.locator("#complaint").fill("Edição preservada");
    conflict = true;
    await page
      .getByRole("button", { name: "Salvar rascunho", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Registro atualizado em outro acesso",
      }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("button", { name: "Salvar rascunho", exact: true })
        .first(),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Recarregar para comparar" })
      .click();
    await expect(
      page.getByRole("region", { name: "Comparação de registros" }),
    ).toContainText("Versão de outro acesso");
    await expect(page.locator("#complaint")).toHaveValue("Edição preservada");
    await page.screenshot({
      path: info.outputPath("comparison.png"),
      animations: "disabled",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Manter texto local e continuar" })
      .click();
    await page
      .getByRole("button", { name: "Salvar rascunho", exact: true })
      .first()
      .click();
    await expect(page.locator(".draft-status")).toContainText("Rascunho salvo");
    await page.getByRole("button", { name: "Histórico do paciente" }).click();
    await expect(page.getByRole("dialog")).toContainText("Orientação anterior");
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Finalizar atendimento", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Revisar registro", exact: true })
      .click();
    await expect(page.locator("#complaint")).toBeEditable();
    await page
      .getByRole("button", { name: "Finalizar atendimento", exact: true })
      .click();
    await page.getByRole("button", { name: "Confirmar finalização" }).click();
    await expect(
      page.getByRole("heading", { name: "Registro incompleto", exact: true }),
    ).toBeVisible();
    await expect(page.locator("#complaint")).toHaveValue("Edição preservada");
    await page
      .getByRole("button", { name: "Finalizar atendimento", exact: true })
      .click();
    await page.getByRole("button", { name: "Confirmar finalização" }).click();
    await expect(page.locator("textarea")).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Atendimento finalizado",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("completed.png"),
      animations: "disabled",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  });

test("médico: falha de início permanece visível após recarga", async ({
  page,
}) => {
  const waiting = {
    ...appointment,
    status: "EM_ESPERA",
    atendimentoId: null,
    allowedActions: { canStart: true, canResume: false },
  };
  await page.route("**/api/medico/agenda?*", (r) =>
    r.fulfill({
      json: { items: [waiting], page: 0, size: 20, totalElements: 1 },
    }),
  );
  await page.route("**/api/medico/fila?*", (r) =>
    r.fulfill({
      json: { items: [waiting], page: 0, size: 20, totalElements: 1 },
    }),
  );
  await page.route(`**/api/agendamentos/${appointment.id}/atendimento`, (r) =>
    r.fulfill({ status: 409, json: { code: "TRANSICAO_INVALIDA" } }),
  );
  await page.goto("/workspace/doctor/triagem");
  await page.waitForURL(/:8085/);
  await page.getByLabel(/username|usuário/i).fill("medico");
  await page.locator("input[type=password]").fill("medico");
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await page
    .getByRole("button", { name: "Iniciar atendimento", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Ação não disponível" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/triagem/);
});

for (const username of ["paciente", "recepcionista", "administrador"])
  test(`${username}: não recebe registro clínico da rota médica`, async ({
    page,
  }) => {
    const clinicalRequests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/atendimentos/"))
        clinicalRequests.push(r.url());
    });
    await page.goto("/workspace/doctor/atendimentos/care59");
    await page.waitForURL(/:8085/);
    await page.getByLabel(/username|usuário/i).fill(username);
    await page.locator("input[type=password]").fill(username);
    await page.getByRole("button", { name: /sign in|entrar/i }).click();
    await expect(
      page.getByRole("heading", { name: "Acesso não disponível" }),
    ).toBeVisible();
    expect(clinicalRequests).toEqual([]);
    await expect(page.locator("textarea")).toHaveCount(0);
  });
