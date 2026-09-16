import { HttpErrorResponse, provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";

import { PatientAppointmentsApi, patientApiIssue } from "./patient-appointments.api";

describe("PatientAppointmentsApi", () => {
  it("percorre todas as páginas de catálogo antes de disponibilizar opções", () => {
    TestBed.configureTestingModule({
      providers: [PatientAppointmentsApi, provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(PatientAppointmentsApi);
    const http = TestBed.inject(HttpTestingController);

    const requests = http.match((request) => request.method === "GET");
    const units = requests.find((request) => request.request.url.includes("/unidades"));
    expect(units?.request.urlWithParams).toContain("page=0");
    expect(units?.request.urlWithParams).toContain("size=100");
    units?.flush({
      items: [{ id: "unit-1", nome: "Centro" }],
      page: 0,
      size: 100,
      totalElements: 101,
    });

    http.expectOne((request) =>
      request.url.includes("/unidades") && request.urlWithParams.includes("page=1") && request.urlWithParams.includes("size=100"),
    ).flush({
      items: [{ id: "unit-2", nome: "Norte" }],
      page: 1,
      size: 100,
      totalElements: 101,
    });

    for (const request of requests.filter((request) => request !== units)) {
      if (request.request.url.includes("/especialidades")) {
        request.flush({ items: [], page: 0, size: 100, totalElements: 0 });
      } else if (request.request.url.includes("/medicos")) {
        request.flush({ items: [], page: 0, size: 100, totalElements: 0 });
      } else {
        request.flush({ items: [], page: 0, size: 20, totalElements: 0 });
      }
    }

    expect(api.units().items.map((item) => item.id)).toEqual(["unit-1", "unit-2"]);
    expect(api.units().loading).toBe(false);

    api.setAppointmentsPage(1);
    TestBed.tick();
    http.expectOne((request) =>
      request.url.includes("/me/agendamentos") && request.urlWithParams.includes("page=1"),
    ).flush({ items: [], page: 1, size: 20, totalElements: 40 });
    api.setHistoryPage(1);
    TestBed.tick();
    http.expectOne((request) =>
      request.url.includes("/me/historico") && request.urlWithParams.includes("page=1"),
    ).flush({ items: [], page: 1, size: 20, totalElements: 40 });
    expect(api.appointmentsPage()).toBe(1);
    expect(api.historyPage()).toBe(1);
    http.verify({ ignoreCancelled: true });
  });

  it("envia apenas os campos contratuais nas mutações", () => {
    TestBed.configureTestingModule({
      providers: [PatientAppointmentsApi, provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(PatientAppointmentsApi);
    const http = TestBed.inject(HttpTestingController);
    http.match((request) => request.method === "GET").forEach((request) =>
      request.flush({ items: [], page: 0, size: 100, totalElements: 0 }),
    );

    api.create({ regraAgendaId: "rule-1", inicio: "2026-10-10T10:00:00-03:00" }).subscribe();
    http.expectOne("/api/agendamentos").flush({});

    api.reschedule("appointment-1", { regraAgendaId: "rule-2", inicio: "2026-10-11T10:00:00-03:00" }, 4).subscribe();
    const reschedule = http.expectOne("/api/agendamentos/appointment-1/reagendamento");
    expect(reschedule.request.body).toEqual({ regraAgendaId: "rule-2", inicio: "2026-10-11T10:00:00-03:00", expectedVersion: 4 });
    reschedule.flush({});

    api.cancel("appointment-1", 4).subscribe();
    const cancel = http.expectOne("/api/agendamentos/appointment-1/cancelamento");
    expect(cancel.request.body).toEqual({ expectedVersion: 4 });
    cancel.flush({});
    http.verify();
  });

  it("normaliza erros sem código, inclusive respostas sem corpo", () => {
    expect(patientApiIssue(new HttpErrorResponse({ status: 404, error: null })).code)
      .toBe("RECURSO_NAO_ENCONTRADO");
    expect(patientApiIssue(new HttpErrorResponse({ status: 400, error: null })).code)
      .toBe("ENTRADA_INVALIDA");
    expect(patientApiIssue(new HttpErrorResponse({ status: 0, error: null })).code)
      .toBe("FALHA_DE_REDE");
  });
});
