package br.com.medflow.indicators.application;

import br.com.medflow.clinic.domain.Clinica;
import br.com.medflow.clinic.persistence.ClinicaRepository;
import br.com.medflow.clinic.persistence.EspecialidadeRepository;
import br.com.medflow.clinic.persistence.UnidadeRepository;
import br.com.medflow.common.auth.AuthenticatedActor;
import br.com.medflow.common.http.ResourceNotFoundException;
import br.com.medflow.indicators.persistence.AdminIndicatorsRepository;
import br.com.medflow.indicators.persistence.AdminIndicatorsRepository.FinalizedAggregate;
import br.com.medflow.indicators.persistence.AdminIndicatorsRepository.ScheduledAggregate;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Indicadores operacionais agregados e limitados à clínica do administrador autenticado. */
@Service
public class AdminIndicatorsService {

  private static final long MAX_PERIOD_DAYS = 366;
  private static final Comparator<DimensionKey> DIMENSION_ORDER = Comparator
      .comparing(DimensionKey::nome, String.CASE_INSENSITIVE_ORDER)
      .thenComparing(DimensionKey::id);

  private final ClinicaRepository clinics;
  private final UnidadeRepository units;
  private final EspecialidadeRepository specialties;
  private final AdminIndicatorsRepository indicators;

  public AdminIndicatorsService(ClinicaRepository clinics, UnidadeRepository units,
      EspecialidadeRepository specialties, AdminIndicatorsRepository indicators) {
    this.clinics = clinics;
    this.units = units;
    this.specialties = specialties;
    this.indicators = indicators;
  }

  @Transactional(readOnly = true)
  public AdminIndicators find(AuthenticatedActor actor, LocalDate from, LocalDate through,
      UUID unitId, UUID specialtyId) {
    requireAdministrator(actor);
    validatePeriod(from, through);

    Clinica clinic = clinics.findById(actor.clinicaId())
        .orElseThrow(ResourceNotFoundException::new);
    if (unitId != null && !units.existsByIdAndClinicaId(unitId, clinic.id())) {
      throw new ResourceNotFoundException();
    }
    if (specialtyId != null && !specialties.existsByIdAndClinicaId(specialtyId, clinic.id())) {
      throw new ResourceNotFoundException();
    }

    ZoneId zone = ZoneId.of(clinic.timeZone());
    Instant fromInstant = from.atStartOfDay(zone).toInstant();
    Instant untilExclusive;
    try {
      untilExclusive = through.plusDays(1).atStartOfDay(zone).toInstant();
    } catch (DateTimeException exception) {
      throw new IllegalArgumentException("intervalo de indicadores inválido", exception);
    }
    List<ScheduledAggregate> scheduledRows = indicators.findScheduled(
        clinic.id(), fromInstant, untilExclusive, unitId, specialtyId);
    List<FinalizedAggregate> finalizedRows = indicators.findFinalized(
        clinic.id(), fromInstant, untilExclusive, unitId, specialtyId);
    return new AdminIndicators(from, through, clinic.timeZone(), scheduled(scheduledRows),
        finalized(finalizedRows));
  }

  private static ScheduledSummary scheduled(List<ScheduledAggregate> rows) {
    Counter total = new Counter();
    Map<LocalDate, Counter> byDate = new TreeMap<>();
    Map<DimensionKey, Counter> byUnit = new LinkedHashMap<>();
    Map<DimensionKey, Counter> bySpecialty = new LinkedHashMap<>();
    for (ScheduledAggregate row : rows) {
      total.add(row);
      byDate.computeIfAbsent(row.data(), ignored -> new Counter()).add(row);
      byUnit.computeIfAbsent(new DimensionKey(row.unidadeId(), row.unidadeNome()),
          ignored -> new Counter()).add(row);
      bySpecialty.computeIfAbsent(new DimensionKey(row.especialidadeId(), row.especialidadeNome()),
          ignored -> new Counter()).add(row);
    }
    List<DailyScheduled> daily = byDate.entrySet().stream()
        .map(entry -> entry.getValue().scheduled(entry.getKey())).toList();
    return new ScheduledSummary(total.total, total.scheduled, total.waiting, total.inCare,
        total.finalized, total.cancelled, daily, dimensions(byUnit), dimensions(bySpecialty));
  }

  private static FinalizationSummary finalized(List<FinalizedAggregate> rows) {
    long total = 0;
    Map<LocalDate, Long> byDate = new TreeMap<>();
    Map<DimensionKey, Long> byUnit = new TreeMap<>(DIMENSION_ORDER);
    Map<DimensionKey, Long> bySpecialty = new TreeMap<>(DIMENSION_ORDER);
    for (FinalizedAggregate row : rows) {
      total += row.totalFinalizadas();
      byDate.merge(row.data(), row.totalFinalizadas(), Long::sum);
      byUnit.merge(new DimensionKey(row.unidadeId(), row.unidadeNome()),
          row.totalFinalizadas(), Long::sum);
      bySpecialty.merge(new DimensionKey(row.especialidadeId(), row.especialidadeNome()),
          row.totalFinalizadas(), Long::sum);
    }
    List<DailyFinalization> daily = byDate.entrySet().stream()
        .map(entry -> new DailyFinalization(entry.getKey(), entry.getValue())).toList();
    return new FinalizationSummary(total, daily, finalizationDimensions(byUnit),
        finalizationDimensions(bySpecialty));
  }

  private static List<DimensionScheduled> dimensions(Map<DimensionKey, Counter> values) {
    return values.entrySet().stream()
        .sorted(Map.Entry.comparingByKey(DIMENSION_ORDER))
        .map(entry -> new DimensionScheduled(entry.getKey().id(), entry.getKey().nome(),
            entry.getValue().total, entry.getValue().scheduled, entry.getValue().waiting,
            entry.getValue().inCare, entry.getValue().finalized, entry.getValue().cancelled))
        .toList();
  }

  private static List<DimensionFinalization> finalizationDimensions(
      Map<DimensionKey, Long> values) {
    return values.entrySet().stream()
        .map(entry -> new DimensionFinalization(entry.getKey().id(), entry.getKey().nome(),
            entry.getValue())).toList();
  }

  private static void validatePeriod(LocalDate from, LocalDate through) {
    if (from == null || through == null || through.isBefore(from)
        || ChronoUnit.DAYS.between(from, through) >= MAX_PERIOD_DAYS) {
      throw new IllegalArgumentException("intervalo de indicadores inválido");
    }
  }

  private static void requireAdministrator(AuthenticatedActor actor) {
    if (actor == null || !actor.hasRole("ADMINISTRATOR") || actor.clinicaId() == null) {
      throw new AccessDeniedException("Administrador autenticado necessário.");
    }
  }

  public record AdminIndicators(LocalDate inicio, LocalDate fim, String timeZone,
      ScheduledSummary consultasPorDataAgendada,
      FinalizationSummary finalizacoesPorDataReal) { }

  public record ScheduledSummary(long totalConsultas, long agendadas, long emEspera,
      long emAtendimento, long finalizadas, long canceladas, List<DailyScheduled> porDia,
      List<DimensionScheduled> porUnidade, List<DimensionScheduled> porEspecialidade) { }

  public record DailyScheduled(LocalDate data, long totalConsultas, long agendadas,
      long emEspera, long emAtendimento, long finalizadas, long canceladas) { }

  public record DimensionScheduled(UUID id, String nome, long totalConsultas,
      long agendadas, long emEspera, long emAtendimento, long finalizadas, long canceladas) { }

  public record FinalizationSummary(long totalFinalizadas, List<DailyFinalization> porDia,
      List<DimensionFinalization> porUnidade,
      List<DimensionFinalization> porEspecialidade) { }

  public record DailyFinalization(LocalDate data, long totalFinalizadas) { }

  public record DimensionFinalization(UUID id, String nome, long totalFinalizadas) { }

  private record DimensionKey(UUID id, String nome) { }

  private static final class Counter {
    private long total;
    private long scheduled;
    private long waiting;
    private long inCare;
    private long finalized;
    private long cancelled;

    void add(ScheduledAggregate row) {
      total += row.totalConsultas();
      scheduled += row.agendadas();
      waiting += row.emEspera();
      inCare += row.emAtendimento();
      finalized += row.finalizadas();
      cancelled += row.canceladas();
    }

    DailyScheduled scheduled(LocalDate date) {
      return new DailyScheduled(date, total, scheduled, waiting, inCare, finalized, cancelled);
    }
  }
}
