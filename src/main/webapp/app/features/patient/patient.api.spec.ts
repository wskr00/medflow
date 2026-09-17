import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";
import { PatientApi, patientIssue } from "./patient.api";

describe("PatientApi", () => {
  it("usa recorte e RSQL na listagem operacional", () => {
    TestBed.configureTestingModule({
      providers: [PatientApi, provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(PatientApi);
    expect(api.appointments("PAST", "status==FINALIZADA")).toContain(
      "recorte=PAST",
    );
    expect(
      decodeURIComponent(api.appointments("PAST", "status==FINALIZADA")),
    ).toContain("q=status==FINALIZADA");
  });
  it("monta o intervalo de dias disponíveis com os mesmos filtros da consulta", () => {
    TestBed.configureTestingModule({
      providers: [PatientApi, provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(PatientApi);
    const url = decodeURIComponent(
      api.availableDates(
        "2026-09-14",
        "2026-10-31",
        "unit",
        "specialty",
        "doctor",
      ),
    );
    expect(url).toContain("/disponibilidades/datas?");
    expect(url).toContain("dataDe=2026-09-14");
    expect(url).toContain("dataAte=2026-10-31");
    expect(url).toContain("medicoId=doctor");
  });
  it("envia somente a identidade do slot e versão exigida pelo contrato", () => {
    TestBed.configureTestingModule({
      providers: [PatientApi, provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(PatientApi);
    const http = TestBed.inject(HttpTestingController);
    api.create("rule", "2026-09-18T10:00:00-03:00").subscribe();
    expect(http.expectOne("/api/agendamentos").request.body).toEqual({
      regraAgendaId: "rule",
      inicio: "2026-09-18T10:00:00-03:00",
    });
    api.cancel("appointment", 3).subscribe();
    expect(
      http.expectOne("/api/agendamentos/appointment/cancelamento").request.body,
    ).toEqual({ expectedVersion: 3 });
    http.verify();
  });
  it("traduz 404 de reagendamento para uma orientação contextual", () => {
    expect(patientIssue({ status: 404, error: {} }).title).toBe(
      "Consulta não encontrada",
    );
  });
});
