package br.com.medflow.care.api;

import br.com.medflow.care.application.CareService;
import br.com.medflow.scheduling.domain.StatusAgendamento;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;

final class CareApi {
  private CareApi() { }

  static AppointmentResponse appointment(CareService.OperationalAppointment value) {
    return new AppointmentResponse(value.id(), value.version(), value.inicio(), value.fim(),
        value.status(), value.checkInEm(), named(value.medico()), named(value.especialidade()),
        named(value.unidade()), named(value.consultorio()), named(value.paciente()));
  }

  static CareResponse care(CareService.CareView value) {
    return new CareResponse(value.id(), value.agendamentoId(), value.version(), value.iniciadoEm(),
        value.finalizadoEm(), clinicalRecord(value.registroClinico()));
  }

  static StartResponse start(CareService.StartResult value) {
    return new StartResponse(appointment(value.agendamento()), care(value.atendimento()));
  }

  static FinishResponse finish(CareService.FinishResult value) {
    return new FinishResponse(appointment(value.agendamento()), care(value.atendimento()));
  }

  static PatientHistoryResponse patientHistory(CareService.PatientHistoryItem value) {
    return new PatientHistoryResponse(value.id(), value.inicio(), value.fim(), value.status(),
        named(value.medico()), named(value.especialidade()), named(value.unidade()),
        named(value.consultorio()));
  }

  static DoctorHistoryResponse doctorHistory(CareService.DoctorHistoryItem value) {
    return new DoctorHistoryResponse(value.atendimentoId(), value.agendamentoId(), value.inicio(),
        value.fim(), value.iniciadoEm(), value.finalizadoEm(), named(value.paciente()),
        named(value.especialidade()), named(value.unidade()), named(value.consultorio()),
        clinicalRecord(value.registroClinico()));
  }

  static PageResponse<AppointmentResponse> appointmentPage(
      Page<CareService.OperationalAppointment> source) {
    return page(source.map(CareApi::appointment));
  }

  static PageResponse<PatientHistoryResponse> patientHistoryPage(
      Page<CareService.PatientHistoryItem> source) {
    return page(source.map(CareApi::patientHistory));
  }

  static PageResponse<DoctorHistoryResponse> doctorHistoryPage(
      Page<CareService.DoctorHistoryItem> source) {
    return page(source.map(CareApi::doctorHistory));
  }

  private static <T> PageResponse<T> page(Page<T> source) {
    return new PageResponse<>(source.getContent(), source.getNumber(), source.getSize(),
        source.getTotalElements());
  }

  private static NamedResponse named(CareService.NamedResource value) {
    return new NamedResponse(value.id(), value.nome());
  }

  private static ClinicalRecordResponse clinicalRecord(CareService.ClinicalRecord value) {
    return new ClinicalRecordResponse(value.queixaPrincipal(), value.resumoAnamnese(),
        value.conduta(), value.observacoes());
  }

  record NamedResponse(UUID id, String nome) { }

  record AppointmentResponse(UUID id, long version, OffsetDateTime inicio,
      OffsetDateTime fim, StatusAgendamento status, OffsetDateTime checkInEm,
      NamedResponse medico, NamedResponse especialidade, NamedResponse unidade,
      NamedResponse consultorio, NamedResponse paciente) { }

  record ClinicalRecordResponse(String queixaPrincipal, String resumoAnamnese,
      String conduta, String observacoes) { }

  record CareResponse(UUID id, UUID agendamentoId, long version,
      OffsetDateTime iniciadoEm, OffsetDateTime finalizadoEm,
      ClinicalRecordResponse registroClinico) { }

  record StartResponse(AppointmentResponse agendamento, CareResponse atendimento) { }

  record FinishResponse(AppointmentResponse agendamento, CareResponse atendimento) { }

  record PatientHistoryResponse(UUID id, OffsetDateTime inicio, OffsetDateTime fim,
      StatusAgendamento status, NamedResponse medico, NamedResponse especialidade,
      NamedResponse unidade, NamedResponse consultorio) { }

  record DoctorHistoryResponse(UUID atendimentoId, UUID agendamentoId,
      OffsetDateTime inicio, OffsetDateTime fim, OffsetDateTime iniciadoEm,
      OffsetDateTime finalizadoEm, NamedResponse paciente, NamedResponse especialidade,
      NamedResponse unidade, NamedResponse consultorio, ClinicalRecordResponse registroClinico) { }

  record PageResponse<T>(List<T> items, int page, int size, long totalElements) { }
}
