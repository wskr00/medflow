package br.com.medflow.care;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.medflow.PostgresTestConfiguration;
import br.com.medflow.care.application.CareService;
import br.com.medflow.care.domain.RegistroClinico;
import br.com.medflow.care.persistence.AtendimentoRepository;
import br.com.medflow.clinic.application.ClinicConfigurationService;
import br.com.medflow.clinic.application.PatientProvisioningService;
import br.com.medflow.common.auth.AuthenticatedActor;
import br.com.medflow.common.http.BusinessConflictException;
import br.com.medflow.common.http.ResourceNotFoundException;
import br.com.medflow.reception.application.ReceptionService;
import br.com.medflow.scheduling.FixedSchedulingClockConfiguration;
import br.com.medflow.scheduling.application.AppointmentService;
import br.com.medflow.scheduling.application.SchedulingConfigurationService;
import br.com.medflow.scheduling.domain.StatusAgendamento;
import br.com.medflow.scheduling.persistence.AgendamentoRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
@Import({PostgresTestConfiguration.class, FixedSchedulingClockConfiguration.class})
class CarePersistenceIntegrationTests {

  private static final LocalDate TODAY = LocalDate.of(2026, 9, 16);
  private static final ZoneId BELEM = ZoneId.of("America/Belem");
  private static final AtomicInteger IDS = new AtomicInteger();

  @Autowired private ClinicConfigurationService clinic;
  @Autowired private PatientProvisioningService provisioning;
  @Autowired private SchedulingConfigurationService scheduling;
  @Autowired private AppointmentService appointments;
  @Autowired private ReceptionService reception;
  @Autowired private CareService care;
  @Autowired private AgendamentoRepository appointmentRepository;
  @Autowired private AtendimentoRepository careRepository;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private DataSource dataSource;

  @Test
  void draftCanBeIncompleteFinalizationRollsBackAndCompletedRecordBecomesImmutable() {
    Fixture fixture = fixture("lifecycle", LocalTime.of(10, 0), LocalTime.of(13, 0));
    var waiting = waiting(fixture, offset(TODAY, 10, 0));
    var started = care.start(fixture.doctor(), waiting.id(), waiting.version());

    var incomplete = care.saveDraft(fixture.doctor(), started.atendimento().id(), 0,
        "  Dor abdominal  ", "   ", null, "  observação inicial  ");
    assertThat(incomplete.version()).isEqualTo(1);
    assertThat(incomplete.registroClinico().queixaPrincipal()).isEqualTo("Dor abdominal");
    assertThat(incomplete.registroClinico().resumoAnamnese()).isEmpty();
    assertThat(incomplete.registroClinico().conduta()).isEmpty();
    assertThat(incomplete.registroClinico().observacoes()).isEqualTo("observação inicial");

    assertThatThrownBy(() -> care.finish(fixture.doctor(), incomplete.id(), incomplete.version()))
        .isInstanceOf(BusinessConflictException.class)
        .extracting(error -> ((BusinessConflictException) error).code())
        .isEqualTo("REGISTRO_INCOMPLETO");
    assertPersistedState(waiting.id(), incomplete.id(), StatusAgendamento.EM_ATENDIMENTO,
        2, 1, null, "Dor abdominal");

    var complete = care.saveDraft(fixture.doctor(), incomplete.id(), incomplete.version(),
        "  Dor abdominal  ", "  História completa  ", "  Hidratação  ", "  ");
    var finished = care.finish(fixture.doctor(), complete.id(), complete.version());
    assertThat(finished.agendamento().status()).isEqualTo(StatusAgendamento.FINALIZADA);
    assertThat(finished.agendamento().version()).isEqualTo(3);
    assertThat(finished.atendimento().version()).isEqualTo(3);
    assertThat(finished.atendimento().finalizadoEm()).isEqualTo(offset(TODAY, 9, 0));
    assertThat(finished.atendimento().registroClinico().resumoAnamnese())
        .isEqualTo("História completa");

    assertThatThrownBy(() -> care.saveDraft(fixture.doctor(), complete.id(), 3,
        "alterada", "alterada", "alterada", "alterada"))
        .isInstanceOf(BusinessConflictException.class)
        .extracting(error -> ((BusinessConflictException) error).code())
        .isEqualTo("TRANSICAO_INVALIDA");
    assertThatThrownBy(() -> care.finish(fixture.doctor(), complete.id(), 3))
        .isInstanceOf(BusinessConflictException.class)
        .extracting(error -> ((BusinessConflictException) error).code())
        .isEqualTo("TRANSICAO_INVALIDA");
    assertPersistedState(waiting.id(), complete.id(), StatusAgendamento.FINALIZADA,
        3, 3, FixedSchedulingClockConfiguration.NOW, "Dor abdominal");
  }

  @Test
  void clinicalLimitsArePersistedAtBoundaryAndNeverTruncated() {
    Fixture fixture = fixture("limits", LocalTime.of(10, 0), LocalTime.of(13, 0));
    var waiting = waiting(fixture, offset(TODAY, 10, 0));
    var started = care.start(fixture.doctor(), waiting.id(), waiting.version());
    String complaint = "q".repeat(RegistroClinico.QUEIXA_MAX);
    String history = "r".repeat(RegistroClinico.RESUMO_MAX);
    String plan = "c".repeat(RegistroClinico.CONDUTA_MAX);
    String notes = "o".repeat(RegistroClinico.OBSERVACOES_MAX);

    var saved = care.saveDraft(fixture.doctor(), started.atendimento().id(), 0,
        complaint, history, plan, notes);
    assertThat(saved.registroClinico().queixaPrincipal()).hasSize(RegistroClinico.QUEIXA_MAX);
    assertThat(saved.registroClinico().resumoAnamnese()).hasSize(RegistroClinico.RESUMO_MAX);
    assertThat(saved.registroClinico().conduta()).hasSize(RegistroClinico.CONDUTA_MAX);
    assertThat(saved.registroClinico().observacoes()).hasSize(RegistroClinico.OBSERVACOES_MAX);

    assertThatThrownBy(() -> care.saveDraft(fixture.doctor(), saved.id(), saved.version(),
        complaint + "x", history, plan, notes))
        .isInstanceOf(IllegalArgumentException.class);
    var persisted = careRepository.findById(saved.id()).orElseThrow();
    assertThat(persisted.version()).isEqualTo(1);
    assertThat(persisted.registroClinico().queixaPrincipal()).isEqualTo(complaint);
  }

  @Test
  void invalidOrDuplicateStartNeverCreatesSecondCare() {
    Fixture fixture = fixture("start-rules", LocalTime.of(10, 0), LocalTime.of(13, 0));
    var scheduled = appointments.criar(fixture.patient(), fixture.ruleId(), offset(TODAY, 11, 0));
    assertThatThrownBy(() -> care.start(fixture.doctor(), scheduled.id(), scheduled.version()))
        .isInstanceOf(BusinessConflictException.class)
        .extracting(error -> ((BusinessConflictException) error).code())
        .isEqualTo("TRANSICAO_INVALIDA");
    assertThat(careRepository.countByAgendamentoId(scheduled.id())).isZero();
    assertThat(appointmentRepository.findById(scheduled.id()).orElseThrow().status())
        .isEqualTo(StatusAgendamento.AGENDADA);

    var waiting = waiting(fixture, offset(TODAY, 10, 0));
    care.start(fixture.doctor(), waiting.id(), waiting.version());
    assertThatThrownBy(() -> care.start(fixture.doctor(), waiting.id(), waiting.version()))
        .isInstanceOf(BusinessConflictException.class)
        .extracting(error -> ((BusinessConflictException) error).code())
        .isEqualTo("VERSAO_DESATUALIZADA");
    assertThat(careRepository.countByAgendamentoId(waiting.id())).isEqualTo(1);
  }

  @Test
  void finalizationRollsBackCareWhenAppointmentTransitionFails() {
    Fixture fixture = fixture("finish-rollback", LocalTime.of(10, 0), LocalTime.of(13, 0));
    var waiting = waiting(fixture, offset(TODAY, 10, 0));
    var started = care.start(fixture.doctor(), waiting.id(), waiting.version());
    var draft = care.saveDraft(fixture.doctor(), started.atendimento().id(), 0,
        "queixa", "resumo", "conduta", "observações");
    jdbc.update("update agendamento set status = 'CANCELADA', version = version + 1 where id = ?",
        waiting.id());

    assertThatThrownBy(() -> care.finish(fixture.doctor(), draft.id(), draft.version()))
        .isInstanceOf(BusinessConflictException.class)
        .extracting(error -> ((BusinessConflictException) error).code())
        .isEqualTo("TRANSICAO_INVALIDA");
    assertPersistedState(waiting.id(), draft.id(), StatusAgendamento.CANCELADA,
        3, 1, null, "queixa");
  }

  @Test
  void concurrentStartsCreateExactlyOneCare() throws Exception {
    Fixture fixture = fixture("start-race", LocalTime.of(10, 0), LocalTime.of(13, 0));
    var waiting = waiting(fixture, offset(TODAY, 10, 0));
    RaceResult result = race(
        () -> care.start(fixture.doctor(), waiting.id(), waiting.version()),
        () -> care.start(fixture.doctor(), waiting.id(), waiting.version()));

    assertThat(result.successes()).isEqualTo(1);
    assertThat(result.conflicts()).containsExactly("VERSAO_DESATUALIZADA");
    assertThat(result.unexpected()).isEmpty();
    assertThat(careRepository.countByAgendamentoId(waiting.id())).isEqualTo(1);
    var persisted = appointmentRepository.findById(waiting.id()).orElseThrow();
    assertThat(persisted.status()).isEqualTo(StatusAgendamento.EM_ATENDIMENTO);
    assertThat(persisted.version()).isEqualTo(2);
  }

  @Test
  void concurrentDraftSavesDoNotOverwriteConfirmedContent() throws Exception {
    Fixture fixture = fixture("save-race", LocalTime.of(10, 0), LocalTime.of(13, 0));
    var waiting = waiting(fixture, offset(TODAY, 10, 0));
    var started = care.start(fixture.doctor(), waiting.id(), waiting.version());
    RaceResult result = race(
        () -> care.saveDraft(fixture.doctor(), started.atendimento().id(), 0,
            "queixa A", "resumo A", "conduta A", "notas A"),
        () -> care.saveDraft(fixture.doctor(), started.atendimento().id(), 0,
            "queixa B", "resumo B", "conduta B", "notas B"));

    assertThat(result.successes()).isEqualTo(1);
    assertThat(result.conflicts()).containsExactly("VERSAO_DESATUALIZADA");
    assertThat(result.unexpected()).isEmpty();
    var persisted = careRepository.findById(started.atendimento().id()).orElseThrow();
    assertThat(persisted.version()).isEqualTo(1);
    assertThat(persisted.registroClinico().queixaPrincipal()).isIn("queixa A", "queixa B");
    String suffix = persisted.registroClinico().queixaPrincipal().endsWith("A") ? "A" : "B";
    assertThat(persisted.registroClinico().resumoAnamnese()).isEqualTo("resumo " + suffix);
    assertThat(persisted.registroClinico().conduta()).isEqualTo("conduta " + suffix);
    assertThat(persisted.registroClinico().observacoes()).isEqualTo("notas " + suffix);
  }

  @Test
  void concurrentSaveAndFinishEitherPersistDraftOrFinalizePreviousCompleteRecord() throws Exception {
    Fixture fixture = fixture("save-finish-race", LocalTime.of(10, 0), LocalTime.of(13, 0));
    var waiting = waiting(fixture, offset(TODAY, 10, 0));
    var started = care.start(fixture.doctor(), waiting.id(), waiting.version());
    var original = care.saveDraft(fixture.doctor(), started.atendimento().id(), 0,
        "original", "resumo original", "conduta original", "notas originais");

    RaceResult result = race(
        () -> care.saveDraft(fixture.doctor(), original.id(), original.version(),
            "nova", "novo resumo", "nova conduta", "novas notas"),
        () -> care.finish(fixture.doctor(), original.id(), original.version()));

    assertThat(result.successes()).isEqualTo(1);
    assertThat(result.conflicts()).hasSize(1)
        .allMatch(code -> code.equals("VERSAO_DESATUALIZADA") || code.equals("TRANSICAO_INVALIDA"));
    assertThat(result.unexpected()).isEmpty();
    var persistedCare = careRepository.findById(original.id()).orElseThrow();
    var persistedAppointment = appointmentRepository.findById(waiting.id()).orElseThrow();
    assertThat(persistedCare.version()).isEqualTo(2);
    if (persistedCare.finalizadoEm() == null) {
      assertThat(persistedAppointment.status()).isEqualTo(StatusAgendamento.EM_ATENDIMENTO);
      assertThat(persistedCare.registroClinico().queixaPrincipal()).isEqualTo("nova");
    } else {
      assertThat(persistedAppointment.status()).isEqualTo(StatusAgendamento.FINALIZADA);
      assertThat(persistedCare.registroClinico().queixaPrincipal()).isEqualTo("original");
      assertThat(persistedCare.finalizadoEm()).isEqualTo(FixedSchedulingClockConfiguration.NOW);
    }
  }

  @Test
  void doctorAgendaUsesClinicDateAtUtcBoundaryAndHistoryIsContextual() {
    Fixture fixture = fixture("utc-history", LocalTime.of(21, 30), LocalTime.of(22, 30));
    var waiting = waiting(fixture, OffsetDateTime.parse("2026-09-17T00:30:00Z"));

    var localDay = care.agenda(fixture.doctor(), TODAY, StatusAgendamento.EM_ESPERA,
        PageRequest.of(0, 10, Sort.by("inicio", "id")));
    var utcDay = care.agenda(fixture.doctor(), TODAY.plusDays(1), null,
        PageRequest.of(0, 10, Sort.by("inicio", "id")));
    assertThat(localDay.getContent()).extracting(CareService.OperationalAppointment::id)
        .containsExactly(waiting.id());
    assertThat(utcDay).isEmpty();

    var started = care.start(fixture.doctor(), waiting.id(), waiting.version());
    var draft = care.saveDraft(fixture.doctor(), started.atendimento().id(), 0,
        "queixa", "resumo", "conduta", "observações");
    care.finish(fixture.doctor(), draft.id(), draft.version());
    var patientHistory = care.patientHistory(fixture.patient(), PageRequest.of(0, 10,
        Sort.by(Sort.Order.desc("inicio"), Sort.Order.asc("id"))));
    assertThat(patientHistory.getContent()).extracting(CareService.PatientHistoryItem::id)
        .containsExactly(waiting.id());
    var doctorHistory = care.doctorHistory(fixture.doctor(), fixture.patient().pacienteId(),
        PageRequest.of(0, 10, Sort.by(Sort.Order.desc("agendamento.inicio"), Sort.Order.asc("id"))));
    assertThat(doctorHistory.getContent()).hasSize(1);
    assertThat(doctorHistory.getContent().getFirst().registroClinico().queixaPrincipal())
        .isEqualTo("queixa");
    assertThat(care.doctorHistory(fixture.doctor(), UUID.randomUUID(), PageRequest.of(0, 10)) )
        .isEmpty();
  }

  @Test
  void startReloadsAppointmentAfterClinicLock() throws Exception {
    Fixture fixture = fixture("post-lock", LocalTime.of(10, 0), LocalTime.of(13, 0));
    var waiting = waiting(fixture, offset(TODAY, 10, 0));
    var executor = Executors.newSingleThreadExecutor();

    try (var lockConnection = dataSource.getConnection()) {
      lockConnection.setAutoCommit(false);
      try (var statement = lockConnection.prepareStatement(
          "select id from clinica where singleton = true for update")) {
        statement.executeQuery().close();
      }
      var future = executor.submit(() ->
          care.start(fixture.doctor(), waiting.id(), waiting.version()));
      assertThat(awaitClinicLockWait()).isTrue();

      jdbc.update("update agendamento set status = 'CANCELADA', version = version + 1 where id = ?",
          waiting.id());
      lockConnection.commit();

      assertThatThrownBy(() -> getFuture(future))
          .isInstanceOf(BusinessConflictException.class)
          .extracting(error -> ((BusinessConflictException) error).code())
          .isEqualTo("VERSAO_DESATUALIZADA");
      assertThat(careRepository.countByAgendamentoId(waiting.id())).isZero();
      assertThat(appointmentRepository.findById(waiting.id()).orElseThrow().status())
          .isEqualTo(StatusAgendamento.CANCELADA);
    } finally {
      executor.shutdownNow();
      assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
    }
  }

  @Test
  void startRevalidatesDoctorAssignmentAfterClinicLock() throws Exception {
    Fixture fixture = fixture("post-lock-owner", LocalTime.of(10, 0), LocalTime.of(13, 0));
    Fixture other = fixture("post-lock-other", LocalTime.of(10, 0), LocalTime.of(13, 0));
    var waiting = waiting(fixture, offset(TODAY, 10, 0));
    var executor = Executors.newSingleThreadExecutor();

    try (var lockConnection = dataSource.getConnection()) {
      lockConnection.setAutoCommit(false);
      try (var statement = lockConnection.prepareStatement(
          "select id from clinica where singleton = true for update")) {
        statement.executeQuery().close();
      }
      var future = executor.submit(() ->
          care.start(fixture.doctor(), waiting.id(), waiting.version()));
      assertThat(awaitClinicLockWait()).isTrue();

      jdbc.update("update agendamento set medico_id = ?, version = version + 1 where id = ?",
          other.doctor().medicoId(), waiting.id());
      lockConnection.commit();

      assertThatThrownBy(() -> getFuture(future)).isInstanceOf(ResourceNotFoundException.class);
      assertThat(careRepository.countByAgendamentoId(waiting.id())).isZero();
      assertThat(jdbc.queryForObject("select medico_id from agendamento where id = ?", UUID.class,
          waiting.id())).isEqualTo(other.doctor().medicoId());
    } finally {
      executor.shutdownNow();
      assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
    }
  }

  private void assertPersistedState(UUID appointmentId, UUID careId, StatusAgendamento status,
      long appointmentVersion, long careVersion, Instant finishedAt, String complaint) {
    var persistedAppointment = appointmentRepository.findById(appointmentId).orElseThrow();
    var persistedCare = careRepository.findById(careId).orElseThrow();
    assertThat(persistedAppointment.status()).isEqualTo(status);
    assertThat(persistedAppointment.version()).isEqualTo(appointmentVersion);
    assertThat(persistedCare.version()).isEqualTo(careVersion);
    assertThat(persistedCare.finalizadoEm()).isEqualTo(finishedAt);
    assertThat(persistedCare.registroClinico().queixaPrincipal()).isEqualTo(complaint);
  }

  private RaceResult race(Command first, Command second) throws Exception {
    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);
    var executor = Executors.newFixedThreadPool(2);
    AtomicInteger successes = new AtomicInteger();
    List<String> conflicts = java.util.Collections.synchronizedList(new ArrayList<>());
    List<Throwable> unexpected = java.util.Collections.synchronizedList(new ArrayList<>());
    try {
      var futures = List.of(first, second).stream().map(command -> executor.submit(() -> {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) throw new AssertionError("barreira expirou");
        try {
          command.run();
          successes.incrementAndGet();
        } catch (BusinessConflictException exception) {
          conflicts.add(exception.code());
        } catch (Throwable throwable) {
          unexpected.add(throwable);
        }
        return null;
      })).toList();
      assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
      start.countDown();
      for (var future : futures) future.get(20, TimeUnit.SECONDS);
    } finally {
      executor.shutdownNow();
      assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
    }
    return new RaceResult(successes.get(), List.copyOf(conflicts), List.copyOf(unexpected));
  }

  private boolean awaitClinicLockWait() {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
    while (System.nanoTime() < deadline) {
      Integer waiting = jdbc.queryForObject("""
          select count(*) from pg_stat_activity
          where datname = current_database()
            and pid <> pg_backend_pid()
            and wait_event_type = 'Lock'
            and query ilike '%clinica%'
          """, Integer.class);
      if (waiting != null && waiting > 0) return true;
      Thread.onSpinWait();
    }
    return false;
  }

  private static Object getFuture(java.util.concurrent.Future<?> future) throws Throwable {
    try {
      return future.get(10, TimeUnit.SECONDS);
    } catch (ExecutionException exception) {
      throw exception.getCause();
    }
  }

  private Fixture fixture(String name, LocalTime start, LocalTime end) {
    String suffix = name + "-" + IDS.incrementAndGet();
    var specialty = clinic.criarEspecialidade("Especialidade " + suffix, true);
    var unit = clinic.criarUnidade("Unidade " + suffix, "Endereço " + suffix, true);
    var room = clinic.criarConsultorio(unit.id(), "Sala " + suffix, true);
    var doctor = clinic.criarMedico("Médico " + suffix, Integer.toString(900000 + IDS.get()),
        "PA", List.of(specialty.id()), true);
    clinic.provisionarSubjectMedico(doctor.id(), "doctor-" + suffix);
    var rule = scheduling.criarRegra(new SchedulingConfigurationService.RegraCommand(
        doctor.id(), specialty.id(), room.id(), DayOfWeek.WEDNESDAY, start, end,
        30, TODAY, TODAY, true, 0));
    var patientEntity = provisioning.provisionar("patient-" + suffix, "Paciente " + suffix);
    var singleton = clinic.clinica();
    var patient = new AuthenticatedActor("patient-" + suffix, Set.of("PATIENT"),
        patientEntity.id(), null, singleton.id(), singleton.timeZone());
    var doctorActor = new AuthenticatedActor("doctor-" + suffix, Set.of("DOCTOR"),
        null, doctor.id(), singleton.id(), singleton.timeZone());
    var receptionist = new AuthenticatedActor("reception-" + suffix, Set.of("RECEPTIONIST"),
        null, null, singleton.id(), singleton.timeZone());
    return new Fixture(rule.id(), patient, doctorActor, receptionist);
  }

  private AppointmentService.AppointmentView waiting(Fixture fixture, OffsetDateTime start) {
    var scheduled = appointments.criar(fixture.patient(), fixture.ruleId(), start);
    reception.checkIn(fixture.receptionist(), scheduled.id(), scheduled.version());
    return appointments.obter(fixture.patient(), scheduled.id());
  }

  private static OffsetDateTime offset(LocalDate date, int hour, int minute) {
    return date.atTime(hour, minute).atZone(BELEM).toOffsetDateTime();
  }

  @FunctionalInterface
  private interface Command { void run(); }

  private record Fixture(UUID ruleId, AuthenticatedActor patient,
      AuthenticatedActor doctor, AuthenticatedActor receptionist) { }

  private record RaceResult(int successes, List<String> conflicts, List<Throwable> unexpected) { }
}
