package br.com.medflow.scheduling.application;

import br.com.medflow.clinic.application.FutureAppointmentGuard;
import br.com.medflow.common.http.BusinessConflictException;
import br.com.medflow.scheduling.persistence.AgendamentoRepository;
import java.time.Clock;
import java.util.Collection;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Implementa as verificações de reserva mantendo clinic independente de scheduling. */
@Component
public class SchedulingFutureAppointmentGuard implements FutureAppointmentGuard {

  private final AgendamentoRepository agendamentos;
  private final Clock clock;

  public SchedulingFutureAppointmentGuard(AgendamentoRepository agendamentos, Clock clock) {
    this.agendamentos = agendamentos;
    this.clock = clock;
  }

  @Override
  public void assertClinicCanChangeAvailability(UUID clinicaId) {
    rejectIf(agendamentos.existsFutureActiveByClinic(clinicaId, clock.instant()));
  }

  @Override
  public void assertUnitCanBeDeactivated(UUID unidadeId) {
    rejectIf(agendamentos.existsFutureActiveByUnit(unidadeId, clock.instant()));
  }

  @Override
  public void assertRoomCanBeDeactivated(UUID consultorioId) {
    rejectIf(agendamentos.existsFutureActiveByRoom(consultorioId, clock.instant()));
  }

  @Override
  public void assertSpecialtyCanBeDeactivated(UUID especialidadeId) {
    rejectIf(agendamentos.existsFutureActiveBySpecialty(especialidadeId, clock.instant()));
  }

  @Override
  public void assertDoctorCanBeDeactivated(UUID medicoId) {
    rejectIf(agendamentos.existsFutureActiveByDoctor(medicoId, clock.instant()));
  }

  @Override
  public void assertDoctorSpecialtiesCanBeRemoved(
      UUID medicoId, Collection<UUID> especialidadeIds) {
    if (!especialidadeIds.isEmpty()) {
      rejectIf(agendamentos.existsFutureActiveByDoctorAndSpecialties(
          medicoId, especialidadeIds, clock.instant()));
    }
  }

  private static void rejectIf(boolean hasReservations) {
    if (hasReservations) {
      throw new BusinessConflictException(
          "CONFIGURACAO_COM_RESERVAS", "A alteração invalidaria agendamentos futuros.");
    }
  }
}
