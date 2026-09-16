import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { describe, expect, it } from "vitest";

import { IdentityService } from "../../auth/identity.service";
import { PatientJourneyComponent } from "./patient-journey.component";

describe("PatientJourneyComponent", () => {
  it("exibe a busca de horários e não apresenta campos clínicos no histórico", () => {
    TestBed.configureTestingModule({
      imports: [PatientJourneyComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: IdentityService,
          useValue: { identity: { value: () => ({ timeZone: "America/Belem" }) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(PatientJourneyComponent);
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http.match(() => true).forEach((request) => {
      if (request.request.url.endsWith("/unidades")) request.flush({ items: [], page: 0, size: 100, totalElements: 0 });
      else if (request.request.url.endsWith("/especialidades")) request.flush({ items: [], page: 0, size: 100, totalElements: 0 });
      else if (request.request.url.endsWith("/medicos")) request.flush({ items: [], page: 0, size: 100, totalElements: 0 });
      else request.flush({ items: [], page: 0, size: 20, totalElements: 0 });
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("Encontrar horário");
    expect(text).toContain("Histórico de atendimentos");
    expect(text).not.toContain("Resumo de anamnese");
    http.verify();
  });
});
