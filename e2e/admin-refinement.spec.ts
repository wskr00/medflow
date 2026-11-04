import { expect, test, Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
const routes = [
  "clinica",
  "estrutura",
  "profissionais",
  "especialidades",
  "agenda",
  "bloqueios",
];
const unit = {
  id: "unit60",
  nome: "Unidade sintética",
  endereco: "Endereço sintético",
  ativo: true,
  version: 1,
};
const specialty = {
  id: "specialty60",
  nome: "Especialidade sintética",
  ativo: true,
  version: 1,
};
const doctor = {
  id: "doctor60",
  nome: "Médico sintético",
  crmNumero: "60000",
  crmUf: "PA",
  especialidadeIds: [specialty.id],
  ativo: true,
  version: 1,
};
const room = {
  id: "room60",
  unidadeId: unit.id,
  nome: "Consultório sintético",
  ativo: true,
  version: 1,
};
const rule = {
  id: "rule60",
  medico: doctor,
  unidade: unit,
  especialidade: specialty,
  consultorio: room,
  diaSemana: 7,
  horaInicio: "08:00:00",
  horaFim: "10:00:00",
  duracaoMinutos: 30,
  vigenteDe: "2031-01-01",
  vigenteAte: "2031-12-31",
  ativo: false,
  version: 1,
};
const block = {
  id: "block60",
  medico: doctor,
  inicio: "2031-11-05T09:00:00-03:00",
  fim: "2031-11-05T10:00:00-03:00",
  ativo: false,
  version: 1,
};
async function login(page: Page, path = "estrutura", user = "administrador") {
  await page.goto(`/workspace/admin/${path}`);
  await page.waitForURL(/:8085/);
  await page.getByLabel(/username|usuário/i).fill(user);
  await page.locator("input[type=password]").fill(user);
  await page.getByRole("button", { name: /sign in|entrar/i }).click();
  await page.waitForURL(/:4200/);
}
async function fixtures(page: Page) {
  for (const [name, value] of Object.entries({
    unidades: unit,
    consultorios: room,
    especialidades: specialty,
    medicos: doctor,
    "regras-agenda": rule,
    "bloqueios-agenda": block,
  })) {
    await page.route(`**/api/${name}?*`, (r) =>
      r.fulfill({
        json: { items: [value], page: 0, size: 100, totalElements: 1 },
      }),
    );
    await page.route(`**/api/${name}/${value.id}`, (r) =>
      r.fulfill({ json: value }),
    );
  }
}
for (const width of [1366, 768])
  test(`admin ${width}: seis rotas reais, seleção, foco e acessibilidade`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1024 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.url().includes(":8080/api/") && response.status() >= 400)
        errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
    const clinical: string[] = [];
    page.on("request", (r) => {
      if (/\/api\/(atendimentos|medico\/pacientes)/.test(r.url()))
        clinical.push(r.url());
    });
    await login(page);
    for (const path of routes) {
      const link = page.locator(`nav a[href="/workspace/admin/${path}"]`);
      await link.click();
      await expect(link).toHaveAttribute("aria-current", "page");
      await expect(page.locator("main")).toBeFocused();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(/Carregando/)).toHaveCount(0);
      const item = page.locator(".record-panel .record-option").first();
      if (await item.count()) {
        await item.focus();
        await page.keyboard.press("Enter");
        await expect(item).toHaveAttribute("aria-pressed", "true");
        const editorInput = page.locator("main input:focus");
        await expect(editorInput).toHaveCount(1);
      }
      const editorTitles: Record<string, string> = {
        clinica: "Dados da clínica",
        estrutura: "Detalhe da unidade",
        profissionais: "Editar profissional",
        especialidades: "Editar especialidade",
        agenda: "Editar horário",
        bloqueios: "Editar bloqueio",
      };
      await expect(
        page.getByRole("heading", { name: editorTitles[path], exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const layout = page.locator(".editor-layout");
      if (await layout.count())
        expect(
          await layout.evaluate(
            (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
          ),
        ).toBe(width === 768 ? 1 : 2);
      const violations = (
        await new AxeBuilder({ page }).analyze()
      ).violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      );
      expect(violations).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`${path}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
    expect(errors).toEqual([]);
    expect(clinical).toEqual([]);
  });

test("admin: campos do médico, seleção por teclado, descarte e recuperação de versão", async ({
  page,
}) => {
  await fixtures(page);
  let version = 1,
    mode = "conflict",
    writes = 0;
  await page.route(`**/api/medicos/${doctor.id}`, async (r) => {
    if (r.request().method() === "GET") {
      if (mode === "read-error")
        return r.fulfill({ status: 503, json: { code: "ERRO_INTERNO" } });
      return r.fulfill({ json: { ...doctor, version: 3 } });
    }
    writes++;
    const payload = r.request().postDataJSON();
    if (mode === "conflict")
      return r.fulfill({ status: 409, json: { code: "VERSAO_DESATUALIZADA" } });
    expect(payload.expectedVersion).toBe(version);
    await new Promise((resolve) => setTimeout(resolve, 200));
    return r.fulfill({ json: { ...doctor, ...payload, version: 4 } });
  });
  await login(page, "profissionais");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.locator("#doctor-name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#doctor-name")).toBeFocused();
  await expect(page.locator("#doctor-specialties-error")).toContainText(
    "ao menos",
  );
  await page.locator(".record-option").click();
  await page.locator("#doctor-name").fill("Edição preservada");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Novo médico", exact: true }).click();
  await expect(page.locator("#doctor-name")).toHaveValue("Edição preservada");
  const toggle = page.locator("hlm-toggle-group button");
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Configuração alterada", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#doctor-name")).toHaveValue("Edição preservada");
  await expect(
    page.getByRole("button", { name: "Salvar alterações", exact: true }),
  ).toBeDisabled();
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Carregar versão atual" }).click();
  await expect(page.locator("#doctor-name")).toHaveValue("Edição preservada");
  mode = "read-error";
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Carregar versão atual" }).click();
  await expect(
    page.getByText("Não foi possível carregar a versão atual.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Salvar alterações", exact: true }),
  ).toBeDisabled();
  mode = "save";
  version = 3;
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Carregar versão atual" }).click();
  await expect(page.locator("#doctor-name")).toHaveValue(doctor.nome);
  await page.locator("#doctor-name").fill("Edição atualizada");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.locator("#doctor-name")).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Alterações salvas", exact: true }),
  ).toBeVisible();
  expect(writes).toBe(2);
});

test("admin: unidade e consultório mantêm rascunhos independentes e recusa por reservas", async ({
  page,
}) => {
  await fixtures(page);
  let units = 0,
    rooms = 0;
  await page.route(`**/api/unidades/${unit.id}`, (r) => {
    units++;
    return r.fulfill({
      json: { ...unit, ...r.request().postDataJSON(), version: 2 },
    });
  });
  await page.route(`**/api/consultorios/${room.id}`, (r) => {
    rooms++;
    return r.fulfill({
      status: 409,
      json: { code: "CONFIGURACAO_COM_RESERVAS" },
    });
  });
  await login(page);
  await page.locator(".record-panel .record-option").click();
  await page.locator("#unit-name").fill("Unidade editada");
  await page.getByRole("button", { name: /Consultório sintético/ }).click();
  await page.locator("#room-name").fill("Consultório editado");
  await page
    .getByRole("button", { name: "Salvar unidade", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Alterações salvas", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#room-name")).toHaveValue("Consultório editado");
  await page.locator("#room-active").selectOption("false");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Salvar consultório" }).click();
  expect(rooms).toBe(0);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Salvar consultório" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Alteração bloqueada por reservas",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Alterações salvas", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("#room-name")).toHaveValue("Consultório editado");
  expect(units).toBe(1);
  expect(rooms).toBe(1);
});

test("admin: edição de horário preserva inatividade, domingo e fim da vigência; novo limpa escolhas", async ({
  page,
}) => {
  await fixtures(page);
  let writes = 0;
  await page.route(`**/api/regras-agenda/${rule.id}`, (r) => {
    writes++;
    const body = r.request().postDataJSON();
    expect(body.ativo).toBe(false);
    expect(body.vigenteAte).toBe(rule.vigenteAte);
    expect(body.diaSemana).toBe(7);
    expect(body.expectedVersion).toBe(1);
    return r.fulfill({ json: { ...rule, version: 2 } });
  });
  await login(page, "agenda");
  await page.locator(".record-option").click();
  await expect(page.locator("#rule-doctor")).toBeDisabled();
  await page.locator("#rule-duration").fill("15");
  await page
    .getByRole("button", { name: "Salvar horário", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Alterações salvas", exact: true }),
  ).toBeVisible();
  expect(writes).toBe(1);
  await page.getByRole("button", { name: "Novo horário", exact: true }).click();
  await expect(page.locator("#rule-doctor")).toHaveValue("");
  await expect(page.locator("#rule-valid-until")).toHaveValue("");
  await page
    .getByRole("button", { name: "Salvar horário", exact: true })
    .click();
  await expect(page.locator("#rule-doctor")).toBeFocused();
  await expect(page.locator("#rule-doctor")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.locator("#rule-doctor").selectOption(doctor.id);
  await expect(page.locator("#rule-specialty option")).toHaveCount(2);
});

test("admin: bloqueio valida período e vincula erro retornado pelo servidor", async ({
  page,
}) => {
  await fixtures(page);
  let writes = 0;
  await page.route("**/api/bloqueios-agenda", (r) => {
    writes++;
    return r.fulfill({
      status: 400,
      json: {
        code: "VALIDACAO",
        fieldErrors: [{ field: "fim", message: "Revise o fim do período." }],
      },
    });
  });
  await login(page, "bloqueios");
  await page
    .getByRole("button", { name: "Salvar bloqueio", exact: true })
    .click();
  await expect(page.locator("#block-doctor")).toBeFocused();
  await page.locator("#block-doctor").selectOption(doctor.id);
  await page.locator("#block-start").fill("2031-11-05T10:00");
  await page.locator("#block-end").fill("2031-11-05T09:00");
  await page
    .getByRole("button", { name: "Salvar bloqueio", exact: true })
    .click();
  await expect(page.locator("#block-end-error")).toContainText("posterior");
  expect(writes).toBe(0);
  await page.locator("#block-end").fill("2031-11-05T11:00");
  await page
    .getByRole("button", { name: "Salvar bloqueio", exact: true })
    .click();
  await expect(page.locator("#block-end-error")).toContainText("Revise o fim");
  await expect(page.locator("#block-end")).toHaveAttribute(
    "aria-describedby",
    "block-end-error",
  );
});

test("admin: especialidade exige nome e permite cancelar desativação", async ({
  page,
}) => {
  await fixtures(page);
  let writes = 0;
  await page.route(`**/api/especialidades/${specialty.id}`, (r) => {
    writes++;
    return r.fulfill({ json: { ...specialty, ativo: false, version: 2 } });
  });
  await login(page, "especialidades");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator("#specialty-name")).toBeFocused();
  await page.locator(".record-option").click();
  await page.locator("#specialty-active").selectOption("false");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  expect(writes).toBe(0);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Alterações salvas", exact: true }),
  ).toBeVisible();
  expect(writes).toBe(1);
});

test("admin: clínica normaliza texto salvo e preserva formulário no conflito", async ({
  page,
}) => {
  let data = {
    id: "clinic60",
    nome: "Clínica sintética",
    timeZone: "America/Belem",
    ativo: true,
    version: 1,
  };
  let conflict = false;
  await page.route("**/api/clinica", (r) => {
    if (r.request().method() === "GET") return r.fulfill({ json: data });
    if (conflict)
      return r.fulfill({ status: 409, json: { code: "VERSAO_DESATUALIZADA" } });
    data = { ...data, ...r.request().postDataJSON(), version: 2 };
    return r.fulfill({ json: data });
  });
  await login(page, "clinica");
  await page.locator("#clinic-name").fill("  Clínica atualizada  ");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.locator("#clinic-name")).toHaveValue("Clínica atualizada");
  await expect(
    page.getByRole("button", { name: "Salvar alterações", exact: true }),
  ).toBeDisabled();
  conflict = true;
  await page.locator("#clinic-name").fill("Edição mantida");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.locator("#clinic-name")).toHaveValue("Edição mantida");
  await expect(
    page.getByRole("button", { name: "Salvar alterações", exact: true }),
  ).toBeDisabled();
});

test("admin: erro regional recuperável, validação visível, painel baixo e movimento reduzido", async ({
  page,
}, info) => {
  await fixtures(page);
  let phase = "loading",
    release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/unidades?*", async (r) => {
    if (phase === "loading") await pending;
    if (phase === "error") return r.abort("failed");
    return r.fulfill({
      json: { items: [], page: 0, size: 100, totalElements: 0 },
    });
  });
  await page.setViewportSize({ width: 1024, height: 500 });
  await login(page);
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  await expect(page.locator("#unit-name")).toBeEditable();
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
    page.getByRole("heading", { name: "Nenhuma unidade", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Salvar unidade", exact: true })
    .click();
  await expect(page.locator("#unit-name-error")).toBeVisible();
  await expect(page.locator("#unit-name")).toBeFocused();
  expect(
    await page
      .locator("app-admin-structure")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("medflow-page-enter");
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await page
    .locator("app-admin-structure")
    .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
  expect(duration).toBeLessThanOrEqual(0.00001);
  const exit = page.getByRole("button", { name: "Sair", exact: true });
  const box = await exit.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(500);
  await page.screenshot({
    path: info.outputPath("low-height-validation.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 320, height: 720 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
