import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";
import { ReceptionApi, receptionIssue } from "./reception.api";

describe("ReceptionApi", () => {
  it("mantém filtros explícitos e paginação na agenda", () => {
    TestBed.configureTestingModule({ providers: [ReceptionApi, provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(ReceptionApi);
    expect(api.agenda({ data: "2026-09-16", unidadeId: "unit-1", status: "AGENDADA", page: 2, size: 20 }))
      .toContain("/recepcao/agenda?data=2026-09-16&unidadeId=unit-1&status=AGENDADA&page=2&size=20");
  });

  it("envia expectedVersion uma única vez no check-in", () => {
    TestBed.configureTestingModule({ providers: [ReceptionApi, provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(ReceptionApi);
    const http = TestBed.inject(HttpTestingController);
    api.checkIn("appointment-1", 7).subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith("/agendamentos/appointment-1/check-in"));
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual({ expectedVersion: 7 });
    request.flush({});
    http.verify();
  });

  it("traduz conflito de check-in repetido para recuperação contextual", () => {
    const issue = receptionIssue({ status: 409, error: { code: "CHECKIN_JA_REALIZADO" } });
    expect(issue.title).toBe("Chegada já registrada");
    expect(issue.conflict).toBe(true);
  });
});
