package br.com.medflow.clinic.api;

import br.com.medflow.clinic.domain.Clinica;
import br.com.medflow.clinic.domain.Consultorio;
import br.com.medflow.clinic.domain.Especialidade;
import br.com.medflow.clinic.domain.Medico;
import br.com.medflow.clinic.domain.Unidade;
import br.com.medflow.scheduling.domain.BloqueioAgenda;
import br.com.medflow.scheduling.domain.RegraAgenda;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

final class ConfigurationApi {
  private ConfigurationApi() { }

  static ClinicResponse clinic(Clinica value) {
    return new ClinicResponse(value.id(), value.nome(), value.timeZone(), value.ativo(), value.version());
  }
  static UnidadeResponse unidade(Unidade value) {
    return new UnidadeResponse(value.id(), value.nome(), value.endereco(), value.ativo(), value.version());
  }
  static ConsultorioResponse consultorio(Consultorio value) {
    return new ConsultorioResponse(value.id(), value.unidade().id(), value.nome(), value.ativo(), value.version());
  }
  static EspecialidadeResponse especialidade(Especialidade value) {
    return new EspecialidadeResponse(value.id(), value.nome(), value.ativo(), value.version());
  }
  static MedicoResponse medico(Medico value) {
    return new MedicoResponse(value.id(), value.nome(), value.crmNumero(), value.crmUf(),
        value.especialidades().stream().map(Especialidade::id).toList(), value.ativo(), value.version());
  }
  static RegraResponse regra(RegraAgenda value) {
    return new RegraResponse(value.id(), value.medico().id(), value.especialidade().id(), value.consultorio().id(),
        value.diaSemana().getValue(), value.horaInicio(), value.horaFim(), value.duracaoMinutos(),
        value.vigenteDe(), value.vigenteAte(), value.ativo(), value.version());
  }
  static BloqueioResponse bloqueio(BloqueioAgenda value) {
    return new BloqueioResponse(value.id(), value.medico().id(), value.inicio(), value.fim(), value.ativo(), value.version());
  }

  record ClinicResponse(UUID id, String nome, String timeZone, boolean ativo, long version) { }
  record UnidadeResponse(UUID id, String nome, String endereco, boolean ativo, long version) { }
  record ConsultorioResponse(UUID id, UUID unidadeId, String nome, boolean ativo, long version) { }
  record EspecialidadeResponse(UUID id, String nome, boolean ativo, long version) { }
  record MedicoResponse(UUID id, String nome, String crmNumero, String crmUf, List<UUID> especialidadeIds,
      boolean ativo, long version) { }
  record RegraResponse(UUID id, UUID medicoId, UUID especialidadeId, UUID consultorioId, int diaSemana,
      LocalTime horaInicio, LocalTime horaFim, int duracaoMinutos, LocalDate vigenteDe, LocalDate vigenteAte,
      boolean ativo, long version) { }
  record BloqueioResponse(UUID id, UUID medicoId, Instant inicio, Instant fim, boolean ativo, long version) { }
  record PageResponse<T>(List<T> items, int page, int size, long totalElements) { }
}
