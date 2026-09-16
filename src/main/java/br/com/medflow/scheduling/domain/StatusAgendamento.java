package br.com.medflow.scheduling.domain;

/** Estados acordados do ciclo completo; a Issue #10 só executa AGENDADA/CANCELADA. */
public enum StatusAgendamento {
  AGENDADA,
  EM_ESPERA,
  EM_ATENDIMENTO,
  FINALIZADA,
  CANCELADA
}
