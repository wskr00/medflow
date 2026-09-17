import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { describe, expect, it } from "vitest";
import { IdentityService } from "../../auth/identity.service";
import { DoctorApi } from "./doctor.api";
import { DoctorTriageComponent } from "./doctor-triage.component";

const resumable = {
  id: "appointment-1",
  version: 2,
  inicio: "2026-09-16T14:00:00Z",
  fim: "2026-09-16T14:30:00Z",
  status: "EM_ATENDIMENTO",
  medico: { id: "doctor-1", nome: "Dra. Ana" },
  especialidade: { id: "specialty-1", nome: "Clínica" },
  unidade: { id: "unit-1", nome: "Centro" },
  consultorio: { id: "room-1", nome: "Sala 2" },
  paciente: { id: "patient-1", nome: "Joana" },
  atendimentoId: "care-1",
  allowedActions: { canStart: false, canResume: true },
};

describe("DoctorTriageComponent", () => {
  it("oferece retomada por link de rota quando o atendimento já existe", async () => {
    const api = {
      agenda: () => "/api/medico/agenda",
      queue: () => "/api/medico/fila",
      start: () => {
        throw new Error("não deve iniciar outro atendimento");
      },
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: IdentityService,
          useValue: {
            identity: { value: () => ({ timeZone: "America/Belem" }) },
          },
        },
      ],
    });
    TestBed.overrideComponent(DoctorTriageComponent, {
      set: { providers: [{ provide: DoctorApi, useValue: api }] },
    });
    const fixture = TestBed.createComponent(DoctorTriageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.startsWith("/api/medico/agenda"))
      .flush({ items: [resumable], page: 0, size: 30, totalElements: 1 });
    http
      .expectOne((request) => request.url.startsWith("/api/medico/fila"))
      .flush({ items: [resumable], page: 0, size: 20, totalElements: 1 });
    await Promise.resolve();
    fixture.detectChanges();
    const links = [...fixture.nativeElement.querySelectorAll("a")].filter(
      (element: HTMLAnchorElement) => element.textContent?.includes("Retomar"),
    );
    expect(links.length).toBeGreaterThan(0);
    expect(fixture.nativeElement.textContent).not.toContain(
      "Iniciar atendimento",
    );
    http.verify();
  });
});
