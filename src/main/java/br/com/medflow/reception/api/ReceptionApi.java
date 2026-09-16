package br.com.medflow.reception.api;

import br.com.medflow.reception.application.ReceptionService;
import br.com.medflow.scheduling.domain.StatusAgendamento;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;

final class ReceptionApi {
  private ReceptionApi() { }

  static AppointmentResponse appointment(ReceptionService.OperationalAppointment value) {
    return new AppointmentResponse(value.id(), value.version(), value.inicio(), value.fim(),
        value.status(), value.checkInEm(), named(value.medico()), named(value.especialidade()),
        named(value.unidade()), named(value.consultorio()), named(value.paciente()),
        value.pendenteDeDiaAnterior());
  }

  static PageResponse<AppointmentResponse> page(Page<ReceptionService.OperationalAppointment> source) {
    return new PageResponse<>(source.getContent().stream().map(ReceptionApi::appointment).toList(),
        source.getNumber(), source.getSize(), source.getTotalElements());
  }

  private static NamedResponse named(ReceptionService.NamedResource value) {
    return new NamedResponse(value.id(), value.nome());
  }

  record NamedResponse(UUID id, String nome) { }

  record AppointmentResponse(UUID id, long version, OffsetDateTime inicio,
      OffsetDateTime fim, StatusAgendamento status, OffsetDateTime checkInEm,
      NamedResponse medico, NamedResponse especialidade, NamedResponse unidade,
      NamedResponse consultorio, NamedResponse paciente, boolean pendenteDeDiaAnterior) { }

  record PageResponse<T>(List<T> items, int page, int size, long totalElements) { }
}
