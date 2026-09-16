package br.com.medflow.scheduling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.medflow.PostgresTestConfiguration;
import br.com.medflow.audit.domain.AuditAction;
import br.com.medflow.audit.domain.AuditResult;
import br.com.medflow.audit.persistence.AuditJpaRepository;
import br.com.medflow.clinic.application.ClinicConfigurationService;
import br.com.medflow.clinic.application.PatientProvisioningService;
import br.com.medflow.clinic.persistence.ConsultorioRepository;
import br.com.medflow.clinic.persistence.EspecialidadeRepository;
import br.com.medflow.clinic.persistence.MedicoRepository;
import br.com.medflow.clinic.persistence.PacienteRepository;
import br.com.medflow.clinic.persistence.UnidadeRepository;
import br.com.medflow.common.auth.AuthenticatedActor;
import br.com.medflow.common.http.BusinessConflictException;
import br.com.medflow.common.http.ResourceNotFoundException;
import br.com.medflow.scheduling.application.AppointmentService;
import br.com.medflow.scheduling.application.SchedulingConfigurationService;
import br.com.medflow.scheduling.domain.Agendamento;
import br.com.medflow.scheduling.domain.StatusAgendamento;
import br.com.medflow.scheduling.persistence.AgendamentoRepository;
import br.com.medflow.scheduling.persistence.BloqueioAgendaRepository;
import br.com.medflow.scheduling.persistence.RegraAgendaRepository;
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
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import javax.sql.DataSource;

@SpringBootTest
@Import({PostgresTestConfiguration.class, FixedSchedulingClockConfiguration.class})
class AppointmentPersistenceIntegrationTests {

  private static final LocalDate MONDAY = LocalDate.of(2026, 9, 21);
  private static final ZoneId BELEM = ZoneId.of("America/Belem");

  @Autowired private ClinicConfigurationService clinic;
  @Autowired private PatientProvisioningService provisioning;
  @Autowired private SchedulingConfigurationService configuration;
  @Autowired private AppointmentService appointments;
  @Autowired private AuditJpaRepository auditEvents;
  @Autowired private AgendamentoRepository appointmentRepository;
  @Autowired private BloqueioAgendaRepository blockRepository;
  @Autowired private RegraAgendaRepository ruleRepository;
  @Autowired private PacienteRepository pacienteRepository;
  @Autowired private MedicoRepository medicoRepository;
  @Autowired private EspecialidadeRepository especialidadeRepository;
  @Autowired private ConsultorioRepository consultorioRepository;
  @Autowired private UnidadeRepository unidadeRepository;
  @Autowired private DataSource dataSource;
  @Autowired private JdbcTemplate jdbc;

  @Test
  void derivesSlotsWithBelemOffsetInclusiveValidityBlocksReservationsAndInactiveStructure() {
    Fixture fixture = fixture("availability", LocalTime.of(8, 0), LocalTime.of(10, 0), 30,
        MONDAY, MONDAY);
    configuration.criarBloqueio(new SchedulingConfigurationService.BloqueioCommand(
        fixture.medicoId(), instant(8, 30), instant(9, 0), true, 0));

    var available = appointments.disponibilidade(fixture.patient(), MONDAY,
        fixture.unidadeId(), fixture.especialidadeId(), fixture.medicoId());

    assertThat(available.timeZone()).isEqualTo("America/Belem");
    assertThat(available.items()).extracting(slot -> slot.inicioComOffset().toString())
        .containsExactly("2026-09-21T08:00-03:00", "2026-09-21T09:00-03:00", "2026-09-21T09:30-03:00");

    var reservation = appointments.criar(fixture.patient(), fixture.regraId(), offset(9, 0));
    assertThat(appointments.disponibilidade(fixture.patient(), MONDAY,
        fixture.unidadeId(), fixture.especialidadeId(), fixture.medicoId()).items())
        .extracting(slot -> slot.inicioComOffset().toLocalTime())
        .containsExactly(LocalTime.of(8, 0), LocalTime.of(9, 30));

    assertUnavailable(() -> appointments.criar(
        patient("availability-blocked"), fixture.regraId(), offset(8, 30)));
    appointments.cancelar(fixture.patient(), reservation.id(), reservation.version());
    var unit = clinic.unidades(true, PageRequest.of(0, 100)).stream()
        .filter(value -> value.id().equals(fixture.unidadeId())).findFirst().orElseThrow();
    clinic.alterarUnidade(unit.id(), unit.version(), unit.nome(), unit.endereco(), false);
    assertThat(appointments.disponibilidade(fixture.patient(), MONDAY,
        fixture.unidadeId(), fixture.especialidadeId(), fixture.medicoId()).items()).isEmpty();
    assertThat(appointments.disponibilidade(fixture.patient(), LocalDate.of(2026, 9, 14),
        fixture.unidadeId(), fixture.especialidadeId(), fixture.medicoId()).items()).isEmpty();
  }

  @Test
  void enforcesHalfOpenConflictsForDoctorRoomAndPartialOverlapWhileAllowingAdjacency() {
    Fixture target = fixture("conflicts-target", LocalTime.of(8, 0), LocalTime.of(12, 0), 30,
        MONDAY, null);
    Fixture other = fixture("conflicts-other", LocalTime.of(8, 0), LocalTime.of(12, 0), 30,
        MONDAY, null);

    persistHistorical(target.patientId(), target.medicoId(), other.especialidadeId(),
        other.consultorioId(), instant(8, 15), instant(9, 0));
    assertUnavailable(() -> appointments.criar(target.patient(), target.regraId(), offset(8, 30)));
    var adjacency = appointments.criar(target.patient(), target.regraId(), offset(9, 0));
    assertThat(adjacency.status()).isEqualTo(StatusAgendamento.AGENDADA);

    persistHistorical(other.patientId(), other.medicoId(), target.especialidadeId(),
        target.consultorioId(), instant(10, 0), instant(10, 30));
    assertUnavailable(() -> appointments.criar(target.patient(), target.regraId(), offset(10, 0)));
  }

  @Test
  void cancellationReleasesSlotAndOwnListAppliesStatusDateAndPagination() {
    Fixture fixture = fixture("cancel-list", LocalTime.of(8, 0), LocalTime.of(10, 0), 30,
        MONDAY, null);
    var first = appointments.criar(fixture.patient(), fixture.regraId(), offset(8, 0));
    var second = appointments.criar(fixture.patient(), fixture.regraId(), offset(9, 0));
    appointments.cancelar(fixture.patient(), first.id(), first.version());

    var another = patient("cancel-list-another");
    assertThat(appointments.criar(another, fixture.regraId(), offset(8, 0)).id()).isNotNull();

    var cancelled = appointments.proprios(fixture.patient(), StatusAgendamento.CANCELADA,
        MONDAY, MONDAY, PageRequest.of(0, 1));
    assertThat(cancelled.getTotalElements()).isEqualTo(1);
    assertThat(cancelled.getContent()).extracting(AppointmentService.AppointmentView::id)
        .containsExactly(first.id());
    assertThat(appointments.proprios(fixture.patient(), StatusAgendamento.AGENDADA,
        MONDAY.plusDays(1), MONDAY.plusDays(1), PageRequest.of(0, 1)).getTotalElements()).isZero();
    assertThat(appointments.proprios(fixture.patient(), null, null, null,
        PageRequest.of(0, 1)).getTotalElements()).isEqualTo(2);
    assertThat(second.id()).isNotNull();
  }

  @Test
  void rescheduleNoOpKeepsVersionAndFailedConflictRollsBackOriginalReservation() {
    Fixture fixture = fixture("reschedule", LocalTime.of(8, 0), LocalTime.of(11, 0), 30,
        MONDAY, null);
    var original = appointments.criar(fixture.patient(), fixture.regraId(), offset(8, 0));
    var occupied = appointments.criar(patient("reschedule-other"), fixture.regraId(), offset(9, 0));

    var noOp = appointments.reagendar(fixture.patient(), original.id(), fixture.regraId(),
        offset(8, 0), original.version());
    assertThat(noOp.version()).isEqualTo(original.version());

    assertThatThrownBy(() -> appointments.reagendar(fixture.patient(), original.id(),
        fixture.regraId(), offset(9, 0), original.version()))
        .isInstanceOf(BusinessConflictException.class)
        .extracting(error -> ((BusinessConflictException) error).code())
        .isEqualTo("HORARIO_INDISPONIVEL");

    var persisted = appointments.obter(fixture.patient(), original.id());
    assertThat(persisted.inicio()).isEqualTo(offset(8, 0));
    assertThat(persisted.version()).isEqualTo(original.version());
    assertThat(occupied.inicio()).isEqualTo(offset(9, 0));

    var anotherRoom = clinic.criarConsultorio(fixture.unidadeId(), "Sala reagendada", true);
    var anotherRule = configuration.criarRegra(new SchedulingConfigurationService.RegraCommand(
        fixture.medicoId(), fixture.especialidadeId(), anotherRoom.id(), DayOfWeek.MONDAY,
        LocalTime.of(11, 0), LocalTime.of(12, 0), 30, MONDAY, null, true, 0));
    var moved = appointments.reagendar(fixture.patient(), original.id(), anotherRule.id(),
        offset(11, 0), original.version());
    assertThat(moved.id()).isEqualTo(original.id());
    assertThat(moved.medico()).isEqualTo(original.medico());
    assertThat(moved.especialidade()).isEqualTo(original.especialidade());
    assertThat(moved.unidade()).isEqualTo(original.unidade());
    assertThat(moved.consultorio().id()).isEqualTo(anotherRoom.id());
    assertThat(moved.version()).isEqualTo(original.version() + 1);

    assertThatThrownBy(() -> appointments.cancelar(fixture.patient(), original.id(), 99))
        .isInstanceOf(BusinessConflictException.class)
        .extracting(error -> ((BusinessConflictException) error).code())
        .isEqualTo("VERSAO_DESATUALIZADA");
  }

  @Test
  void creatingOrChangingBlockOverFutureReservationConflictsAndRollsBack() {
    Fixture fixture = fixture("block-guard", LocalTime.of(8, 0), LocalTime.of(11, 0), 30,
        MONDAY.minusWeeks(1), MONDAY.plusWeeks(1));
    appointments.criar(fixture.patient(), fixture.regraId(), offset(8, 0));
    long initialCount = blockRepository.count();

    assertReservationsConflict(() -> configuration.criarBloqueio(
        new SchedulingConfigurationService.BloqueioCommand(
            fixture.medicoId(), instant(7, 45), instant(8, 15), true, 0)));
    assertThat(blockRepository.count()).isEqualTo(initialCount);

    var safe = configuration.criarBloqueio(new SchedulingConfigurationService.BloqueioCommand(
        fixture.medicoId(), instant(10, 0), instant(10, 30), true, 0));
    assertReservationsConflict(() -> configuration.alterarBloqueio(safe.id(),
        new SchedulingConfigurationService.BloqueioCommand(
            fixture.medicoId(), instant(8, 0), instant(8, 30), true, safe.version())));

    var persisted = blockRepository.findById(safe.id()).orElseThrow();
    assertThat(persisted.inicio()).isEqualTo(instant(10, 0));
    assertThat(persisted.fim()).isEqualTo(instant(10, 30));
    assertThat(persisted.version()).isEqualTo(safe.version());
  }

  @Test
  void changingRuleCannotDeactivateOrExcludeFutureReservationAndRollsBack() {
    Fixture fixture = fixture("rule-guard", LocalTime.of(8, 0), LocalTime.of(11, 0), 30,
        MONDAY.minusWeeks(1), MONDAY.plusWeeks(1));
    appointments.criar(fixture.patient(), fixture.regraId(), offset(8, 0));

    assertReservationsConflict(() -> configuration.alterarRegra(fixture.regraId(),
        ruleCommand(fixture, LocalTime.of(8, 0), LocalTime.of(11, 0),
            MONDAY.minusWeeks(1), MONDAY.plusWeeks(1), false, 0)));
    assertRuleUnchanged(fixture.regraId());

    assertReservationsConflict(() -> configuration.alterarRegra(fixture.regraId(),
        ruleCommand(fixture, LocalTime.of(8, 30), LocalTime.of(11, 0),
            MONDAY.minusWeeks(1), MONDAY.plusWeeks(1), true, 0)));
    assertRuleUnchanged(fixture.regraId());

    assertReservationsConflict(() -> configuration.alterarRegra(fixture.regraId(),
        ruleCommand(fixture, LocalTime.of(8, 0), LocalTime.of(11, 0),
            MONDAY.minusWeeks(1), MONDAY.minusDays(1), true, 0)));
    assertRuleUnchanged(fixture.regraId());
  }

  @Test
  void clinicDeactivationOrTimeZoneChangeCannotInvalidateFutureReservation() {
    Fixture fixture = fixture("clinic-guard", LocalTime.of(8, 0), LocalTime.of(10, 0), 30,
        MONDAY.minusWeeks(1), MONDAY.plusWeeks(1));
    appointments.criar(fixture.patient(), fixture.regraId(), offset(8, 0));
    var singleton = clinic.clinica();

    assertReservationsConflict(() -> clinic.alterarClinica(singleton.version(), singleton.nome(),
        singleton.timeZone(), false));
    assertClinicUnchanged(singleton);

    assertReservationsConflict(() -> clinic.alterarClinica(singleton.version(), singleton.nome(),
        "UTC", true));
    assertClinicUnchanged(singleton);
  }

  @Test
  void unitDeactivationCannotInvalidateFutureReservationAndRollsBack() {
    Fixture fixture = fixture("unit-guard", LocalTime.of(8, 0), LocalTime.of(10, 0), 30,
        MONDAY.minusWeeks(1), MONDAY.plusWeeks(1));
    appointments.criar(fixture.patient(), fixture.regraId(), offset(8, 0));
    var unit = unidadeRepository.findById(fixture.unidadeId()).orElseThrow();

    assertReservationsConflict(() -> clinic.alterarUnidade(unit.id(), unit.version(),
        "Unidade não persistida", "Endereço não persistido", false));

    var persisted = unidadeRepository.findById(unit.id()).orElseThrow();
    assertThat(persisted.nome()).isEqualTo(unit.nome());
    assertThat(persisted.endereco()).isEqualTo(unit.endereco());
    assertThat(persisted.ativo()).isTrue();
    assertThat(persisted.version()).isEqualTo(unit.version());
  }

  @Test
  void roomDeactivationRollsBackForActiveReservationButIgnoresCancelledOne() {
    Fixture fixture = fixture("room-guard", LocalTime.of(8, 0), LocalTime.of(10, 0), 30,
        MONDAY.minusWeeks(1), MONDAY.plusWeeks(1));
    var reserved = appointments.criar(fixture.patient(), fixture.regraId(), offset(8, 0));
    var room = consultorioRepository.findById(fixture.consultorioId()).orElseThrow();

    assertReservationsConflict(() -> clinic.alterarConsultorio(room.id(), fixture.unidadeId(),
        room.version(), "Sala não persistida", false));
    var rolledBack = consultorioRepository.findById(room.id()).orElseThrow();
    assertThat(rolledBack.nome()).isEqualTo(room.nome());
    assertThat(rolledBack.ativo()).isTrue();
    assertThat(rolledBack.version()).isEqualTo(room.version());

    appointments.cancelar(fixture.patient(), reserved.id(), reserved.version());
    var deactivated = clinic.alterarConsultorio(room.id(), fixture.unidadeId(), room.version(),
        room.nome(), false);
    assertThat(deactivated.ativo()).isFalse();
  }

  @Test
  void specialtyDeactivationCannotInvalidateFutureReservationAndRollsBack() {
    Fixture fixture = fixture("specialty-guard", LocalTime.of(8, 0), LocalTime.of(10, 0), 30,
        MONDAY.minusWeeks(1), MONDAY.plusWeeks(1));
    appointments.criar(fixture.patient(), fixture.regraId(), offset(8, 0));
    var specialty = especialidadeRepository.findById(fixture.especialidadeId()).orElseThrow();

    assertReservationsConflict(() -> clinic.alterarEspecialidade(specialty.id(), specialty.version(),
        "Especialidade não persistida", false));

    var persisted = especialidadeRepository.findById(specialty.id()).orElseThrow();
    assertThat(persisted.nome()).isEqualTo(specialty.nome());
    assertThat(persisted.ativo()).isTrue();
    assertThat(persisted.version()).isEqualTo(specialty.version());
  }

  @Test
  void doctorDeactivationOrBookedSpecialtyRemovalCannotInvalidateReservation() {
    Fixture fixture = fixture("doctor-guard", LocalTime.of(8, 0), LocalTime.of(10, 0), 30,
        MONDAY.minusWeeks(1), MONDAY.plusWeeks(1));
    appointments.criar(fixture.patient(), fixture.regraId(), offset(8, 0));
    var doctor = clinic.medicos(true, PageRequest.of(0, 100)).stream()
        .filter(value -> value.id().equals(fixture.medicoId())).findFirst().orElseThrow();

    assertReservationsConflict(() -> clinic.alterarMedico(doctor.id(), doctor.version(),
        "Médico não persistido", doctor.crmNumero(), doctor.crmUf(),
        List.of(fixture.especialidadeId()), false));
    assertDoctorUnchanged(doctor, fixture.especialidadeId());

    var replacement = clinic.criarEspecialidade("Especialidade substituta doctor-guard", true);
    assertReservationsConflict(() -> clinic.alterarMedico(doctor.id(), doctor.version(),
        doctor.nome(), doctor.crmNumero(), doctor.crmUf(), List.of(replacement.id()), true));
    assertDoctorUnchanged(doctor, fixture.especialidadeId());
  }

  @Test
  void serializesTwentyDistinctPatientsWithExactlyOneWinnerInThreeControlledRounds()
      throws Exception {
    Fixture fixture = fixture("concurrency", LocalTime.of(8, 0), LocalTime.of(12, 0), 30,
        MONDAY, null);
    List<AuthenticatedActor> actors = IntStream.range(0, 20)
        .mapToObj(index -> patient("concurrency-patient-" + index)).toList();

    var executor = Executors.newFixedThreadPool(20);
    try {
      for (int round = 0; round < 3; round++) {
        long successesBefore = auditEvents.countByActionAndResult(
            AuditAction.AGENDAR, AuditResult.SUCESSO);
        OffsetDateTime target = offset(8 + round, 0);
        CountDownLatch ready = new CountDownLatch(20);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger success = new AtomicInteger();
        AtomicInteger expectedConflicts = new AtomicInteger();
        List<Throwable> unexpected = java.util.Collections.synchronizedList(new ArrayList<>());
        var futures = actors.stream().map(actor -> executor.submit(() -> {
          ready.countDown();
          try {
            if (!start.await(10, TimeUnit.SECONDS)) {
              throw new AssertionError("barreira de início expirou");
            }
            appointments.criar(actor, fixture.regraId(), target);
            success.incrementAndGet();
          } catch (BusinessConflictException exception) {
            if (exception.code().equals("HORARIO_INDISPONIVEL")) expectedConflicts.incrementAndGet();
            else unexpected.add(exception);
          } catch (Throwable throwable) {
            unexpected.add(throwable);
          }
        })).toList();

        assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
        start.countDown();
        for (var future : futures) future.get(20, TimeUnit.SECONDS);

        assertThat(unexpected).isEmpty();
        assertThat(success).hasValue(1);
        assertThat(expectedConflicts).hasValue(19);

        Instant targetStart = target.toInstant();
        Instant targetEnd = target.plusMinutes(30).toInstant();
        var persisted = appointmentRepository.findOcupacoesDoMedicoOuConsultorio(
            fixture.patient().clinicaId(), fixture.medicoId(), fixture.consultorioId(),
            targetStart, targetEnd);
        assertThat(persisted).hasSize(1);
        assertThat(persisted.getFirst().status()).isNotEqualTo(StatusAgendamento.CANCELADA);
        assertThat(persisted.getFirst().inicio()).isEqualTo(targetStart);
        assertThat(persisted.getFirst().fim()).isEqualTo(targetEnd);
        assertThat(auditEvents.countByActionAndResult(
            AuditAction.AGENDAR, AuditResult.SUCESSO) - successesBefore).isEqualTo(1);
      }
    } finally {
      executor.shutdownNow();
      assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
    }
  }

  @Test
  void revalidatesPatientOwnershipAfterWaitingForClinicLockWithoutSleeps() throws Exception {
    Fixture fixture = fixture("post-lock-auth", LocalTime.of(8, 0), LocalTime.of(10, 0), 30,
        MONDAY.minusWeeks(1), MONDAY.plusWeeks(1));
    var reserved = appointments.criar(fixture.patient(), fixture.regraId(), offset(8, 0));
    var newOwner = patient("post-lock-new-owner");
    var executor = Executors.newSingleThreadExecutor();

    try (var lockConnection = dataSource.getConnection()) {
      lockConnection.setAutoCommit(false);
      try (var statement = lockConnection.prepareStatement(
          "select id from clinica where singleton = true for update")) {
        statement.executeQuery().close();
      }

      var future = executor.submit(() ->
          appointments.cancelar(fixture.patient(), reserved.id(), reserved.version()));
      assertThat(awaitClinicLockWait()).as("comando aguardando lock da Clínica").isTrue();

      jdbc.update("update agendamento set paciente_id = ? where id = ?",
          newOwner.pacienteId(), reserved.id());
      lockConnection.commit();

      assertThatThrownBy(() -> getFuture(future))
          .isInstanceOf(ResourceNotFoundException.class);
      assertThat(appointmentRepository.findById(reserved.id()).orElseThrow().status())
          .isEqualTo(StatusAgendamento.AGENDADA);
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

  private Fixture fixture(String suffix, LocalTime start, LocalTime end, int duration,
      LocalDate vigenteDe, LocalDate vigenteAte) {
    var specialty = clinic.criarEspecialidade("Especialidade " + suffix, true);
    var unit = clinic.criarUnidade("Unidade " + suffix, "Endereço sintético " + suffix, true);
    var room = clinic.criarConsultorio(unit.id(), "Sala " + suffix, true);
    var doctor = clinic.criarMedico("Médico " + suffix,
        Integer.toString(Math.abs(suffix.hashCode())), "PA", List.of(specialty.id()), true);
    var rule = configuration.criarRegra(new SchedulingConfigurationService.RegraCommand(
        doctor.id(), specialty.id(), room.id(), DayOfWeek.MONDAY, start, end, duration,
        vigenteDe, vigenteAte, true, 0));
    AuthenticatedActor patient = patient("patient-" + suffix);
    return new Fixture(rule.id(), doctor.id(), specialty.id(), unit.id(), room.id(),
        patient.pacienteId(), patient);
  }

  private SchedulingConfigurationService.RegraCommand ruleCommand(Fixture fixture,
      LocalTime start, LocalTime end, LocalDate validFrom, LocalDate validUntil,
      boolean active, long expectedVersion) {
    return new SchedulingConfigurationService.RegraCommand(
        fixture.medicoId(), fixture.especialidadeId(), fixture.consultorioId(),
        DayOfWeek.MONDAY, start, end, 30, validFrom, validUntil, active, expectedVersion);
  }

  private void assertRuleUnchanged(UUID ruleId) {
    var persisted = ruleRepository.findById(ruleId).orElseThrow();
    assertThat(persisted.ativo()).isTrue();
    assertThat(persisted.horaInicio()).isEqualTo(LocalTime.of(8, 0));
    assertThat(persisted.horaFim()).isEqualTo(LocalTime.of(11, 0));
    assertThat(persisted.vigenteDe()).isEqualTo(MONDAY.minusWeeks(1));
    assertThat(persisted.vigenteAte()).isEqualTo(MONDAY.plusWeeks(1));
    assertThat(persisted.version()).isZero();
  }

  private void assertClinicUnchanged(br.com.medflow.clinic.domain.Clinica expected) {
    var persisted = clinic.clinica();
    assertThat(persisted.nome()).isEqualTo(expected.nome());
    assertThat(persisted.timeZone()).isEqualTo(expected.timeZone());
    assertThat(persisted.ativo()).isTrue();
    assertThat(persisted.version()).isEqualTo(expected.version());
  }

  private void assertDoctorUnchanged(
      br.com.medflow.clinic.domain.Medico expected, UUID bookedSpecialtyId) {
    var persisted = clinic.medicos(true, PageRequest.of(0, 100)).stream()
        .filter(value -> value.id().equals(expected.id())).findFirst().orElseThrow();
    assertThat(persisted.nome()).isEqualTo(expected.nome());
    assertThat(persisted.ativo()).isTrue();
    assertThat(persisted.version()).isEqualTo(expected.version());
    assertThat(persisted.especialidades()).extracting(value -> value.id())
        .containsExactly(bookedSpecialtyId);
  }

  private AuthenticatedActor patient(String subject) {
    var patient = provisioning.provisionar(subject, "Paciente " + subject);
    var singleton = clinic.clinica();
    return new AuthenticatedActor(subject, Set.of("PATIENT"), patient.id(), null,
        singleton.id(), singleton.timeZone());
  }

  private void persistHistorical(UUID patientId, UUID doctorId, UUID specialtyId, UUID roomId,
      Instant start, Instant end) {
    var singleton = clinic.clinica();
    appointmentRepository.saveAndFlush(new Agendamento(singleton,
        pacienteRepository.findById(patientId).orElseThrow(),
        medicoRepository.findById(doctorId).orElseThrow(),
        especialidadeRepository.findById(specialtyId).orElseThrow(),
        consultorioRepository.findById(roomId).orElseThrow(), start, end));
  }

  private static void assertUnavailable(org.assertj.core.api.ThrowableAssert.ThrowingCallable call) {
    assertThatThrownBy(call).isInstanceOf(BusinessConflictException.class)
        .extracting(error -> ((BusinessConflictException) error).code())
        .isEqualTo("HORARIO_INDISPONIVEL");
  }

  private static void assertReservationsConflict(
      org.assertj.core.api.ThrowableAssert.ThrowingCallable call) {
    assertThatThrownBy(call).isInstanceOf(BusinessConflictException.class)
        .extracting(error -> ((BusinessConflictException) error).code())
        .isEqualTo("CONFIGURACAO_COM_RESERVAS");
  }

  private static OffsetDateTime offset(int hour, int minute) {
    return MONDAY.atTime(hour, minute).atZone(BELEM).toOffsetDateTime();
  }

  private static Instant instant(int hour, int minute) {
    return offset(hour, minute).toInstant();
  }

  private record Fixture(UUID regraId, UUID medicoId, UUID especialidadeId,
      UUID unidadeId, UUID consultorioId, UUID patientId, AuthenticatedActor patient) { }
}
