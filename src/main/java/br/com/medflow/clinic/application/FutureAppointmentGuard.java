package br.com.medflow.clinic.application;

import java.util.Collection;
import java.util.UUID;

/** Porta do módulo clinic para preservar reservas sem depender do módulo scheduling. */
public interface FutureAppointmentGuard {
  void assertClinicCanChangeAvailability(UUID clinicaId);
  void assertUnitCanBeDeactivated(UUID unidadeId);
  void assertRoomCanBeDeactivated(UUID consultorioId);
  void assertSpecialtyCanBeDeactivated(UUID especialidadeId);
  void assertDoctorCanBeDeactivated(UUID medicoId);
  void assertDoctorSpecialtiesCanBeRemoved(UUID medicoId, Collection<UUID> especialidadeIds);
}
