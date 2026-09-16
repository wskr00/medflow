import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { describe, expect, it, vi } from "vitest";
import { IdentityService } from "../../auth/identity.service";
import { PatientBookingComponent } from "./patient-booking.component";

describe("PatientBookingComponent", () => {
  it("mantém o conflito de horário visível na etapa de horários após recarregar", () => {
    TestBed.configureTestingModule({ imports: [PatientBookingComponent], providers: [provideHttpClient(), provideHttpClientTesting(), { provide: IdentityService, useValue: { identity: { value: () => ({ timeZone: "America/Belem" }) } } }] });
    const fixture = TestBed.createComponent(PatientBookingComponent); fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.match((request) => request.method === "GET").forEach((request) => request.flush({ items: [], page: 0, size: 100, totalElements: 0 }));
    const component = fixture.componentInstance as unknown as { model: { set(value: { specialtyId: string; unitId: string; doctorId: string }): void }; stage: { set(value: number): void; (): number }; selected: { set(value: unknown): void; (): unknown }; problem: { (): { code: string } | null }; availability: { reload(): void }; confirm(): void };
    component.model.set({ specialtyId: "specialty", unitId: "unit", doctorId: "" }); component.stage.set(2);
    fixture.detectChanges();
    http.expectOne((request) => request.url.includes("/disponibilidades")).flush({ items: [], timeZone: "America/Belem" });
    const reload = vi.spyOn(component.availability, "reload");
    component.selected.set({ regraAgendaId: "rule", inicio: "2026-09-18T10:00:00-03:00" }); component.confirm();
    http.expectOne("/api/agendamentos").flush({ code: "HORARIO_INDISPONIVEL" }, { status: 409, statusText: "Conflict" });
    expect(component.stage()).toBe(2); expect(component.selected()).toBeNull(); expect(component.problem()?.code).toBe("HORARIO_INDISPONIVEL"); expect(reload).toHaveBeenCalledOnce();
    http.verify();
  });
});
