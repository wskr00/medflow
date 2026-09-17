import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";
import { AdminApi, adminIssue } from "./admin.api";

describe("AdminApi", () => {
  it("consulta listas administrativas incluindo inativos e filtros relacionais explícitos", () => {
    TestBed.configureTestingModule({
      providers: [AdminApi, provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(AdminApi);
    expect(api.list("unidades")).toContain(
      "/unidades?incluirInativas=true&page=0&size=100",
    );
    expect(api.rules({ medicoId: "doctor-1" })).toContain(
      "/regras-agenda?incluirInativas=true&page=0&size=100&medicoId=doctor-1",
    );
  });

  it("envia expectedVersion na atualização da clínica", () => {
    TestBed.configureTestingModule({
      providers: [AdminApi, provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(AdminApi);
    const http = TestBed.inject(HttpTestingController);
    api
      .putClinic({
        nome: "Clínica",
        timeZone: "America/Belem",
        ativo: true,
        version: 7,
      })
      .subscribe();
    const request = http.expectOne((candidate) =>
      candidate.url.endsWith("/clinica"),
    );
    expect(request.request.method).toBe("PUT");
    expect(request.request.body.expectedVersion).toBe(7);
    request.flush({});
    http.verify();
  });

  it("traduz conflito de reservas sem sugerir cancelamento automático", () => {
    const issue = adminIssue({
      status: 409,
      error: { code: "CONFLITO_DE_RESERVAS" },
    });
    expect(issue.conflict).toBe(true);
    expect(issue.description).toContain("reserva");
  });
});
