import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";

import { routes } from "./app.routes";

describe("application routes", () => {
  it("carrega a jornada do paciente diretamente, sem o shell operacional", () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const router = TestBed.inject(Router);
    const patient = router.config.find(
      (route) => route.path === "workspace/patient",
    );

    expect(
      router.config.find((route) => route.path === "**")?.loadComponent,
    ).toBeTruthy();
    expect(patient?.canActivate?.length).toBeTruthy();
    expect(patient?.children?.map((route) => route.path)).toEqual(
      expect.arrayContaining(["consultas", "agendar", "historico"]),
    );
  });

  it("carrega a jornada médica em composição própria e protege o atendimento com saída segura", () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const doctor = TestBed.inject(Router).config.find(
      (route) => route.path === "workspace/doctor",
    );
    const care = doctor?.children?.find(
      (route) => route.path === "atendimentos/:id",
    );

    expect(doctor?.canActivate?.length).toBeTruthy();
    expect(doctor?.children?.map((route) => route.path)).toEqual(
      expect.arrayContaining(["triagem", "atendimentos/:id"]),
    );
    expect(care?.canDeactivate?.length).toBeTruthy();
  });

  it("carrega os seis destinos reais da configuração administrativa", () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const admin = TestBed.inject(Router).config.find(
      (route) => route.path === "workspace/admin",
    );
    expect(admin?.canActivate?.length).toBeTruthy();
    expect(admin?.children?.map((route) => route.path)).toEqual(
      expect.arrayContaining([
        "clinica",
        "estrutura",
        "profissionais",
        "especialidades",
        "agenda",
        "bloqueios",
      ]),
    );
  });
});
