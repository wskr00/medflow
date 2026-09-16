package br.com.medflow.scheduling.api;

import br.com.medflow.scheduling.application.AppointmentService;
import br.com.medflow.scheduling.domain.StatusAgendamento;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;

final class SchedulingApi {
  private SchedulingApi() { }

  static AvailabilityResponse availability(AppointmentService.Availability value) {
    return new AvailabilityResponse(value.items().stream().map(slot -> new SlotResponse(
        slot.regraAgendaId(), slot.medicoId(), slot.especialidadeId(), slot.consultorioId(),
        slot.inicioComOffset(), slot.fimComOffset(), named(slot.medico()), named(slot.especialidade()),
        named(slot.unidade()), named(slot.consultorio()))).toList(), value.timeZone());
  }

  static PatientAppointmentResponse patient(AppointmentService.AppointmentView value) {
    return new PatientAppointmentResponse(value.id(), value.version(), value.inicio(), value.fim(),
        value.status(), value.checkInEm(), named(value.medico()), named(value.especialidade()),
        named(value.unidade()), named(value.consultorio()));
  }

  static ReceptionAppointmentResponse reception(AppointmentService.AppointmentView value) {
    return new ReceptionAppointmentResponse(value.id(), value.version(), value.inicio(), value.fim(),
        value.status(), value.checkInEm(), named(value.medico()), named(value.especialidade()),
        named(value.unidade()), named(value.consultorio()), named(value.paciente()));
  }

  static PageResponse<PatientAppointmentResponse> patientPage(
      Page<AppointmentService.AppointmentView> source) {
    return new PageResponse<>(source.getContent().stream().map(SchedulingApi::patient).toList(),
        source.getNumber(), source.getSize(), source.getTotalElements());
  }

  private static NamedResponse named(AppointmentService.NamedResource value) {
    return new NamedResponse(value.id(), value.nome());
  }

  record NamedResponse(UUID id, String nome) { }

  record SlotResponse(UUID regraAgendaId, UUID medicoId, UUID especialidadeId,
      UUID consultorioId, OffsetDateTime inicio, OffsetDateTime fim, NamedResponse medico,
      NamedResponse especialidade, NamedResponse unidade, NamedResponse consultorio) { }

  record AvailabilityResponse(List<SlotResponse> items, String timeZone) { }

  record PatientAppointmentResponse(UUID id, long version, OffsetDateTime inicio,
      OffsetDateTime fim, StatusAgendamento status, OffsetDateTime checkInEm,
      NamedResponse medico, NamedResponse especialidade, NamedResponse unidade,
      NamedResponse consultorio) { }

  record ReceptionAppointmentResponse(UUID id, long version, OffsetDateTime inicio,
      OffsetDateTime fim, StatusAgendamento status, OffsetDateTime checkInEm,
      NamedResponse medico, NamedResponse especialidade, NamedResponse unidade,
      NamedResponse consultorio, NamedResponse paciente) { }

  record PageResponse<T>(List<T> items, int page, int size, long totalElements) { }
}
