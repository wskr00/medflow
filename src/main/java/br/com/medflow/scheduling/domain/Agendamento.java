package br.com.medflow.scheduling.domain;

import br.com.medflow.clinic.domain.Clinica;
import br.com.medflow.clinic.domain.Consultorio;
import br.com.medflow.clinic.domain.Especialidade;
import br.com.medflow.clinic.domain.Medico;
import br.com.medflow.clinic.domain.Paciente;
import br.com.medflow.common.http.BusinessConflictException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;

/** Reserva confirmada. Seus vínculos são históricos e não são derivados novamente da regra. */
@Entity
@Table(name = "agendamento")
public class Agendamento {

  @Id @GeneratedValue private UUID id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "clinica_id") private Clinica clinica;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "paciente_id") private Paciente paciente;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "medico_id") private Medico medico;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "especialidade_id") private Especialidade especialidade;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "consultorio_id") private Consultorio consultorio;
  @Column(nullable = false) private Instant inicio;
  @Column(nullable = false) private Instant fim;
  @Enumerated(EnumType.STRING) @Column(nullable = false, length = 24) private StatusAgendamento status;
  @Column(name = "check_in_em") private Instant checkInEm;
  @Version private long version;

  protected Agendamento() { }

  public Agendamento(Clinica clinica, Paciente paciente, Medico medico,
      Especialidade especialidade, Consultorio consultorio, Instant inicio, Instant fim) {
    if (clinica == null || paciente == null || medico == null || especialidade == null
        || consultorio == null || inicio == null || fim == null || !inicio.isBefore(fim)) {
      throw new IllegalArgumentException("agendamento inválido");
    }
    this.clinica = clinica;
    this.paciente = paciente;
    this.medico = medico;
    this.especialidade = especialidade;
    this.consultorio = consultorio;
    this.inicio = inicio;
    this.fim = fim;
    this.status = StatusAgendamento.AGENDADA;
  }

  public UUID id() { return id; }
  public Clinica clinica() { return clinica; }
  public Paciente paciente() { return paciente; }
  public Medico medico() { return medico; }
  public Especialidade especialidade() { return especialidade; }
  public Consultorio consultorio() { return consultorio; }
  public Instant inicio() { return inicio; }
  public Instant fim() { return fim; }
  public StatusAgendamento status() { return status; }
  public Instant checkInEm() { return checkInEm; }
  public long version() { return version; }

  public boolean atual(Consultorio novoConsultorio, Instant novoInicio, Instant novoFim) {
    return consultorio.id().equals(novoConsultorio.id())
        && inicio.equals(novoInicio) && fim.equals(novoFim);
  }

  public void reagendar(Consultorio novoConsultorio, Instant novoInicio, Instant novoFim,
      Instant agora, long expectedVersion) {
    validarMutacao(agora, expectedVersion);
    if (!consultorio.unidade().id().equals(novoConsultorio.unidade().id())
        || novoInicio == null || novoFim == null || !novoInicio.isBefore(novoFim)) {
      throw new BusinessConflictException("HORARIO_INDISPONIVEL", "Este horário não está disponível.");
    }
    this.consultorio = novoConsultorio;
    this.inicio = novoInicio;
    this.fim = novoFim;
  }

  public void cancelar(Instant agora, long expectedVersion) {
    validarMutacao(agora, expectedVersion);
    status = StatusAgendamento.CANCELADA;
  }

  public void checkIn(Instant agora, ZoneId zone, long expectedVersion) {
    if (status == StatusAgendamento.EM_ESPERA && checkInEm != null) {
      throw new BusinessConflictException(
          "CHECKIN_JA_REALIZADO", "O check-in já foi realizado.");
    }
    if (version != expectedVersion) {
      throw new BusinessConflictException(
          "VERSAO_DESATUALIZADA", "O recurso foi alterado por outra operação.");
    }
    if (status != StatusAgendamento.AGENDADA
        || !inicio.atZone(zone).toLocalDate().equals(agora.atZone(zone).toLocalDate())) {
      throw new BusinessConflictException(
          "TRANSICAO_INVALIDA", "O agendamento não permite check-in neste momento.");
    }
    status = StatusAgendamento.EM_ESPERA;
    checkInEm = agora;
  }

  public void validarMutacao(Instant agora, long expectedVersion) {
    if (version != expectedVersion) {
      throw new BusinessConflictException(
          "VERSAO_DESATUALIZADA", "O recurso foi alterado por outra operação.");
    }
    if (status != StatusAgendamento.AGENDADA || !agora.isBefore(inicio)) {
      throw new BusinessConflictException(
          "TRANSICAO_INVALIDA", "O agendamento não permite esta operação.");
    }
  }
}
