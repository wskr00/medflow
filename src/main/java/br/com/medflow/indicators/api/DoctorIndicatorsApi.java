package br.com.medflow.indicators.api;

import br.com.medflow.indicators.application.DoctorIndicatorsService;
import br.com.medflow.indicators.persistence.DoctorIndicatorsRepository.ScheduledDay;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

final class DoctorIndicatorsApi {
  private DoctorIndicatorsApi() { }

  static Response response(DoctorIndicatorsService.DoctorIndicators source) {
    var scheduled = source.consultasPorDataAgendada();
    var finalized = source.finalizacoesPorDataReal();
    return new Response(source.inicio(), source.fim(), source.timeZone(),
        new ScheduledSummary(scheduled.totalConsultas(), scheduled.agendadas(),
            scheduled.emEspera(), scheduled.emAtendimento(), scheduled.finalizadas(),
            scheduled.canceladas(), scheduled.porDia().stream()
                .map(DoctorIndicatorsApi::scheduledDay).toList()),
        new FinalizationSummary(finalized.totalFinalizadas(),
            finalized.duracaoMediaSegundos(), finalized.porDia().stream()
                .map(day -> new FinalizationDay(day.data(), day.totalFinalizadas(),
                    day.duracaoMediaSegundos())).toList()));
  }

  private static ScheduledDayResponse scheduledDay(ScheduledDay day) {
    return new ScheduledDayResponse(day.data(), day.totalConsultas(), day.agendadas(),
        day.emEspera(), day.emAtendimento(), day.finalizadas(), day.canceladas());
  }

  record Response(LocalDate inicio, LocalDate fim, String timeZone,
      ScheduledSummary consultasPorDataAgendada,
      FinalizationSummary finalizacoesPorDataReal) { }

  record ScheduledSummary(long totalConsultas, long agendadas, long emEspera,
      long emAtendimento, long finalizadas, long canceladas,
      List<ScheduledDayResponse> porDia) { }

  record ScheduledDayResponse(LocalDate data, long totalConsultas, long agendadas,
      long emEspera, long emAtendimento, long finalizadas, long canceladas) { }

  record FinalizationSummary(long totalFinalizadas, BigDecimal duracaoMediaSegundos,
      List<FinalizationDay> porDia) { }

  record FinalizationDay(LocalDate data, long totalFinalizadas,
      BigDecimal duracaoMediaSegundos) { }
}
