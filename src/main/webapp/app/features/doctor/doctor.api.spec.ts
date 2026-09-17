import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";
import { DoctorApi, doctorIssue } from "./doctor.api";

describe("DoctorApi", () => {
  it("consulta agenda e fila no contexto da identidade médica", () => {
    TestBed.configureTestingModule({
      providers: [DoctorApi, provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(DoctorApi);
    expect(api.agenda({ data: "2026-09-16", page: 0, size: 30 })).toContain(
      "/medico/agenda?data=2026-09-16&page=0&size=30",
    );
    expect(api.queue({ page: 0, size: 20 })).toContain(
      "/medico/fila?page=0&size=20",
    );
  });

  it("mantém expectedVersion e os quatro campos no salvamento explícito", () => {
    TestBed.configureTestingModule({
      providers: [DoctorApi, provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(DoctorApi);
    const http = TestBed.inject(HttpTestingController);
    api
      .save("care-1", 4, {
        queixaPrincipal: "Dor",
        resumoAnamnese: "Resumo",
        conduta: "Conduta",
        observacoes: "",
      })
      .subscribe();
    const request = http.expectOne((candidate) =>
      candidate.url.endsWith("/atendimentos/care-1/registro-clinico"),
    );
    expect(request.request.method).toBe("PUT");
    expect(request.request.body).toEqual({
      expectedVersion: 4,
      queixaPrincipal: "Dor",
      resumoAnamnese: "Resumo",
      conduta: "Conduta",
      observacoes: "",
    });
    request.flush({});
    http.verify();
  });

  it("traduz conflito sem descartar a instrução de preservar o texto local", () => {
    const issue = doctorIssue({
      status: 409,
      error: { code: "VERSAO_DESATUALIZADA" },
    });
    expect(issue.conflict).toBe(true);
    expect(issue.description).toContain("texto local");
  });
});
