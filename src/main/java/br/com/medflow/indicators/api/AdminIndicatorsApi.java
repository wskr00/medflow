package br.com.medflow.indicators.api;

import br.com.medflow.indicators.application.AdminIndicatorsService;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

final class AdminIndicatorsApi {
  private AdminIndicatorsApi() { }

  static Response response(AdminIndicatorsService.AdminIndicators source) {
    var scheduled = source.consultasPorDataAgendada();
    var finalized = source.finalizacoesPorDataReal();
    return new Response(source.inicio(), source.fim(), source.timeZone(),
        new ScheduledSummary(scheduled.totalConsultas(), scheduled.agendadas(),
            scheduled.emEspera(), scheduled.emAtendimento(), scheduled.finalizadas(),
            scheduled.canceladas(), scheduled.porDia().stream()
                .map(day -> new ScheduledDay(day.data(), day.totalConsultas(), day.agendadas(),
                    day.emEspera(), day.emAtendimento(), day.finalizadas(), day.canceladas()))
                .toList(), scheduled.porUnidade().stream().map(AdminIndicatorsApi::scheduledDimension)
                .toList(), scheduled.porEspecialidade().stream()
                .map(AdminIndicatorsApi::scheduledDimension).toList()),
        new FinalizationSummary(finalized.totalFinalizadas(), finalized.porDia().stream()
            .map(day -> new FinalizationDay(day.data(), day.totalFinalizadas())).toList(),
            finalized.porUnidade().stream().map(AdminIndicatorsApi::finalizationDimension).toList(),
            finalized.porEspecialidade().stream()
                .map(AdminIndicatorsApi::finalizationDimension).toList()));
  }

  private static ScheduledDimension scheduledDimension(
      AdminIndicatorsService.DimensionScheduled dimension) {
    return new ScheduledDimension(dimension.id(), dimension.nome(), dimension.totalConsultas(),
        dimension.agendadas(), dimension.emEspera(), dimension.emAtendimento(),
        dimension.finalizadas(), dimension.canceladas());
  }

  private static FinalizationDimension finalizationDimension(
      AdminIndicatorsService.DimensionFinalization dimension) {
    return new FinalizationDimension(dimension.id(), dimension.nome(),
        dimension.totalFinalizadas());
  }

  record Response(LocalDate inicio, LocalDate fim, String timeZone,
      ScheduledSummary consultasPorDataAgendada, FinalizationSummary finalizacoesPorDataReal) { }

  record ScheduledSummary(long totalConsultas, long agendadas, long emEspera,
      long emAtendimento, long finalizadas, long canceladas, List<ScheduledDay> porDia,
      List<ScheduledDimension> porUnidade, List<ScheduledDimension> porEspecialidade) { }

  record ScheduledDay(LocalDate data, long totalConsultas, long agendadas, long emEspera,
      long emAtendimento, long finalizadas, long canceladas) { }

  record ScheduledDimension(UUID id, String nome, long totalConsultas, long agendadas,
      long emEspera, long emAtendimento, long finalizadas, long canceladas) { }

  record FinalizationSummary(long totalFinalizadas, List<FinalizationDay> porDia,
      List<FinalizationDimension> porUnidade, List<FinalizationDimension> porEspecialidade) { }

  record FinalizationDay(LocalDate data, long totalFinalizadas) { }

  record FinalizationDimension(UUID id, String nome, long totalFinalizadas) { }
}
