import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, provideRouter } from "@angular/router";
import { of } from "rxjs";
import { describe, expect, it } from "vitest";
import { IdentityService } from "../../auth/identity.service";
import { DoctorApi } from "./doctor.api";
import { DoctorCareComponent } from "./doctor-care.component";
import { DoctorWorkspace } from "./doctor.models";

const workspace: DoctorWorkspace = {
  agendamento: {
    id: "appointment-1",
    version: 3,
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
  },
  atendimento: {
    id: "care-1",
    agendamentoId: "appointment-1",
    version: 2,
    iniciadoEm: "2026-09-16T14:00:00Z",
    finalizadoEm: null,
    registroClinico: {
      queixaPrincipal: "Dor",
      resumoAnamnese: "Resumo",
      conduta: "Conduta",
      observacoes: "",
    },
  },
};

describe("DoctorCareComponent", () => {
  function setup(): {
    fixture: ComponentFixture<DoctorCareComponent>;
    http: HttpTestingController;
  } {
    const api = {
      workspace: () => "/api/atendimentos/care-1",
      history: () => "/api/medico/pacientes/patient-1/historico",
      save: () => of(workspace),
      finish: () => of(workspace),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([["id", "care-1"]]) } },
        },
        {
          provide: IdentityService,
          useValue: {
            identity: { value: () => ({ timeZone: "America/Belem" }) },
          },
        },
      ],
    });
    TestBed.overrideComponent(DoctorCareComponent, {
      set: { providers: [{ provide: DoctorApi, useValue: api }] },
    });
    const fixture = TestBed.createComponent(DoctorCareComponent);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  it("prioriza o estado de erro contextual quando o atendimento não existe", async () => {
    const { fixture, http } = setup();
    http
      .expectOne("/api/atendimentos/care-1")
      .flush(
        { code: "RECURSO_NAO_ENCONTRADO" },
        { status: 404, statusText: "Not found" },
      );
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      "Atendimento não encontrado",
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      "Carregando atendimento",
    );
  });

  it("descreve o cabeçalho como finalizado e busca histórico somente quando o Sheet abre", async () => {
    const { fixture, http } = setup();
    const completed = {
      ...workspace,
      atendimento: {
        ...workspace.atendimento,
        finalizadoEm: "2026-09-16T15:00:00Z",
      },
    };
    http.expectOne("/api/atendimentos/care-1").flush(completed);
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      "Atendimento finalizado",
    );
    (fixture.componentInstance as any).onHistorySheetState("open");
    await Promise.resolve();
    fixture.detectChanges();
    http
      .expectOne("/api/medico/pacientes/patient-1/historico")
      .flush({ items: [], page: 0, size: 20, totalElements: 0 });
    http.verify();
  });
});
