package br.com.medflow.indicators.persistence;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Read-only access to the daily indicator views. */
@Repository
public class DoctorIndicatorsRepository {

  private static final String SCHEDULED_DAYS = """
      select data_agendada, total_consultas, agendadas, em_espera, em_atendimento,
             finalizadas, canceladas
      from vw_medico_indicadores_agendamento_diario
      where clinica_id = ? and medico_id = ? and data_agendada >= ? and data_agendada <= ?
      order by data_agendada
      """;

  private static final String FINALIZED_DAYS = """
      select data_finalizada, total_finalizadas, duracao_total_segundos
      from vw_medico_indicadores_finalizacao_diaria
      where clinica_id = ? and medico_id = ? and data_finalizada >= ? and data_finalizada <= ?
      order by data_finalizada
      """;

  private final JdbcTemplate jdbc;

  public DoctorIndicatorsRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<ScheduledDay> findScheduledDays(
      UUID clinicId, UUID doctorId, LocalDate from, LocalDate through) {
    return jdbc.query(SCHEDULED_DAYS, (result, row) -> new ScheduledDay(
        result.getObject("data_agendada", LocalDate.class),
        result.getLong("total_consultas"),
        result.getLong("agendadas"),
        result.getLong("em_espera"),
        result.getLong("em_atendimento"),
        result.getLong("finalizadas"),
        result.getLong("canceladas")), clinicId, doctorId, from, through);
  }

  public List<FinalizedDay> findFinalizedDays(
      UUID clinicId, UUID doctorId, LocalDate from, LocalDate through) {
    return jdbc.query(FINALIZED_DAYS, (result, row) -> new FinalizedDay(
        result.getObject("data_finalizada", LocalDate.class),
        result.getLong("total_finalizadas"),
        result.getBigDecimal("duracao_total_segundos")), clinicId, doctorId, from, through);
  }

  public record ScheduledDay(LocalDate data, long totalConsultas, long agendadas,
      long emEspera, long emAtendimento, long finalizadas, long canceladas) { }

  public record FinalizedDay(
      LocalDate data, long totalFinalizadas, BigDecimal duracaoTotalSegundos) { }
}
