import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { describe, expect, it, vi } from "vitest";
import { IdentityService } from "../../auth/identity.service";
import { PatientBookingComponent } from "./patient-booking.component";

describe("PatientBookingComponent", () => {
  it("avança pelo formulário real depois de escolher especialidade e unidade", async () => {
    TestBed.configureTestingModule({
      imports: [PatientBookingComponent],
      providers: [
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
    const fixture = TestBed.createComponent(PatientBookingComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const catalogs = http.match((request) => request.method === "GET");
    catalogs[0].flush({
      items: [{ id: "unit", nome: "Unidade Central" }],
      page: 0,
      size: 100,
      totalElements: 1,
    });
    catalogs[1].flush({
      items: [{ id: "specialty", nome: "Cardiologia" }],
      page: 0,
      size: 100,
      totalElements: 1,
    });
    catalogs[2].flush({ items: [], page: 0, size: 100, totalElements: 0 });
    await fixture.whenStable();
    fixture.detectChanges();
    for (const [id, value] of [
      ["specialty", "specialty"],
      ["unit", "unit"],
    ]) {
      const select = fixture.nativeElement.querySelector(
        `#${id}`,
      ) as HTMLSelectElement;
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    (
      fixture.nativeElement.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Horários disponíveis");
    http
      .match((request) => request.url.includes("/api/disponibilidades"))
      .forEach((request) =>
        request.flush({ items: [], timeZone: "America/Belem" }),
      );
    http.verify();
  });

  it("identifica visual e textualmente o horário selecionado", async () => {
    TestBed.configureTestingModule({
      imports: [PatientBookingComponent],
      providers: [
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
    const fixture = TestBed.createComponent(PatientBookingComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .match((request) => request.method === "GET")
      .forEach((request) =>
        request.flush({ items: [], page: 0, size: 100, totalElements: 0 }),
      );
    const component = fixture.componentInstance as unknown as {
      model: {
        set(value: {
          specialtyId: string;
          unitId: string;
          doctorId: string;
        }): void;
      };
      stage: { set(value: number): void };
    };
    component.model.set({
      specialtyId: "specialty",
      unitId: "unit",
      doctorId: "",
    });
    component.stage.set(2);
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.includes("/api/disponibilidades?"))
      .flush({
        timeZone: "America/Belem",
        items: [
          {
            regraAgendaId: "rule",
            inicio: "2026-09-18T10:00:00-03:00",
            fim: "2026-09-18T10:30:00-03:00",
            medico: { id: "doctor", nome: "Dra. Ana" },
            especialidade: { id: "specialty", nome: "Cardiologia" },
            unidade: { id: "unit", nome: "Centro" },
            consultorio: { id: "room", nome: "101" },
          },
        ],
      });
    http
      .expectOne((request) =>
        request.url.includes("/api/disponibilidades/datas?"),
      )
      .flush({ timeZone: "America/Belem", items: ["2026-09-18"] });
    await fixture.whenStable();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        '[aria-pressed="false"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Selecionado");
    expect(
      fixture.nativeElement.querySelector('[aria-pressed="true"]'),
    ).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(
      "O ponto indica um dia com horários disponíveis",
    );
    http.verify();
  });

  it("mantém o conflito de horário visível na etapa de horários após recarregar", () => {
    TestBed.configureTestingModule({
      imports: [PatientBookingComponent],
      providers: [
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
    const fixture = TestBed.createComponent(PatientBookingComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .match((request) => request.method === "GET")
      .forEach((request) =>
        request.flush({ items: [], page: 0, size: 100, totalElements: 0 }),
      );
    const component = fixture.componentInstance as unknown as {
      model: {
        set(value: {
          specialtyId: string;
          unitId: string;
          doctorId: string;
        }): void;
      };
      stage: { set(value: number): void; (): number };
      selected: { set(value: unknown): void; (): unknown };
      problem: { (): { code: string } | null };
      availability: { reload(): void };
      confirm(): void;
    };
    component.model.set({
      specialtyId: "specialty",
      unitId: "unit",
      doctorId: "",
    });
    component.stage.set(2);
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.includes("/api/disponibilidades?"))
      .flush({ items: [], timeZone: "America/Belem" });
    http
      .expectOne((request) =>
        request.url.includes("/api/disponibilidades/datas?"),
      )
      .flush({ items: [], timeZone: "America/Belem" });
    const reload = vi.spyOn(component.availability, "reload");
    const dateReload = vi.spyOn(
      (component as unknown as { availableDates: { reload(): void } })
        .availableDates,
      "reload",
    );
    component.selected.set({
      regraAgendaId: "rule",
      inicio: "2026-09-18T10:00:00-03:00",
    });
    component.confirm();
    http
      .expectOne("/api/agendamentos")
      .flush(
        { code: "HORARIO_INDISPONIVEL" },
        { status: 409, statusText: "Conflict" },
      );
    expect(component.stage()).toBe(2);
    expect(component.selected()).toBeNull();
    expect(component.problem()?.code).toBe("HORARIO_INDISPONIVEL");
    expect(reload).toHaveBeenCalledOnce();
    expect(dateReload).toHaveBeenCalledOnce();
    http.verify();
  });
});
