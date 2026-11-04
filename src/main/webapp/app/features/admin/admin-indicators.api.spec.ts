import { provideHttpClient, HttpErrorResponse } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";
import { AdminIndicatorsApi, indicatorIssue } from "./admin-indicators.api";
import { Unit } from "./admin.models";

describe("API de indicadores administrativos", () => {
  it("lê todas as páginas do catálogo, incluindo cadastros inativos", () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AdminIndicatorsApi,
      ],
    });
    const http = TestBed.inject(HttpTestingController),
      api = TestBed.inject(AdminIndicatorsApi);
    let result: readonly Unit[] | undefined;
    api.catalog<Unit>("unidades").subscribe((value) => (result = value));
    const first = http.expectOne(
      (request) =>
        request.url === "/api/unidades" && request.params.get("page") === "0",
    );
    expect(first.request.params.get("incluirInativas")).toBe("true");
    first.flush({
      items: [{ id: "old", ativo: false }],
      page: 0,
      size: 1,
      totalElements: 2,
    });
    expect(result).toBeUndefined();
    http
      .expectOne((request) => request.params.get("page") === "1")
      .flush({
        items: [{ id: "new", ativo: true }],
        page: 1,
        size: 1,
        totalElements: 2,
      });
    expect(result?.map((item) => item.id)).toEqual(["old", "new"]);
    http.verify();
  });
  it("envia somente os filtros contratuais para a API agregada", () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), AdminIndicatorsApi],
    });
    const url = TestBed.inject(AdminIndicatorsApi).url({
      inicio: "2026-11-01",
      fim: "2026-11-04",
      unidadeId: "unit",
      especialidadeId: "specialty",
    });
    expect(url).toBe(
      "/api/admin/indicadores?inicio=2026-11-01&fim=2026-11-04&unidadeId=unit&especialidadeId=specialty",
    );
    expect(url).not.toContain("clinicaId");
  });
  it("distingue acesso negado de falha recuperável, sem resultado zero fictício", () => {
    expect(indicatorIssue(new HttpErrorResponse({ status: 403 })).denied).toBe(
      true,
    );
    expect(indicatorIssue(new HttpErrorResponse({ status: 503 })).denied).toBe(
      false,
    );
    expect(
      indicatorIssue(new HttpErrorResponse({ status: 0 })).title,
    ).toContain("Não foi possível carregar");
  });
});
