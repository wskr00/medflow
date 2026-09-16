import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { describe, expect, it, vi } from "vitest";

import { PatientAppointmentsApi } from "./patient-appointments.api";
import { PatientAppointmentsComponent } from "./patient-appointments.component";

describe("PatientAppointmentsComponent", () => {
  it("mantém o modal aberto, limpa a seleção e recarrega a oferta em conflito de horário", () => {
    TestBed.configureTestingModule({
      imports: [PatientAppointmentsComponent],
      providers: [PatientAppointmentsApi, provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PatientAppointmentsComponent);
    fixture.componentRef.setInput("timeZone", "America/Belem");
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.match((request) => request.method === "GET").forEach((request) =>
      request.flush({ items: [], page: 0, size: 100, totalElements: 0 }),
    );

    const component = fixture.componentInstance as unknown as {
      rescheduleTarget: { set(value: unknown): void };
      rescheduleDate: { set(value: string): void };
      rescheduleSlot: { set(value: unknown): void; (): unknown };
      rescheduleAvailability: { reload(): void };
      rescheduleIssue: { (): { code: string } | null };
      confirmReschedule(dialog: { close(): void }): void;
    };
    const appointment = {
      id: "appointment-1", version: 2, inicio: "2026-09-17T10:00:00-03:00", fim: "2026-09-17T10:30:00-03:00", status: "AGENDADA",
      checkInEm: null, medico: { id: "doctor", nome: "Dra. Ana" }, especialidade: { id: "specialty", nome: "Cardiologia" }, unidade: { id: "unit", nome: "Centro" }, consultorio: { id: "room", nome: "101" },
    };
    const slot = { regraAgendaId: "rule-1", medicoId: "doctor", especialidadeId: "specialty", consultorioId: "room", inicio: "2026-09-18T10:00:00-03:00", fim: "2026-09-18T10:30:00-03:00", medico: appointment.medico, especialidade: appointment.especialidade, unidade: appointment.unidade, consultorio: appointment.consultorio };
    component.rescheduleTarget.set(appointment);
    component.rescheduleDate.set("2026-09-18");
    fixture.detectChanges();
    http.expectOne((request) => request.url.includes("/agendamentos/appointment-1/disponibilidades"))
      .flush({ items: [slot], timeZone: "America/Belem" });
    component.rescheduleSlot.set(slot);
    const reload = vi.spyOn(component.rescheduleAvailability, "reload");
    const dialog = { close: vi.fn() };
    component.confirmReschedule(dialog);
    http.expectOne("/api/agendamentos/appointment-1/reagendamento").flush(
      { status: 409, code: "HORARIO_INDISPONIVEL", message: "ocupado", requestId: "request-1", fieldErrors: [] },
      { status: 409, statusText: "Conflict" },
    );

    expect(component.rescheduleSlot()).toBeNull();
    expect(component.rescheduleIssue()?.code).toBe("HORARIO_INDISPONIVEL");
    expect(dialog.close).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
    http.verify({ ignoreCancelled: true });
  });

  it("fecha o diálogo e limpa o alvo após cancelamento confirmado", () => {
    TestBed.configureTestingModule({
      imports: [PatientAppointmentsComponent],
      providers: [PatientAppointmentsApi, provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PatientAppointmentsComponent);
    fixture.componentRef.setInput("timeZone", "America/Belem");
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.match((request) => request.method === "GET").forEach((request) =>
      request.flush({ items: [], page: 0, size: 100, totalElements: 0 }),
    );
    const component = fixture.componentInstance as unknown as {
      cancellationTarget: { set(value: unknown): void; (): unknown };
      confirmCancellation(dialog: { close(): void }): void;
    };
    component.cancellationTarget.set({ id: "appointment-1", version: 2 });
    const dialog = { close: vi.fn() };
    component.confirmCancellation(dialog);
    const request = http.expectOne("/api/agendamentos/appointment-1/cancelamento");
    expect(request.request.body).toEqual({ expectedVersion: 2 });
    request.flush({});

    expect(dialog.close).toHaveBeenCalledOnce();
    expect(component.cancellationTarget()).toBeNull();
    http.verify({ ignoreCancelled: true });
  });
});
