package br.com.medflow.reception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.medflow.PostgresTestConfiguration;
import br.com.medflow.clinic.application.ClinicConfigurationService;
import br.com.medflow.clinic.application.PatientProvisioningService;
import br.com.medflow.common.auth.AuthenticatedActor;
import br.com.medflow.common.http.BusinessConflictException;
import br.com.medflow.reception.application.ReceptionService;
import br.com.medflow.scheduling.FixedSchedulingClockConfiguration;
import br.com.medflow.scheduling.application.AppointmentService;
import br.com.medflow.scheduling.application.SchedulingConfigurationService;
import br.com.medflow.scheduling.domain.StatusAgendamento;
import br.com.medflow.scheduling.persistence.AgendamentoRepository;
import java.sql.Timestamp;
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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import javax.sql.DataSource;

@SpringBootTest
@Import({PostgresTestConfiguration.class, FixedSchedulingClockConfiguration.class})
class ReceptionPersistenceIntegrationTests {

  private static final LocalDate TODAY = LocalDate.of(2026, 9, 16);
  private static final ZoneId BELEM = ZoneId.of("America/Belem");

  @Autowired private ClinicConfigurationService clinic;
  @Autowired private PatientProvisioningService provisioning;
  @Autowired private SchedulingConfigurationService configuration;
  @Autowired private AppointmentService appointments;
  @Autowired private ReceptionService reception;
  @Autowired private AgendamentoRepository appointmentRepository;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private DataSource dataSource;

  @Test
  void checkInUsesClinicLocalDatePreservesFirstInstantAndRejectsInvalidTransition() {
    Fixture today = fixture("checkin-domain", TODAY, DayOfWeek.WEDNESDAY);
    var scheduled = appointments.criar(today.patient(), today.ruleId(), offset(TODAY, 10, 0));

    var checked = reception.checkIn(today.reception(), scheduled.id(), scheduled.version());
    assertThat(checked.status()).isEqualTo(StatusAgendamento.EM_ESPERA);
    assertThat(checked.checkInEm()).isEqualTo(offset(TODAY, 9, 0));
    assertThat(checked.version()).isEqualTo(1);

    assertThatThrownBy(() -> reception.checkIn(today.reception(), scheduled.id(), checked.version()))
        .isInstanceOf(BusinessConflictException.class)
        .extracting(error -> ((BusinessConflictException) error).code())
        .isEqualTo("CHECKIN_JA_REALIZADO");
    var persisted = appointmentRepository.findById(scheduled.id()).orElseThrow();
    assertThat(persisted.checkInEm()).isEqualTo(FixedSchedulingClockConfiguration.NOW);
    assertThat(persisted.version()).isEqualTo(1);

    LocalDate tomorrow = TODAY.plusDays(1);
    Fixture future = fixture("wrong-day", tomorrow, DayOfWeek.THURSDAY);
    var nextDay = appointments.criar(future.patient(), future.ruleId(), offset(tomorrow, 10, 0));
    assertThatThrownBy(() -> reception.checkIn(future.reception(), nextDay.id(), nextDay.version()))
        .isInstanceOf(BusinessConflictException.class)
        .extracting(error -> ((BusinessConflictException) error).code())
        .isEqualTo("TRANSICAO_INVALIDA");
    assertThat(appointmentRepository.findById(nextDay.id()).orElseThrow().checkInEm()).isNull();
  }

  @Test
  void agendaAndCheckInUseClinicDateAcrossUtcBoundary() {
    Fixture fixture = fixture("utc-boundary", TODAY, DayOfWeek.WEDNESDAY,
        LocalTime.of(21, 30), LocalTime.of(22, 30));
    var scheduled = appointments.criar(fixture.patient(), fixture.ruleId(),
        OffsetDateTime.parse("2026-09-17T00:30:00Z"));

    var localDay = reception.agenda(fixture.reception(), TODAY, fixture.unitId(),
        fixture.doctorId(), StatusAgendamento.AGENDADA, PageRequest.of(0, 10,
            Sort.by(Sort.Order.asc("inicio"), Sort.Order.asc("id"))));
    var utcDay = reception.agenda(fixture.reception(), TODAY.plusDays(1), fixture.unitId(),
        fixture.doctorId(), StatusAgendamento.AGENDADA, PageRequest.of(0, 10,
            Sort.by(Sort.Order.asc("inicio"), Sort.Order.asc("id"))));

    assertThat(localDay.getContent()).extracting(ReceptionService.OperationalAppointment::id)
        .containsExactly(scheduled.id());
    assertThat(utcDay).isEmpty();
    var checked = reception.checkIn(fixture.reception(), scheduled.id(), scheduled.version());
    assertThat(checked.status()).isEqualTo(StatusAgendamento.EM_ESPERA);
    assertThat(checked.inicio()).isEqualTo(offset(TODAY, 21, 30));
    assertThat(checked.checkInEm()).isEqualTo(offset(TODAY, 9, 0));
  }

  @Test
  void dailyAgendaFiltersAndQueueIncludesEarlierPendingAppointmentsInStableOrder() {
    Fixture fixture = fixture("queries", TODAY, DayOfWeek.WEDNESDAY);
    var first = appointments.criar(fixture.patient(), fixture.ruleId(), offset(TODAY, 10, 0));
    var second = appointments.criar(patient("queries-second"), fixture.ruleId(), offset(TODAY, 11, 0));
    reception.checkIn(fixture.reception(), first.id(), first.version());
    UUID pendingId = insertEarlierPending(fixture, TODAY.minusDays(1), 10, 0);

    var agenda = reception.agenda(fixture.reception(), TODAY, fixture.unitId(), fixture.doctorId(),
        StatusAgendamento.AGENDADA, PageRequest.of(0, 10,
            Sort.by(Sort.Order.asc("inicio"), Sort.Order.asc("id"))));
    assertThat(agenda.getTotalElements()).isEqualTo(1);
    assertThat(agenda.getContent()).extracting(ReceptionService.OperationalAppointment::id)
        .containsExactly(second.id());

    var queue = reception.queue(fixture.reception(), null, null, PageRequest.of(0, 10,
        Sort.by(Sort.Order.asc("inicio"), Sort.Order.asc("checkInEm"), Sort.Order.asc("id"))));
    assertThat(queue.getContent()).extracting(ReceptionService.OperationalAppointment::id)
        .containsSubsequence(pendingId, first.id());
    var pending = queue.stream().filter(item -> item.id().equals(pendingId)).findFirst().orElseThrow();
    assertThat(pending.pendenteDeDiaAnterior()).isTrue();
    assertThat(queue.stream().filter(item -> item.id().equals(first.id())).findFirst().orElseThrow()
        .pendenteDeDiaAnterior()).isFalse();
    assertThat(queue.stream().noneMatch(item -> item.id().equals(second.id()))).isTrue();
  }

  @Test
  void queueOrdersByStartThenCheckInTimestampThenId() {
    var specialty = clinic.criarEspecialidade("Especialidade queue-order", true);
    var unit = clinic.criarUnidade("Unidade queue-order", "Endereço queue-order", true);
    List<UUID> roomIds = new ArrayList<>();
    List<UUID> doctorIds = new ArrayList<>();
    List<UUID> patientIds = new ArrayList<>();
    for (int index = 0; index < 4; index++) {
      roomIds.add(clinic.criarConsultorio(unit.id(), "Sala queue-order-" + index, true).id());
      doctorIds.add(clinic.criarMedico("Médico queue-order-" + index,
          "81" + index, "PA", List.of(specialty.id()), true).id());
      patientIds.add(provisioning.provisionar("patient-queue-order-" + index,
          "Paciente queue-order-" + index).id());
    }
    var singleton = clinic.clinica();
    AuthenticatedActor receptionist = new AuthenticatedActor("reception-queue-order",
        Set.of("RECEPTIONIST"), null, null, singleton.id(), singleton.timeZone());
    UUID earlierStart = UUID.fromString("10000000-0000-0000-0000-000000000001");
    UUID earlierCheckIn = UUID.fromString("10000000-0000-0000-0000-000000000004");
    UUID lowerIdTie = UUID.fromString("10000000-0000-0000-0000-000000000002");
    UUID higherIdTie = UUID.fromString("10000000-0000-0000-0000-000000000003");

    insertPending(earlierStart, singleton.id(), patientIds.get(0), doctorIds.get(0),
        specialty.id(), roomIds.get(0), offset(TODAY, 9, 0).toInstant(),
        offset(TODAY, 8, 50).toInstant());
    insertPending(earlierCheckIn, singleton.id(), patientIds.get(1), doctorIds.get(1),
        specialty.id(), roomIds.get(1), offset(TODAY, 10, 0).toInstant(),
        offset(TODAY, 8, 0).toInstant());
    insertPending(lowerIdTie, singleton.id(), patientIds.get(2), doctorIds.get(2),
        specialty.id(), roomIds.get(2), offset(TODAY, 10, 0).toInstant(),
        offset(TODAY, 8, 5).toInstant());
    insertPending(higherIdTie, singleton.id(), patientIds.get(3), doctorIds.get(3),
        specialty.id(), roomIds.get(3), offset(TODAY, 10, 0).toInstant(),
        offset(TODAY, 8, 5).toInstant());

    var queue = reception.queue(receptionist, unit.id(), null, PageRequest.of(0, 10,
        Sort.by(Sort.Order.asc("inicio"), Sort.Order.asc("checkInEm"), Sort.Order.asc("id"))));

    assertThat(queue.getContent()).extracting(ReceptionService.OperationalAppointment::id)
        .containsExactly(earlierStart, earlierCheckIn, lowerIdTie, higherIdTie);
  }

  @Test
  void concurrentCheckInsHaveOneEffectAndPersistOneTimestamp() throws Exception {
    Fixture fixture = fixture("checkin-race", TODAY, DayOfWeek.WEDNESDAY);
    var scheduled = appointments.criar(fixture.patient(), fixture.ruleId(), offset(TODAY, 10, 0));
    AtomicInteger successes = new AtomicInteger();
    List<String> conflicts = java.util.Collections.synchronizedList(new ArrayList<>());
    List<Throwable> unexpected = java.util.Collections.synchronizedList(new ArrayList<>());

    runRace(() -> runCommand(() -> reception.checkIn(
            fixture.reception(), scheduled.id(), scheduled.version()), successes, conflicts, unexpected),
        () -> runCommand(() -> reception.checkIn(
            fixture.reception(), scheduled.id(), scheduled.version()), successes, conflicts, unexpected));

    assertThat(successes).hasValue(1);
    assertThat(conflicts).hasSize(1).allMatch(code ->
        code.equals("CHECKIN_JA_REALIZADO") || code.equals("VERSAO_DESATUALIZADA"));
    assertThat(unexpected).isEmpty();
    var persisted = appointmentRepository.findById(scheduled.id()).orElseThrow();
    assertThat(persisted.status()).isEqualTo(StatusAgendamento.EM_ESPERA);
    assertThat(persisted.checkInEm()).isEqualTo(FixedSchedulingClockConfiguration.NOW);
    assertThat(persisted.version()).isEqualTo(1);
  }

  @Test
  void concurrentCheckInAndCancellationCommitExactlyOneConsistentMutation() throws Exception {
    Fixture fixture = fixture("cancel-race", TODAY, DayOfWeek.WEDNESDAY);
    var scheduled = appointments.criar(fixture.patient(), fixture.ruleId(), offset(TODAY, 10, 0));
    AtomicInteger successes = new AtomicInteger();
    List<String> conflicts = java.util.Collections.synchronizedList(new ArrayList<>());
    List<Throwable> unexpected = java.util.Collections.synchronizedList(new ArrayList<>());

    runRace(() -> runCommand(() -> reception.checkIn(
            fixture.reception(), scheduled.id(), scheduled.version()), successes, conflicts, unexpected),
        () -> runCommand(() -> appointments.cancelar(
            fixture.reception(), scheduled.id(), scheduled.version()), successes, conflicts, unexpected));

    assertThat(successes).hasValue(1);
    assertThat(conflicts).hasSize(1).allMatch(code ->
        code.equals("TRANSICAO_INVALIDA") || code.equals("VERSAO_DESATUALIZADA"));
    assertThat(unexpected).isEmpty();
    var persisted = appointmentRepository.findById(scheduled.id()).orElseThrow();
    assertThat(persisted.version()).isEqualTo(1);
    if (persisted.status() == StatusAgendamento.EM_ESPERA) {
      assertThat(persisted.checkInEm()).isEqualTo(FixedSchedulingClockConfiguration.NOW);
    } else {
      assertThat(persisted.status()).isEqualTo(StatusAgendamento.CANCELADA);
      assertThat(persisted.checkInEm()).isNull();
    }
  }

  @Test
  void checkInReloadsStateAfterWaitingForClinicLock() throws Exception {
    Fixture fixture = fixture("post-lock-checkin", TODAY, DayOfWeek.WEDNESDAY);
    var scheduled = appointments.criar(fixture.patient(), fixture.ruleId(), offset(TODAY, 10, 0));
    var executor = Executors.newSingleThreadExecutor();

    try (var lockConnection = dataSource.getConnection()) {
      lockConnection.setAutoCommit(false);
      try (var statement = lockConnection.prepareStatement(
          "select id from clinica where singleton = true for update")) {
        statement.executeQuery().close();
      }
      var future = executor.submit(() ->
          reception.checkIn(fixture.reception(), scheduled.id(), scheduled.version()));
      assertThat(awaitClinicLockWait()).isTrue();

      jdbc.update("update agendamento set status = 'CANCELADA', version = version + 1 where id = ?",
          scheduled.id());
      lockConnection.commit();

      assertThatThrownBy(() -> getFuture(future))
          .isInstanceOf(BusinessConflictException.class)
          .extracting(error -> ((BusinessConflictException) error).code())
          .isEqualTo("VERSAO_DESATUALIZADA");
      var persisted = appointmentRepository.findById(scheduled.id()).orElseThrow();
      assertThat(persisted.status()).isEqualTo(StatusAgendamento.CANCELADA);
      assertThat(persisted.checkInEm()).isNull();
      assertThat(persisted.version()).isEqualTo(1);
    } finally {
      executor.shutdownNow();
      assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
    }
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

  private void runRace(Runnable first, Runnable second) throws Exception {
    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);
    var executor = Executors.newFixedThreadPool(2);
    try {
      var futures = List.of(first, second).stream().map(command -> executor.submit(() -> {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) throw new AssertionError("barreira expirou");
        command.run();
        return null;
      })).toList();
      assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
      start.countDown();
      for (var future : futures) future.get(20, TimeUnit.SECONDS);
    } finally {
      executor.shutdownNow();
      assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
    }
  }

  private static void runCommand(Command command, AtomicInteger successes,
      List<String> conflicts, List<Throwable> unexpected) {
    try {
      command.run();
      successes.incrementAndGet();
    } catch (BusinessConflictException exception) {
      conflicts.add(exception.code());
    } catch (Throwable throwable) {
      unexpected.add(throwable);
    }
  }

  private Fixture fixture(String suffix, LocalDate date, DayOfWeek day) {
    return fixture(suffix, date, day, LocalTime.of(10, 0), LocalTime.of(13, 0));
  }

  private Fixture fixture(String suffix, LocalDate date, DayOfWeek day,
      LocalTime start, LocalTime end) {
    var specialty = clinic.criarEspecialidade("Especialidade " + suffix, true);
    var unit = clinic.criarUnidade("Unidade " + suffix, "Endereço " + suffix, true);
    var room = clinic.criarConsultorio(unit.id(), "Sala " + suffix, true);
    var doctor = clinic.criarMedico("Médico " + suffix,
        Integer.toString(Math.abs(suffix.hashCode())), "PA", List.of(specialty.id()), true);
    clinic.provisionarSubjectMedico(doctor.id(), "doctor-" + suffix);
    var rule = configuration.criarRegra(new SchedulingConfigurationService.RegraCommand(
        doctor.id(), specialty.id(), room.id(), day, start, end, 30,
        date, date, true, 0));
    AuthenticatedActor patient = patient("patient-" + suffix);
    var singleton = clinic.clinica();
    AuthenticatedActor receptionist = new AuthenticatedActor("reception-" + suffix,
        Set.of("RECEPTIONIST"), null, null, singleton.id(), singleton.timeZone());
    return new Fixture(rule.id(), doctor.id(), specialty.id(), unit.id(), room.id(),
        patient.pacienteId(), patient, receptionist);
  }

  private AuthenticatedActor patient(String subject) {
    var patient = provisioning.provisionar(subject, "Paciente " + subject);
    var singleton = clinic.clinica();
    return new AuthenticatedActor(subject, Set.of("PATIENT"), patient.id(), null,
        singleton.id(), singleton.timeZone());
  }

  private UUID insertEarlierPending(Fixture fixture, LocalDate date, int hour, int minute) {
    UUID id = UUID.randomUUID();
    Instant start = offset(date, hour, minute).toInstant();
    insertPending(id, fixture.reception().clinicaId(), fixture.patientId(), fixture.doctorId(),
        fixture.specialtyId(), fixture.roomId(), start, start.minusSeconds(600));
    return id;
  }

  private void insertPending(UUID id, UUID clinicId, UUID patientId, UUID doctorId,
      UUID specialtyId, UUID roomId, Instant start, Instant checkIn) {
    jdbc.update("""
        insert into agendamento
          (id, clinica_id, paciente_id, medico_id, especialidade_id, consultorio_id,
           inicio, fim, status, check_in_em, version)
        values (?, ?, ?, ?, ?, ?, ?, ?, 'EM_ESPERA', ?, 0)
        """, id, clinicId, patientId, doctorId, specialtyId, roomId, Timestamp.from(start),
        Timestamp.from(start.plusSeconds(1800)), Timestamp.from(checkIn));
  }

  private static OffsetDateTime offset(LocalDate date, int hour, int minute) {
    return date.atTime(hour, minute).atZone(BELEM).toOffsetDateTime();
  }

  @FunctionalInterface
  private interface Command { void run(); }

  private record Fixture(UUID ruleId, UUID doctorId, UUID specialtyId, UUID unitId,
      UUID roomId, UUID patientId, AuthenticatedActor patient, AuthenticatedActor reception) { }
}
