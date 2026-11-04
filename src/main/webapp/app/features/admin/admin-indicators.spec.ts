import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import Keycloak from "keycloak-js";
import { describe, expect, it, vi } from "vitest";
import { AdminIndicators } from "./admin-indicators";
import { DailyCountChart } from "../../shared/ui/daily-count-chart";

describe("Indicadores da Administração", () => {
  it("mantém as populações independentes e não renomeia resultados ao editar o rascunho", async () => {
    TestBed.configureTestingModule({
      imports: [AdminIndicators],
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
    const fixture = TestBed.createComponent(AdminIndicators),
      http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne("/api/clinica")
      .flush({ nome: "Clínica", timeZone: "America/Belem" });
    http
      .match((request) =>
        /^\/api\/(unidades|especialidades)$/.test(request.url),
      )
      .forEach((request) =>
        request.flush({ items: [], page: 0, size: 100, totalElements: 0 }),
      );
    fixture.detectChanges();
    const request = await vi.waitFor(() => {
      fixture.detectChanges();
      return http.expectOne((req) =>
        req.url.startsWith("/api/admin/indicadores?"),
      );
    });
    const query = new URL(request.request.url, "http://local").searchParams;
    request.flush({
      inicio: query.get("inicio"),
      fim: query.get("fim"),
      timeZone: "America/Belem",
      consultasPorDataAgendada: {
        totalConsultas: 9,
        agendadas: 4,
        emEspera: 1,
        emAtendimento: 0,
        finalizadas: 3,
        canceladas: 1,
        porDia: [],
        porUnidade: [],
        porEspecialidade: [],
      },
      finalizacoesPorDataReal: {
        totalFinalizadas: 5,
        porDia: [],
        porUnidade: [],
        porEspecialidade: [],
      },
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      fixture.nativeElement
        .querySelector("[data-testid=scheduled-total]")
        .textContent.trim(),
    ).toBe("9");
    expect(
      fixture.nativeElement
        .querySelector("[data-testid=scheduled-finalized]")
        .textContent.trim(),
    ).toBe("3");
    expect(
      fixture.nativeElement
        .querySelector("[data-testid=completed-total]")
        .textContent.trim(),
    ).toBe("5");
    const context =
      fixture.nativeElement.querySelector(".applied-context").textContent;
    const period = fixture.nativeElement.querySelector(
      "#indicators-period",
    ) as HTMLSelectElement;
    period.value = "1";
    period.dispatchEvent(new Event("change", { bubbles: true }));
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector(".applied-context").textContent,
    ).toBe(context);
    expect(fixture.nativeElement.textContent).toContain(
      "Alterações de filtro ainda não aplicadas",
    );
    http.expectNone((req) => req.url.includes("/api/admin/indicadores"));
    http.verify();
  });
});
