package br.com.medflow.indicators.application;

import br.com.medflow.clinic.domain.Clinica;
import br.com.medflow.clinic.domain.Medico;
import br.com.medflow.clinic.persistence.ClinicaRepository;
import br.com.medflow.clinic.persistence.MedicoRepository;
import br.com.medflow.common.auth.AuthenticatedActor;
import br.com.medflow.common.http.ResourceNotFoundException;
import br.com.medflow.indicators.persistence.DoctorIndicatorsRepository;
import br.com.medflow.indicators.persistence.DoctorIndicatorsRepository.FinalizedDay;
import br.com.medflow.indicators.persistence.DoctorIndicatorsRepository.ScheduledDay;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read-only operational indicators scoped to the authenticated, active doctor. */
@Service
public class DoctorIndicatorsService {

  private static final long MAX_PERIOD_DAYS = 366;

  private final ClinicaRepository clinics;
  private final MedicoRepository doctors;
  private final DoctorIndicatorsRepository indicators;

  public DoctorIndicatorsService(ClinicaRepository clinics, MedicoRepository doctors,
      DoctorIndicatorsRepository indicators) {
    this.clinics = clinics;
    this.doctors = doctors;
    this.indicators = indicators;
  }

  @Transactional(readOnly = true)
  public DoctorIndicators find(AuthenticatedActor actor, LocalDate from, LocalDate through) {
    requireDoctor(actor);
    validatePeriod(from, through);

    Clinica clinic = clinics.findById(actor.clinicaId())
        .orElseThrow(ResourceNotFoundException::new);
    Medico doctor = doctors.findById(actor.medicoId())
        .orElseThrow(() -> new AccessDeniedException("Vínculo médico ativo necessário."));
    if (!doctor.ativo() || !doctor.clinica().id().equals(clinic.id())) {
      throw new AccessDeniedException("Vínculo médico ativo necessário.");
    }

    List<ScheduledDay> scheduledDays = indicators.findScheduledDays(
        clinic.id(), doctor.id(), from, through);
    List<FinalizedDay> finalizedDays = indicators.findFinalizedDays(
        clinic.id(), doctor.id(), from, through);

    ScheduledSummary scheduled = scheduledSummary(scheduledDays);
    FinalizationSummary finalizations = finalizationSummary(finalizedDays);
    return new DoctorIndicators(from, through, clinic.timeZone(), scheduled, finalizations);
  }

  private static void validatePeriod(LocalDate from, LocalDate through) {
    if (from == null || through == null || through.isBefore(from)
        || ChronoUnit.DAYS.between(from, through) >= MAX_PERIOD_DAYS) {
      throw new IllegalArgumentException("intervalo de indicadores inválido");
    }
  }

  private static void requireDoctor(AuthenticatedActor actor) {
    if (actor == null || !actor.hasRole("DOCTOR") || actor.medicoId() == null
        || actor.clinicaId() == null) {
      throw new AccessDeniedException("Vínculo médico ativo necessário.");
    }
  }

  private static ScheduledSummary scheduledSummary(List<ScheduledDay> days) {
    long total = 0;
    long scheduled = 0;
    long waiting = 0;
    long inCare = 0;
    long finalized = 0;
    long cancelled = 0;
    for (ScheduledDay day : days) {
      total += day.totalConsultas();
      scheduled += day.agendadas();
      waiting += day.emEspera();
      inCare += day.emAtendimento();
      finalized += day.finalizadas();
      cancelled += day.canceladas();
    }
    return new ScheduledSummary(total, scheduled, waiting, inCare, finalized, cancelled, days);
  }

  private static FinalizationSummary finalizationSummary(List<FinalizedDay> days) {
    long total = 0;
    BigDecimal duration = BigDecimal.ZERO;
    for (FinalizedDay day : days) {
      total += day.totalFinalizadas();
      duration = duration.add(day.duracaoTotalSegundos());
    }
    BigDecimal average = total == 0
        ? null
        : duration.divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
    List<FinalizationDay> daily = days.stream()
        .map(day -> new FinalizationDay(day.data(), day.totalFinalizadas(),
            day.duracaoTotalSegundos().divide(
                BigDecimal.valueOf(day.totalFinalizadas()), 2, RoundingMode.HALF_UP)))
        .toList();
    return new FinalizationSummary(total, average, daily);
  }

  public record DoctorIndicators(LocalDate inicio, LocalDate fim, String timeZone,
      ScheduledSummary consultasPorDataAgendada,
      FinalizationSummary finalizacoesPorDataReal) { }

  public record ScheduledSummary(long totalConsultas, long agendadas, long emEspera,
      long emAtendimento, long finalizadas, long canceladas, List<ScheduledDay> porDia) { }

  public record FinalizationSummary(long totalFinalizadas, BigDecimal duracaoMediaSegundos,
      List<FinalizationDay> porDia) { }

  public record FinalizationDay(LocalDate data, long totalFinalizadas,
      BigDecimal duracaoMediaSegundos) { }
}
