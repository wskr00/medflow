package br.com.medflow.scheduling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.medflow.PostgresTestConfiguration;
import br.com.medflow.clinic.application.ClinicConfigurationService;
import br.com.medflow.clinic.application.PatientProvisioningService;
import br.com.medflow.clinic.persistence.ConsultorioRepository;
import br.com.medflow.clinic.persistence.EspecialidadeRepository;
import br.com.medflow.clinic.persistence.MedicoRepository;
import br.com.medflow.clinic.persistence.PacienteRepository;
import br.com.medflow.common.auth.AuthenticatedActor;
import br.com.medflow.common.http.BusinessConflictException;
import br.com.medflow.scheduling.application.AppointmentService;
import br.com.medflow.scheduling.application.SchedulingConfigurationService;
import br.com.medflow.scheduling.domain.Agendamento;
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
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;

@SpringBootTest
@Import({PostgresTestConfiguration.class, FixedSchedulingClockConfiguration.class})
class AppointmentPersistenceIntegrationTests {

  private static final LocalDate MONDAY = LocalDate.of(2026, 9, 21);
  private static final ZoneId BELEM = ZoneId.of("America/Belem");

  @Autowired private ClinicConfigurationService clinic;
  @Autowired private PatientProvisioningService provisioning;
  @Autowired private SchedulingConfigurationService configuration;
  @Autowired private AppointmentService appointments;
  @Autowired private AgendamentoRepository appointmentRepository;
  @Autowired private PacienteRepository pacienteRepository;
  @Autowired private MedicoRepository medicoRepository;
  @Autowired private EspecialidadeRepository especialidadeRepository;
  @Autowired private ConsultorioRepository consultorioRepository;

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
  void serializesTwentyDistinctPatientsWithExactlyOneWinnerInThreeControlledRounds()
      throws Exception {
    Fixture fixture = fixture("concurrency", LocalTime.of(8, 0), LocalTime.of(12, 0), 30,
        MONDAY, null);
    List<AuthenticatedActor> actors = IntStream.range(0, 20)
        .mapToObj(index -> patient("concurrency-patient-" + index)).toList();

    try (var executor = Executors.newFixedThreadPool(20)) {
      for (int round = 0; round < 3; round++) {
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
      }
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

  private static OffsetDateTime offset(int hour, int minute) {
    return MONDAY.atTime(hour, minute).atZone(BELEM).toOffsetDateTime();
  }

  private static Instant instant(int hour, int minute) {
    return offset(hour, minute).toInstant();
  }

  private record Fixture(UUID regraId, UUID medicoId, UUID especialidadeId,
      UUID unidadeId, UUID consultorioId, UUID patientId, AuthenticatedActor patient) { }
}
