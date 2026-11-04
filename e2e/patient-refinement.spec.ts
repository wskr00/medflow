import { expect, test, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
const parts = new Intl.DateTimeFormat("en", {
  timeZone: "America/Belem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(new Date());
const part = (type: string) => parts.find((p) => p.type === type)!.value;
const civil = `${part("year")}-${part("month")}-${part("day")}`;
const unit = { id: "unit57", nome: "Unidade sintética" };
const specialty = { id: "specialty57", nome: "Especialidade sintética" };
const doctor = {
  id: "doctor57",
  nome: "Profissional sintético",
  especialidadeIds: [specialty.id],
};
const slot = {
  regraAgendaId: "rule57",
  inicio: `${civil}T20:00:00-03:00`,
  fim: `${civil}T20:30:00-03:00`,
  unidade: unit,
  especialidade: specialty,
  medico: doctor,
  consultorio: { id: "room57", nome: "Consultório sintético" },
};
const alternative = {
  ...slot,
  inicio: `${civil}T21:00:00-03:00`,
  fim: `${civil}T21:30:00-03:00`,
};
const appointment = {
  ...slot,
  id: "57000000-0000-0000-0000-000000000011",
  version: 1,
  status: "AGENDADA",
  allowedActions: { canReschedule: true, canCancel: true },
};
async function login(page: Page, route = "agendar") {
  await page.goto(`/workspace/patient/${route}`);
  await page.waitForURL(/:8085/);
  await page.getByLabel(/username|usuário/i).fill("paciente");
  await page.locator("input[type=password]").fill("paciente");
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await page.waitForURL(/:4200/);
}
async function catalogs(page: Page) {
  for (const [name, value] of Object.entries({
    unidades: unit,
    especialidades: specialty,
    medicos: doctor,
  }))
    await page.route(`**/api/${name}?*`, (r) =>
      r.fulfill({
        json: { items: [value], page: 0, size: 100, totalElements: 1 },
      }),
    );
  await page.route("**/api/disponibilidades/datas?*", (r) =>
    r.fulfill({ json: { items: [civil], timeZone: "America/Belem" } }),
  );
}
async function selectPreferences(page: Page) {
  await page.locator("#specialty").selectOption(specialty.id);
  await page.locator("#unit").selectOption(unit.id);
  await page.locator("#doctor").selectOption(doctor.id);
  await page
    .getByRole("button", { name: "Escolher data e horário", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Horários disponíveis", exact: true }),
  ).toBeFocused();
}
async function accessible(page: Page) {
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter(
        (animation) => animation.effect?.getTiming().iterations !== Infinity,
      );
    await Promise.all(
      finite.map((animation) => animation.finished.catch(() => {})),
    );
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
}
for (const width of [1366, 768])
  test(`paciente ${width}: agendamento, revisão, conflito preserva preferências e sucesso`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1024 });
    await catalogs(page);
    let slots = [slot, alternative],
      writes = 0;
    await page.route("**/api/disponibilidades?*", (r) =>
      r.fulfill({ json: { items: slots, timeZone: "America/Belem" } }),
    );
    await page.route("**/api/agendamentos", async (r) => {
      writes++;
      const body = r.request().postDataJSON();
      if (writes === 1) {
        slots = [alternative];
        return r.fulfill({
          status: 409,
          json: { code: "HORARIO_INDISPONIVEL" },
        });
      }
      expect(body).toEqual({
        regraAgendaId: alternative.regraAgendaId,
        inicio: alternative.inicio,
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      return r.fulfill({
        status: 201,
        json: { ...appointment, ...alternative },
      });
    });
    await login(page);
    await selectPreferences(page);
    const dayBox = await page
      .locator('hlm-calendar button[aria-selected="true"]')
      .boundingBox();
    expect(dayBox!.width).toBeGreaterThanOrEqual(44);
    expect(dayBox!.height).toBeGreaterThanOrEqual(44);
    await page
      .getByRole("button", { name: /20:00.*Profissional sintético/ })
      .focus();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("button", { name: /20:00.*Profissional sintético/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: "Revisar consulta", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Revise sua consulta", exact: true }),
    ).toBeFocused();
    expect(writes).toBe(0);
    await expect(page.locator("app-patient-visit-details")).toContainText(
      unit.nome,
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
    await expect(
      page.getByRole("button", { name: /20:00.*Profissional sintético/ }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Alterar preferências", exact: true })
      .click();
    await expect(page.locator("#specialty")).toHaveValue(specialty.id);
    await expect(page.locator("#unit")).toHaveValue(unit.id);
    await expect(page.locator("#doctor")).toHaveValue(doctor.id);
    await page
      .getByRole("button", { name: "Escolher data e horário", exact: true })
      .click();
    await page
      .getByRole("button", { name: /21:00.*Profissional sintético/ })
      .click();
    await page
      .getByRole("button", { name: "Revisar consulta", exact: true })
      .click();
    await accessible(page);
    await page.screenshot({
      path: info.outputPath("booking-review.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "Confirmar agendamento", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Confirmar agendamento", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("heading", { name: "Consulta agendada", exact: true }),
    ).toBeVisible();
    await expect(page.locator("app-patient-visit-details")).toContainText(
      "21:00",
    );
    await accessible(page);
    expect(writes).toBe(2);
  });
for (const width of [1366, 768])
  test(`paciente ${width}: reagendamento vazio, indisponibilidade, versão e confirmação explícita`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1024 });
    let current = { ...appointment },
      slots: (typeof slot)[] = [],
      writes = 0;
    await page.route(`**/api/agendamentos/${appointment.id}`, (r) =>
      r.fulfill({ json: current }),
    );
    await page.route(
      `**/api/agendamentos/${appointment.id}/disponibilidades?*`,
      (r) => r.fulfill({ json: { items: slots, timeZone: "America/Belem" } }),
    );
    await page.route(
      `**/api/agendamentos/${appointment.id}/reagendamento`,
      (r) => {
        writes++;
        if (writes === 1) {
          slots = [alternative];
          return r.fulfill({
            status: 409,
            json: { code: "HORARIO_INDISPONIVEL" },
          });
        }
        if (writes === 2) {
          current = { ...current, version: 3 };
          return r.fulfill({
            status: 409,
            json: { code: "VERSAO_DESATUALIZADA" },
          });
        }
        expect(r.request().postDataJSON().expectedVersion).toBe(3);
        return r.fulfill({ json: { ...current, ...alternative, version: 4 } });
      },
    );
    await login(page, `consultas/${appointment.id}/reagendar`);
    await expect(
      page.getByRole("heading", {
        name: "Sem horários nesta data",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Revisar novo horário", exact: true }),
    ).toBeDisabled();
    slots = [slot, alternative];
    await page.reload();
    await page
      .getByRole("button", { name: /20:00.*Profissional sintético/ })
      .click();
    await page
      .getByRole("button", { name: "Revisar novo horário", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Revise a alteração", exact: true }),
    ).toBeFocused();
    await expect(page.locator(".reschedule-comparison")).toContainText(
      "Horário atual",
    );
    await accessible(page);
    await page.screenshot({
      path: info.outputPath("reschedule-comparison.png"),
      fullPage: true,
      animations: "disabled",
    });
    expect(writes).toBe(0);
    await page
      .getByRole("button", { name: "Confirmar reagendamento", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Horário indisponível", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Revisar novo horário", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: /21:00.*Profissional sintético/ })
      .click();
    await page
      .getByRole("button", { name: "Revisar novo horário", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirmar reagendamento", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Confira a consulta atualizada",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Confirmar reagendamento",
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole("button", {
        name: "Conferi a consulta, escolher horário",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: /21:00.*Profissional sintético/ })
      .click();
    await page
      .getByRole("button", { name: "Revisar novo horário", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirmar reagendamento", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Consulta reagendada", exact: true }),
    ).toBeVisible();
    await expect(page.locator("app-patient-visit-details")).toContainText(
      "21:00",
    );
    await accessible(page);
  });

test("paciente: cancelamento recusado não confirma sucesso e nova tentativa usa a versão atual", async ({
  page,
}) => {
  let current = { ...appointment },
    writes = 0,
    items = [current];
  await page.route("**/api/me/agendamentos?*", (r) =>
    r.fulfill({
      json: { items, page: 0, size: 20, totalElements: items.length },
    }),
  );
  await page.route(
    `**/api/agendamentos/${appointment.id}/cancelamento`,
    (r) => {
      writes++;
      if (writes === 1) {
        current = { ...current, version: 2 };
        items = [current];
        return r.fulfill({
          status: 409,
          json: { code: "VERSAO_DESATUALIZADA" },
        });
      }
      expect(r.request().postDataJSON().expectedVersion).toBe(2);
      items = [];
      return r.fulfill({ json: { ...current, status: "CANCELADA" } });
    },
  );
  await login(page, "consultas");
  await page
    .getByRole("button", { name: "Cancelar consulta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Manter consulta", exact: true })
    .click();
  expect(writes).toBe(0);
  await page
    .getByRole("button", { name: "Cancelar consulta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sim, cancelar consulta", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Consulta atualizada");
  await expect(
    page.getByRole("button", { name: "Sim, cancelar consulta", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Cancelar consulta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sim, cancelar consulta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Consulta cancelada", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Nenhuma consulta futura", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#patient-cancel-notice")).toBeFocused();
  await accessible(page);
});

test("paciente: histórico paginado mostra somente dados operacionais", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/(atendimentos|medico\/pacientes)/.test(r.url()))
      calls.push(r.url());
  });
  await page.route("**/api/me/agendamentos?*", (r) => {
    const url = new URL(r.request().url());
    expect(url.searchParams.get("q")).toBe("status==FINALIZADA");
    const page = Number(url.searchParams.get("page"));
    return r.fulfill({
      json: {
        items: [
          {
            ...appointment,
            id: `history${page}`,
            status: "FINALIZADA",
            medico: { id: "d", nome: `Profissional da página ${page + 1}` },
            registroClinico: { conduta: "CLINICAL_SECRET_MUST_NOT_RENDER" },
          },
        ],
        page,
        size: 20,
        totalElements: 21,
      },
    });
  });
  await login(page, "historico");
  await expect(page.getByText("Profissional da página 1")).toBeVisible();
  await page.getByRole("button", { name: "Mais antigas", exact: true }).click();
  await expect(page.getByText("Profissional da página 2")).toBeVisible();
  await expect(page.getByText("CLINICAL_SECRET_MUST_NOT_RENDER")).toHaveCount(
    0,
  );
  expect(calls).toEqual([]);
  await accessible(page);
});

test("paciente: loading, rede, vazio e recuperação preservam as escolhas", async ({
  page,
}) => {
  await catalogs(page);
  let phase = "loading",
    release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/disponibilidades?*", async (r) => {
    if (phase === "loading") await pending;
    if (phase === "error") return r.abort("failed");
    return r.fulfill({
      json: {
        items: phase === "empty" ? [] : [slot],
        timeZone: "America/Belem",
      },
    });
  });
  await login(page);
  await selectPreferences(page);
  await page.locator('hlm-calendar button[aria-selected="true"]').click();
  await expect(
    page.locator('hlm-calendar button[aria-selected="true"]'),
  ).toHaveCount(1);
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  phase = "error";
  release();
  await expect(
    page.getByRole("heading", { name: "Falha de conexão", exact: true }),
  ).toBeVisible();
  phase = "empty";
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sem horários nesta data", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Alterar preferências", exact: true })
    .click();
  await expect(page.locator("#doctor")).toHaveValue(doctor.id);
  phase = "success";
  await page
    .getByRole("button", { name: "Escolher data e horário", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /20:00.*Profissional sintético/ }),
  ).toBeVisible();
  await accessible(page);
});

test("paciente: trocar especialidade limpa profissional incompatível e seleção anterior", async ({
  page,
}) => {
  await catalogs(page);
  await page.route("**/api/especialidades?*", (r) =>
    r.fulfill({
      json: {
        items: [specialty, { id: "other", nome: "Outra especialidade" }],
        page: 0,
        size: 100,
        totalElements: 2,
      },
    }),
  );
  await login(page);
  await page
    .getByRole("button", { name: "Escolher data e horário", exact: true })
    .click();
  await expect(
    page.getByText("Selecione uma especialidade.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#specialty")).toHaveAttribute(
    "aria-describedby",
    "booking-specialty-error",
  );
  await expect(
    page.getByText("Selecione uma unidade.", { exact: true }),
  ).toBeVisible();
  await page.locator("#specialty").selectOption(specialty.id);
  await page.locator("#doctor").selectOption(doctor.id);
  await page.locator("#specialty").selectOption("other");
  await expect(page.locator("#doctor")).toHaveValue("");
  await expect(page.locator("#doctor option")).toHaveCount(1);
});

test("paciente: ações autorizadas, foco de rota, janela estreita e movimento reduzido", async ({
  page,
}) => {
  await page.route("**/api/me/agendamentos?*", (r) =>
    r.fulfill({
      json: {
        items: [
          {
            ...appointment,
            allowedActions: { canCancel: false, canReschedule: false },
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
      },
    }),
  );
  await login(page, "consultas");
  await expect(
    page.getByRole("button", { name: "Cancelar consulta", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Reagendar", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 720 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator("app-patient-appointments")
      .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
  ).toBeLessThanOrEqual(0.00001);
});
