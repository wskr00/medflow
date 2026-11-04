package br.com.medflow.indicators.persistence;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Consultas somente-leitura nas views administrativas de indicadores. */
@Repository
public class AdminIndicatorsRepository {

  private static final String SCHEDULED_AGGREGATES = """
      select data_agendada, unidade_id, unidade_nome, especialidade_id, especialidade_nome,
             count(*) as total_consultas,
             count(*) filter (where status = 'AGENDADA') as agendadas,
             count(*) filter (where status = 'EM_ESPERA') as em_espera,
             count(*) filter (where status = 'EM_ATENDIMENTO') as em_atendimento,
             count(*) filter (where status = 'FINALIZADA') as finalizadas,
             count(*) filter (where status = 'CANCELADA') as canceladas
      from vw_admin_indicadores_agendamento
      where clinica_id = ? and inicio >= ? and inicio < ?
      """;

  private static final String SCHEDULED_GROUP = """
      group by data_agendada, unidade_id, unidade_nome, especialidade_id, especialidade_nome
      """;

  private static final String FINALIZED_AGGREGATES = """
      select data_finalizada, unidade_id, unidade_nome, especialidade_id, especialidade_nome,
             count(*) as total_finalizadas
      from vw_admin_indicadores_finalizacao
      where clinica_id = ? and finalizado_em >= ? and finalizado_em < ?
      """;

  private static final String FINALIZED_GROUP = """
      group by data_finalizada, unidade_id, unidade_nome, especialidade_id, especialidade_nome
      """;

  private final JdbcTemplate jdbc;

  public AdminIndicatorsRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<ScheduledAggregate> findScheduled(UUID clinicId, Instant from, Instant until,
      UUID unitId, UUID specialtyId) {
    StringBuilder sql = new StringBuilder(SCHEDULED_AGGREGATES);
    List<Object> parameters = new ArrayList<>(List.of(clinicId,
        Timestamp.from(from), Timestamp.from(until)));
    if (unitId != null) {
      sql.append(" and unidade_id = ?");
      parameters.add(unitId);
    }
    if (specialtyId != null) {
      sql.append(" and especialidade_id = ?");
      parameters.add(specialtyId);
    }
    sql.append('\n').append(SCHEDULED_GROUP)
        .append(" order by data_agendada, unidade_nome, especialidade_nome");
    return jdbc.query(sql.toString(), (result, row) -> new ScheduledAggregate(
        result.getObject("data_agendada", LocalDate.class),
        result.getObject("unidade_id", UUID.class), result.getString("unidade_nome"),
        result.getObject("especialidade_id", UUID.class), result.getString("especialidade_nome"),
        result.getLong("total_consultas"), result.getLong("agendadas"),
        result.getLong("em_espera"), result.getLong("em_atendimento"),
        result.getLong("finalizadas"), result.getLong("canceladas")), parameters.toArray());
  }

  public List<FinalizedAggregate> findFinalized(UUID clinicId, Instant from, Instant until,
      UUID unitId, UUID specialtyId) {
    StringBuilder sql = new StringBuilder(FINALIZED_AGGREGATES);
    List<Object> parameters = new ArrayList<>(List.of(clinicId,
        Timestamp.from(from), Timestamp.from(until)));
    if (unitId != null) {
      sql.append(" and unidade_id = ?");
      parameters.add(unitId);
    }
    if (specialtyId != null) {
      sql.append(" and especialidade_id = ?");
      parameters.add(specialtyId);
    }
    sql.append('\n').append(FINALIZED_GROUP)
        .append(" order by data_finalizada, unidade_nome, especialidade_nome");
    return jdbc.query(sql.toString(), (result, row) -> new FinalizedAggregate(
        result.getObject("data_finalizada", LocalDate.class),
        result.getObject("unidade_id", UUID.class), result.getString("unidade_nome"),
        result.getObject("especialidade_id", UUID.class), result.getString("especialidade_nome"),
        result.getLong("total_finalizadas")), parameters.toArray());
  }

  public record ScheduledAggregate(LocalDate data, UUID unidadeId, String unidadeNome,
      UUID especialidadeId, String especialidadeNome, long totalConsultas, long agendadas,
      long emEspera, long emAtendimento, long finalizadas, long canceladas) { }

  public record FinalizedAggregate(LocalDate data, UUID unidadeId, String unidadeNome,
      UUID especialidadeId, String especialidadeNome, long totalFinalizadas) { }
}
