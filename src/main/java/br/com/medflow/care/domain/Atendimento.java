package br.com.medflow.care.domain;

import br.com.medflow.common.http.BusinessConflictException;
import br.com.medflow.scheduling.domain.Agendamento;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

/** Atendimento único de um Agendamento, incluindo seu registro clínico interno. */
@Entity
@Table(name = "atendimento")
public class Atendimento {

  @Id @GeneratedValue private UUID id;
  @OneToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "agendamento_id", nullable = false, unique = true)
  private Agendamento agendamento;
  @Column(name = "iniciado_em", nullable = false) private Instant iniciadoEm;
  @Column(name = "finalizado_em") private Instant finalizadoEm;
  @Embedded private RegistroClinico registroClinico;
  @Version private long version;

  protected Atendimento() { }

  public Atendimento(Agendamento agendamento, Instant iniciadoEm) {
    if (agendamento == null || iniciadoEm == null) {
      throw new IllegalArgumentException("atendimento inválido");
    }
    this.agendamento = agendamento;
    this.iniciadoEm = iniciadoEm;
    this.registroClinico = RegistroClinico.vazio();
  }

  public UUID id() { return id; }
  public Agendamento agendamento() { return agendamento; }
  public Instant iniciadoEm() { return iniciadoEm; }
  public Instant finalizadoEm() { return finalizadoEm; }
  public RegistroClinico registroClinico() { return registroClinico; }
  public long version() { return version; }

  public void salvarRegistro(RegistroClinico novoRegistro, long expectedVersion) {
    validarVersao(expectedVersion);
    if (finalizadoEm != null) {
      throw invalidTransition();
    }
    if (novoRegistro == null) throw new IllegalArgumentException("registro clínico obrigatório");
    registroClinico = novoRegistro;
  }

  public void finalizar(Instant agora, long expectedVersion) {
    validarVersao(expectedVersion);
    if (finalizadoEm != null) throw invalidTransition();
    if (!registroClinico.completo()) {
      throw new BusinessConflictException(
          "REGISTRO_INCOMPLETO", "O registro clínico obrigatório está incompleto.");
    }
    if (agora == null || agora.isBefore(iniciadoEm)) {
      throw new IllegalArgumentException("instante de finalização inválido");
    }
    finalizadoEm = agora;
  }

  private void validarVersao(long expectedVersion) {
    if (version != expectedVersion) {
      throw new BusinessConflictException(
          "VERSAO_DESATUALIZADA", "O recurso foi alterado por outra operação.");
    }
  }

  private static BusinessConflictException invalidTransition() {
    return new BusinessConflictException(
        "TRANSICAO_INVALIDA", "O atendimento não permite esta operação.");
  }
}
