import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import Keycloak from "keycloak-js";
import { describe, expect, it, vi } from "vitest";
import { DailyCountChart } from "../../shared/ui/daily-count-chart";
import { DoctorIndicators } from "./doctor-indicators";

describe("Minha atividade", () => {
  it("lê somente a API do médico e mantém populações, média ponderada e rascunho separados", async () => {
    TestBed.configureTestingModule({
      imports: [DoctorIndicators],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: {} },
      ],
    });
    TestBed.overrideComponent(DailyCountChart, {
      set: { template: "<p>{{title()}}</p>" },
    });
    const fixture = TestBed.createComponent(DoctorIndicators),
      http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne("/api/me").flush({ timeZone: "America/Belem" });
    const request = await vi.waitFor(() => {
      fixture.detectChanges();
      return http.expectOne((req) =>
        req.url.startsWith("/api/medico/indicadores?"),
      );
    });
    const query = new URL(request.request.url, "http://local").searchParams;
    expect([...query.keys()]).toEqual(["inicio", "fim"]);
    request.flush({
      inicio: query.get("inicio"),
      fim: query.get("fim"),
      timeZone: "America/Belem",
      paciente: "DADO_RESTRITO",
      consultasPorDataAgendada: {
        totalConsultas: 9,
        agendadas: 4,
        emEspera: 1,
        emAtendimento: 0,
        finalizadas: 3,
        canceladas: 1,
        porDia: [],
      },
      finalizacoesPorDataReal: {
        totalFinalizadas: 4,
        duracaoMediaSegundos: 1500,
        porDia: [
          {
            data: query.get("inicio"),
            totalFinalizadas: 1,
            duracaoMediaSegundos: 600,
          },
          {
            data: query.get("fim"),
            totalFinalizadas: 3,
            duracaoMediaSegundos: 1800,
          },
        ],
      },
    });
    await fixture.whenStable();
    fixture.detectChanges();
    for (const [id, value] of [
      ["activity-scheduled", "9"],
      ["activity-state-done", "3"],
      ["activity-completed", "4"],
      ["activity-average", "25 min"],
    ])
      expect(
        fixture.nativeElement
          .querySelector(`[data-testid=${id}]`)
          .textContent.trim(),
      ).toBe(value);
    expect(fixture.nativeElement.textContent).not.toContain("DADO_RESTRITO");
    const context =
      fixture.nativeElement.querySelector(".applied-context").textContent;
    const preset = fixture.nativeElement.querySelector(
      "#activity-preset",
    ) as HTMLSelectElement;
    preset.value = "1";
    preset.dispatchEvent(new Event("change", { bubbles: true }));
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector(".applied-context").textContent,
    ).toBe(context);
    expect(fixture.nativeElement.textContent).toContain(
      "Alterações de período ainda não aplicadas",
    );
    http.expectNone((req) =>
      /admin|agenda|fila|atendimentos|clinica/.test(req.url),
    );
    http.verify();
  });
});
