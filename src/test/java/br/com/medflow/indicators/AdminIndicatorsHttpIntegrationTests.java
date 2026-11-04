package br.com.medflow.indicators;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.medflow.PostgresTestConfiguration;
import br.com.medflow.care.application.CareService;
import br.com.medflow.clinic.application.ClinicConfigurationService;
import br.com.medflow.clinic.application.PatientProvisioningService;
import br.com.medflow.common.auth.AuthenticatedActor;
import br.com.medflow.indicators.application.AdminIndicatorsService;
import br.com.medflow.indicators.persistence.AdminIndicatorsRepository;
import br.com.medflow.reception.application.ReceptionService;
import br.com.medflow.scheduling.FixedSchedulingClockConfiguration;
import br.com.medflow.scheduling.application.AppointmentService;
import br.com.medflow.scheduling.application.SchedulingConfigurationService;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
    "spring.security.oauth2.resourceserver.jwt.issuer-uri=http://issuer.test/realms/medflow",
    "spring.security.oauth2.resourceserver.jwt.jwk-set-uri=http://localhost.invalid/jwks",
    "spring.security.oauth2.resourceserver.jwt.audiences=medflow-api"
})
@AutoConfigureMockMvc
@Import({PostgresTestConfiguration.class, FixedSchedulingClockConfiguration.class})
class AdminIndicatorsHttpIntegrationTests {

  private static final ZoneId CLINIC_ZONE = ZoneId.of("America/Belem");
  private static final LocalDate REPORT_DAY = LocalDate.of(2026, 9, 16);
  private static final AtomicInteger IDS = new AtomicInteger();

  @Autowired private MockMvc mvc;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private ClinicConfigurationService clinic;
  @Autowired private PatientProvisioningService patients;
  @Autowired private SchedulingConfigurationService scheduling;
  @Autowired private AppointmentService appointments;
  @Autowired private ReceptionService reception;
  @Autowired private CareService care;
  @Autowired private AdminIndicatorsService adminIndicators;
  @Autowired private AdminIndicatorsRepository indicatorRepository;

  @Test
  void aggregatesStatesDimensionsAndLocalDateBasesWithoutLeakingClinicalData() throws Exception {
    Fixture fixture = fixture("admin-aggregate");
    LocalDate aggregateDay = LocalDate.of(2040, 9, 16);
    insertAppointment(fixture, UUID.randomUUID(), localInstant(aggregateDay, 10, 0),
        fixture.primaryRoomId(), fixture.primarySpecialtyId(), "AGENDADA");
    insertAppointment(fixture, UUID.randomUUID(), localInstant(aggregateDay, 11, 0),
        fixture.primaryRoomId(), fixture.primarySpecialtyId(), "CANCELADA");
    insertAppointment(fixture, UUID.randomUUID(), localInstant(aggregateDay, 12, 0),
        fixture.secondaryRoomId(), fixture.secondarySpecialtyId(), "EM_ESPERA");
    insertAppointment(fixture, UUID.randomUUID(), localInstant(aggregateDay, 13, 0),
        fixture.secondaryRoomId(), fixture.secondarySpecialtyId(), "EM_ATENDIMENTO");

    UUID completedAppointment = UUID.randomUUID();
    insertAppointment(fixture, completedAppointment,
        Instant.parse("2040-09-17T02:30:00Z"), fixture.secondaryRoomId(),
        fixture.secondarySpecialtyId(), "FINALIZADA"); // Sep 16, 23:30 in Belém.
    insertCare(completedAppointment, Instant.parse("2040-09-17T03:00:00Z"),
        Instant.parse("2040-09-17T03:10:00Z")); // Sep 17, 00:10 in Belém.

    mvc.perform(get("/api/admin/indicadores?inicio=%s&fim=%s"
            .formatted(aggregateDay, aggregateDay))
            .with(administrator("admin-indicators-aggregate")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.timeZone").value("America/Belem"))
        .andExpect(jsonPath("$.consultasPorDataAgendada.totalConsultas").value(5))
        .andExpect(jsonPath("$.consultasPorDataAgendada.agendadas").value(1))
        .andExpect(jsonPath("$.consultasPorDataAgendada.emEspera").value(1))
        .andExpect(jsonPath("$.consultasPorDataAgendada.emAtendimento").value(1))
        .andExpect(jsonPath("$.consultasPorDataAgendada.finalizadas").value(1))
        .andExpect(jsonPath("$.consultasPorDataAgendada.canceladas").value(1))
        .andExpect(jsonPath("$.consultasPorDataAgendada.porDia[0].data").value(aggregateDay.toString()))
        .andExpect(jsonPath("$.consultasPorDataAgendada.porUnidade[?(@.id == '%s')].totalConsultas"
            .formatted(fixture.primaryUnitId())).value(2))
        .andExpect(jsonPath("$.consultasPorDataAgendada.porEspecialidade[?(@.id == '%s')].totalConsultas"
            .formatted(fixture.secondarySpecialtyId())).value(3))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.totalFinalizadas").value(0))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.porDia").isEmpty())
        .andExpect(content().string(not(containsString("clinical-secret"))))
        .andExpect(jsonPath("$.pacienteId").doesNotExist())
        .andExpect(jsonPath("$.atendimentoId").doesNotExist());

    LocalDate finalizationDay = aggregateDay.plusDays(1);
    mvc.perform(get("/api/admin/indicadores?inicio=%s&fim=%s"
            .formatted(finalizationDay, finalizationDay))
            .with(administrator("admin-indicators-finalized")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.consultasPorDataAgendada.totalConsultas").value(0))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.totalFinalizadas").value(1))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.porDia[0].data")
            .value(finalizationDay.toString()))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.porUnidade[0].id")
            .value(fixture.secondaryUnitId().toString()))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.porEspecialidade[0].id")
            .value(fixture.secondarySpecialtyId().toString()));

    mvc.perform(get("/api/admin/indicadores?inicio=%s&fim=%s&unidadeId=%s"
            .formatted(aggregateDay, aggregateDay, fixture.primaryUnitId()))
            .with(administrator("admin-indicators-unit-filter")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.consultasPorDataAgendada.totalConsultas").value(2))
        .andExpect(jsonPath("$.consultasPorDataAgendada.canceladas").value(1));

    mvc.perform(get("/api/admin/indicadores?inicio=%s&fim=%s&especialidadeId=%s"
            .formatted(aggregateDay, aggregateDay, fixture.secondarySpecialtyId()))
            .with(administrator("admin-indicators-specialty-filter")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.consultasPorDataAgendada.totalConsultas").value(3));

    mvc.perform(get("/api/admin/indicadores?inicio=%s&fim=%s&unidadeId=%s&especialidadeId=%s"
            .formatted(aggregateDay, aggregateDay, fixture.primaryUnitId(),
                fixture.secondarySpecialtyId()))
            .with(administrator("admin-indicators-combined-filter")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.consultasPorDataAgendada.totalConsultas").value(0))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.totalFinalizadas").value(0));
  }

  @Test
  void reflectsRealAppointmentStateTransitionsAndCancellation() throws Exception {
    Fixture fixture = fixture("admin-transitions");
    appointments.criar(fixture.patientActor(), fixture.ruleId(), localSlot(10));

    var waiting = appointments.criar(fixture.patientActor(), fixture.ruleId(), localSlot(11));
    reception.checkIn(fixture.receptionistActor(), waiting.id(), waiting.version());

    var inCare = appointments.criar(fixture.patientActor(), fixture.ruleId(), localSlot(12));
    var checkedIn = reception.checkIn(fixture.receptionistActor(), inCare.id(), inCare.version());
    care.start(fixture.doctorActor(), checkedIn.id(), checkedIn.version());

    var finalized = appointments.criar(fixture.patientActor(), fixture.ruleId(), localSlot(13));
    var finalizedWaiting = reception.checkIn(
        fixture.receptionistActor(), finalized.id(), finalized.version());
    var started = care.start(fixture.doctorActor(), finalizedWaiting.id(), finalizedWaiting.version());
    var draft = care.saveDraft(fixture.doctorActor(), started.atendimento().id(),
        started.atendimento().version(), "Queixa", "Resumo", "Conduta", "");
    care.finish(fixture.doctorActor(), draft.atendimento().id(), draft.atendimento().version());

    var cancelled = appointments.criar(fixture.patientActor(), fixture.ruleId(), localSlot(14));
    appointments.cancelar(fixture.patientActor(), cancelled.id(), cancelled.version());

    mvc.perform(get("/api/admin/indicadores?inicio=2026-09-16&fim=2026-09-16&unidadeId="
            + fixture.primaryUnitId())
            .with(administrator("admin-indicators-transitions")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.consultasPorDataAgendada.totalConsultas").value(5))
        .andExpect(jsonPath("$.consultasPorDataAgendada.agendadas").value(1))
        .andExpect(jsonPath("$.consultasPorDataAgendada.emEspera").value(1))
        .andExpect(jsonPath("$.consultasPorDataAgendada.emAtendimento").value(1))
        .andExpect(jsonPath("$.consultasPorDataAgendada.finalizadas").value(1))
        .andExpect(jsonPath("$.consultasPorDataAgendada.canceladas").value(1))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.totalFinalizadas").value(1));
  }

  @Test
  void limitsAuthorizationFiltersAndClinicScope() throws Exception {
    Fixture fixture = fixture("admin-validation");
    var admin = administrator("admin-indicators-validation");

    for (String role : List.of("PATIENT", "RECEPTIONIST", "DOCTOR")) {
      mvc.perform(get("/api/admin/indicadores?inicio=2026-09-16&fim=2026-09-16")
              .with(principal("admin-indicators-denied-" + role, role)))
          .andExpect(status().isForbidden());
    }

    mvc.perform(get("/api/admin/indicadores?inicio=2026-01-01&fim=2027-01-02").with(admin))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("ENTRADA_INVALIDA"));
    mvc.perform(get("/api/admin/indicadores?inicio=2026-09-17&fim=2026-09-16").with(admin))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/admin/indicadores?inicio=2041-01-01&fim=2042-01-01").with(admin))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.consultasPorDataAgendada.totalConsultas").value(0));
    mvc.perform(get("/api/admin/indicadores?inicio=2026-09-16&fim=2026-09-16&unidadeId="
            + UUID.randomUUID()).with(admin))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/admin/indicadores?inicio=2026-09-16&fim=2026-09-16&especialidadeId="
            + UUID.randomUUID()).with(admin))
        .andExpect(status().isNotFound());

    var wrongClinicActor = new AuthenticatedActor("scope-test", Set.of("ADMINISTRATOR"),
        null, null, UUID.randomUUID(), "America/Belem");
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> adminIndicators.find(
        wrongClinicActor, REPORT_DAY, REPORT_DAY, null, null))
        .isInstanceOf(br.com.medflow.common.http.ResourceNotFoundException.class);
    org.assertj.core.api.Assertions.assertThat(indicatorRepository.findScheduled(
        UUID.randomUUID(), REPORT_DAY.atStartOfDay(CLINIC_ZONE).toInstant(),
        REPORT_DAY.plusDays(1).atStartOfDay(CLINIC_ZONE).toInstant(), null, null)).isEmpty();
  }

  @Test
  void emptyPeriodReturnsZeroWithoutInventingDailyRows() throws Exception {
    fixture("admin-empty");
    mvc.perform(get("/api/admin/indicadores?inicio=2041-09-16&fim=2041-09-16")
            .with(administrator("admin-indicators-empty")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.consultasPorDataAgendada.totalConsultas").value(0))
        .andExpect(jsonPath("$.consultasPorDataAgendada.porDia").isEmpty())
        .andExpect(jsonPath("$.finalizacoesPorDataReal.totalFinalizadas").value(0))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.porDia").isEmpty());
  }

  private Fixture fixture(String name) {
    String suffix = name + "-" + IDS.incrementAndGet();
    var primarySpecialty = clinic.criarEspecialidade("Indicadores A " + suffix, true);
    var secondarySpecialty = clinic.criarEspecialidade("Indicadores B " + suffix, true);
    var primaryUnit = clinic.criarUnidade("Indicadores A " + suffix, "Endereço A " + suffix, true);
    var secondaryUnit = clinic.criarUnidade("Indicadores B " + suffix, "Endereço B " + suffix, true);
    var primaryRoom = clinic.criarConsultorio(primaryUnit.id(), "Sala A " + suffix, true);
    var secondaryRoom = clinic.criarConsultorio(secondaryUnit.id(), "Sala B " + suffix, true);
    String doctorSubject = "doctor-admin-indicators-" + suffix;
    var doctor = clinic.criarMedico("Médico " + suffix,
        Integer.toString(920000 + IDS.get()), "PA",
        List.of(primarySpecialty.id(), secondarySpecialty.id()), true);
    clinic.provisionarSubjectMedico(doctor.id(), doctorSubject);
    String patientSubject = "patient-admin-indicators-" + suffix;
    var patient = patients.provisionar(patientSubject, "Paciente " + suffix);
    var clinicView = clinic.clinica();
    var rule = scheduling.criarRegra(new SchedulingConfigurationService.RegraCommand(
        doctor.id(), primarySpecialty.id(), primaryRoom.id(), DayOfWeek.WEDNESDAY,
        LocalTime.of(10, 0), LocalTime.of(15, 30), 30, REPORT_DAY, REPORT_DAY, true, 0));
    return new Fixture(clinicView.id(), doctor.id(), patient.id(), primaryUnit.id(),
        primarySpecialty.id(), primaryRoom.id(), secondaryUnit.id(), secondarySpecialty.id(),
        secondaryRoom.id(), rule.id(),
        new AuthenticatedActor(patientSubject, Set.of("PATIENT"), patient.id(), null,
            clinicView.id(), clinicView.timeZone()),
        new AuthenticatedActor(doctorSubject, Set.of("DOCTOR"), null, doctor.id(),
            clinicView.id(), clinicView.timeZone()),
        new AuthenticatedActor("reception-admin-indicators-" + suffix,
            Set.of("RECEPTIONIST"), null, null, clinicView.id(), clinicView.timeZone()));
  }

  private void insertAppointment(Fixture fixture, UUID id, Instant startsAt,
      UUID roomId, UUID specialtyId, String statusValue) {
    jdbc.update("""
        insert into agendamento
          (id, clinica_id, paciente_id, medico_id, especialidade_id, consultorio_id,
           inicio, fim, status, check_in_em, version)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, null, 0)
        """, id, fixture.clinicId(), fixture.patientId(), fixture.doctorId(), specialtyId,
        roomId, Timestamp.from(startsAt), Timestamp.from(startsAt.plusSeconds(1800)), statusValue);
  }

  private void insertCare(UUID appointmentId, Instant startedAt, Instant finishedAt) {
    jdbc.update("""
        insert into atendimento
          (id, agendamento_id, iniciado_em, finalizado_em, queixa_principal,
           resumo_anamnese, conduta, observacoes, version)
        values (?, ?, ?, ?, 'clinical-secret complaint', 'clinical-secret history',
                'clinical-secret plan', 'clinical-secret notes', 0)
        """, UUID.randomUUID(), appointmentId, Timestamp.from(startedAt), Timestamp.from(finishedAt));
  }

  private static Instant localInstant(LocalDate day, int hour, int minute) {
    return day.atTime(hour, minute).atZone(CLINIC_ZONE).toInstant();
  }

  private static OffsetDateTime localSlot(int hour) {
    return REPORT_DAY.atTime(hour, 0).atZone(CLINIC_ZONE).toOffsetDateTime();
  }

  private static RequestPostProcessor administrator(String subject) {
    return principal(subject, "ADMINISTRATOR");
  }

  private static RequestPostProcessor principal(String subject, String... roles) {
    List<GrantedAuthority> authorities = java.util.Arrays.stream(roles)
        .map(role -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + role)).toList();
    return jwt().jwt(org.springframework.security.oauth2.jwt.Jwt.withTokenValue("synthetic")
        .header("alg", "none").subject(subject)
        .issuer("http://issuer.test/realms/medflow").audience(List.of("medflow-api"))
        .issuedAt(Instant.parse("2026-09-16T11:00:00Z"))
        .expiresAt(Instant.parse("2026-09-16T13:00:00Z"))
        .claim("resource_access", Map.of("medflow-api", Map.of("roles", List.of(roles))))
        .build()).authorities(authorities);
  }

  private record Fixture(UUID clinicId, UUID doctorId, UUID patientId,
      UUID primaryUnitId, UUID primarySpecialtyId, UUID primaryRoomId,
      UUID secondaryUnitId, UUID secondarySpecialtyId, UUID secondaryRoomId,
      UUID ruleId, AuthenticatedActor patientActor, AuthenticatedActor doctorActor,
      AuthenticatedActor receptionistActor) { }
}
