package br.com.medflow.indicators;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
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
import br.com.medflow.reception.application.ReceptionService;
import br.com.medflow.scheduling.application.AppointmentService;
import br.com.medflow.scheduling.application.SchedulingConfigurationService;
import br.com.medflow.scheduling.FixedSchedulingClockConfiguration;
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
class DoctorIndicatorsHttpIntegrationTests {

  private static final ZoneId CLINIC_ZONE = ZoneId.of("America/Belem");
  private static final AtomicInteger IDS = new AtomicInteger();

  @Autowired private MockMvc mvc;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private ClinicConfigurationService clinic;
  @Autowired private PatientProvisioningService patients;
  @Autowired private SchedulingConfigurationService scheduling;
  @Autowired private AppointmentService appointments;
  @Autowired private ReceptionService reception;
  @Autowired private CareService care;

  @Test
  void returnsCurrentAppointmentStatesAndRealFinalizationDurationWithoutClinicalData()
      throws Exception {
    Fixture fixture = fixture("states");
    LocalDate day = LocalDate.of(2026, 9, 16);
    String[] statuses = {"AGENDADA", "EM_ESPERA", "EM_ATENDIMENTO", "FINALIZADA", "CANCELADA"};
    for (int index = 0; index < statuses.length; index++) {
      Instant startsAt = day.atTime(10 + index, 0).atZone(CLINIC_ZONE).toInstant();
      UUID appointmentId = UUID.randomUUID();
      insertAppointment(fixture, appointmentId, startsAt, statuses[index]);
      if ("EM_ATENDIMENTO".equals(statuses[index])) {
        insertCare(appointmentId, startsAt.plusSeconds(300), null, "draft-clinical-secret");
      }
      if ("FINALIZADA".equals(statuses[index])) {
        insertCare(appointmentId, startsAt.plusSeconds(300), startsAt.plusSeconds(1200),
            "finalized-clinical-secret");
      }
    }

    mvc.perform(get("/api/medico/indicadores?inicio=2026-09-16&fim=2026-09-16")
            .with(doctor(fixture.subject())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.timeZone").value("America/Belem"))
        .andExpect(jsonPath("$.consultasPorDataAgendada.totalConsultas").value(5))
        .andExpect(jsonPath("$.consultasPorDataAgendada.agendadas").value(1))
        .andExpect(jsonPath("$.consultasPorDataAgendada.emEspera").value(1))
        .andExpect(jsonPath("$.consultasPorDataAgendada.emAtendimento").value(1))
        .andExpect(jsonPath("$.consultasPorDataAgendada.finalizadas").value(1))
        .andExpect(jsonPath("$.consultasPorDataAgendada.canceladas").value(1))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.totalFinalizadas").value(1))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.duracaoMediaSegundos").value(900.00))
        .andExpect(jsonPath("$.consultasPorDataAgendada.porDia[0].data").value("2026-09-16"))
        .andExpect(content().string(not(containsString("clinical-secret"))))
        .andExpect(jsonPath("$.medicoId").doesNotExist())
        .andExpect(jsonPath("$.pacienteId").doesNotExist());
  }

  @Test
  void groupsScheduledAndFinishedConsultationsByTheirOwnClinicLocalDates() throws Exception {
    Fixture fixture = fixture("date-bases");
    UUID appointmentId = UUID.randomUUID();
    Instant scheduledAt = Instant.parse("2026-09-17T02:30:00Z"); // Sep 16, 23:30 in Belém.
    Instant startedAt = Instant.parse("2026-09-17T02:40:00Z");
    Instant finishedAt = Instant.parse("2026-09-17T03:10:00Z"); // Sep 17, 00:10 in Belém.
    insertAppointment(fixture, appointmentId, scheduledAt, "FINALIZADA");
    insertCare(appointmentId, startedAt, finishedAt, "date-bases-clinical-secret");

    mvc.perform(get("/api/medico/indicadores?inicio=2026-09-16&fim=2026-09-16")
            .with(doctor(fixture.subject())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.consultasPorDataAgendada.totalConsultas").value(1))
        .andExpect(jsonPath("$.consultasPorDataAgendada.porDia[0].data").value("2026-09-16"))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.totalFinalizadas").value(0))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.duracaoMediaSegundos").value(nullValue()));

    mvc.perform(get("/api/medico/indicadores?inicio=2026-09-17&fim=2026-09-17")
            .with(doctor(fixture.subject())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.consultasPorDataAgendada.totalConsultas").value(0))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.totalFinalizadas").value(1))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.duracaoMediaSegundos").value(1800.00))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.porDia[0].data").value("2026-09-17"));
  }

  @Test
  void dailyViewReflectsAppointmentsAcrossRealDomainTransitions() throws Exception {
    Fixture fixture = fixture("transitions");
    appointments.criar(fixture.patient(), fixture.ruleId(), localSlot(10));
    var waiting = appointments.criar(fixture.patient(), fixture.ruleId(), localSlot(11));
    reception.checkIn(fixture.receptionist(), waiting.id(), waiting.version());

    var inCare = appointments.criar(fixture.patient(), fixture.ruleId(), localSlot(12));
    var inCareWaiting = reception.checkIn(
        fixture.receptionist(), inCare.id(), inCare.version());
    care.start(fixture.doctor(), inCareWaiting.id(), inCareWaiting.version());

    var finalized = appointments.criar(fixture.patient(), fixture.ruleId(), localSlot(13));
    var finalizedWaiting = reception.checkIn(
        fixture.receptionist(), finalized.id(), finalized.version());
    var started = care.start(fixture.doctor(), finalizedWaiting.id(), finalizedWaiting.version());
    var draft = care.saveDraft(fixture.doctor(), started.atendimento().id(),
        started.atendimento().version(), "Queixa", "Resumo", "Conduta", "");
    care.finish(fixture.doctor(), draft.atendimento().id(), draft.atendimento().version());

    var cancelled = appointments.criar(fixture.patient(), fixture.ruleId(), localSlot(14));
    appointments.cancelar(fixture.patient(), cancelled.id(), cancelled.version());

    mvc.perform(get("/api/medico/indicadores?inicio=2026-09-16&fim=2026-09-16")
            .with(doctor(fixture.subject())))
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
  void onlyTheAuthenticatedDoctorsIndicatorsAreReturnedAndOtherRolesAreDenied()
      throws Exception {
    Fixture own = fixture("own-doctor");
    Fixture other = fixture("other-doctor");
    insertAppointment(own, UUID.randomUUID(),
        LocalDate.of(2026, 9, 16).atTime(10, 0).atZone(CLINIC_ZONE).toInstant(), "AGENDADA");
    for (int index = 0; index < 3; index++) {
      insertAppointment(other, UUID.randomUUID(),
          LocalDate.of(2026, 9, 16).atTime(11 + index, 0).atZone(CLINIC_ZONE).toInstant(),
          "AGENDADA");
    }

    mvc.perform(get("/api/medico/indicadores?inicio=2026-09-16&fim=2026-09-16&medicoId="
            + other.doctorId()).with(doctor(own.subject())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.consultasPorDataAgendada.totalConsultas").value(1));

    for (String role : List.of("PATIENT", "RECEPTIONIST", "ADMINISTRATOR")) {
      mvc.perform(get("/api/medico/indicadores?inicio=2026-09-16&fim=2026-09-16")
              .with(principal("indicators-denied-" + role, role)))
          .andExpect(status().isForbidden());
    }
    mvc.perform(get("/api/medico/indicadores?inicio=2026-09-16&fim=2026-09-16")
            .with(doctor("doctor-without-active-link")))
        .andExpect(status().isForbidden());
  }

  @Test
  void emptyPeriodHasZeroCountsAndNoInventedDurationAndRangeIsLimited()
      throws Exception {
    Fixture fixture = fixture("empty-period");
    var doctor = doctor(fixture.subject());

    mvc.perform(get("/api/medico/indicadores?inicio=2027-09-16&fim=2027-09-16").with(doctor))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.consultasPorDataAgendada.totalConsultas").value(0))
        .andExpect(jsonPath("$.consultasPorDataAgendada.porDia").isEmpty())
        .andExpect(jsonPath("$.finalizacoesPorDataReal.totalFinalizadas").value(0))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.duracaoMediaSegundos").value(nullValue()))
        .andExpect(jsonPath("$.finalizacoesPorDataReal.porDia").isEmpty());

    mvc.perform(get("/api/medico/indicadores?inicio=2026-01-01&fim=2027-01-02").with(doctor))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("ENTRADA_INVALIDA"));
  }

  private Fixture fixture(String suffix) {
    suffix = suffix + "-" + IDS.incrementAndGet();
    var specialty = clinic.criarEspecialidade("Indicadores " + suffix, true);
    var unit = clinic.criarUnidade("Unidade " + suffix, "Endereço " + suffix, true);
    var room = clinic.criarConsultorio(unit.id(), "Sala " + suffix, true);
    String subject = "doctor-indicators-" + suffix;
    var doctor = clinic.criarMedico("Médico " + suffix,
        Integer.toString(980000 + IDS.get()), "PA", List.of(specialty.id()), true);
    clinic.provisionarSubjectMedico(doctor.id(), subject);
    String patientSubject = "patient-indicators-" + suffix;
    var patient = patients.provisionar(patientSubject, "Paciente " + suffix);
    var clinicView = clinic.clinica();
    LocalDate today = LocalDate.of(2026, 9, 16);
    var rule = scheduling.criarRegra(new SchedulingConfigurationService.RegraCommand(
        doctor.id(), specialty.id(), room.id(), DayOfWeek.WEDNESDAY,
        LocalTime.of(10, 0), LocalTime.of(15, 0), 30, today, today, true, 0));
    var patientActor = new AuthenticatedActor(patientSubject, Set.of("PATIENT"), patient.id(),
        null, clinicView.id(), clinicView.timeZone());
    var doctorActor = new AuthenticatedActor(subject, Set.of("DOCTOR"), null, doctor.id(),
        clinicView.id(), clinicView.timeZone());
    var receptionistActor = new AuthenticatedActor("reception-indicators-" + suffix,
        Set.of("RECEPTIONIST"), null, null, clinicView.id(), clinicView.timeZone());
    return new Fixture(subject, doctor.id(), patient.id(), specialty.id(), room.id(),
        clinicView.id(), rule.id(), patientActor, doctorActor, receptionistActor);
  }

  private void insertAppointment(Fixture fixture, UUID id, Instant startsAt, String statusValue) {
    jdbc.update("""
        insert into agendamento
          (id, clinica_id, paciente_id, medico_id, especialidade_id, consultorio_id,
           inicio, fim, status, check_in_em, version)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, null, 0)
        """, id, fixture.clinicId(), fixture.patientId(), fixture.doctorId(),
        fixture.specialtyId(), fixture.roomId(), Timestamp.from(startsAt),
        Timestamp.from(startsAt.plusSeconds(1800)), statusValue);
  }

  private void insertCare(UUID appointmentId, Instant startedAt, Instant finishedAt,
      String clinicalMarker) {
    jdbc.update("""
        insert into atendimento
          (id, agendamento_id, iniciado_em, finalizado_em, queixa_principal,
           resumo_anamnese, conduta, observacoes, version)
        values (?, ?, ?, ?, ?, 'resumo', 'conduta', 'observacoes', 0)
        """, UUID.randomUUID(), appointmentId, Timestamp.from(startedAt),
        finishedAt == null ? null : Timestamp.from(finishedAt), clinicalMarker);
  }

  private static RequestPostProcessor doctor(String subject) {
    return principal(subject, "DOCTOR");
  }

  private static OffsetDateTime localSlot(int hour) {
    return LocalDate.of(2026, 9, 16).atTime(hour, 0).atZone(CLINIC_ZONE).toOffsetDateTime();
  }

  private static RequestPostProcessor principal(String subject, String... roles) {
    List<GrantedAuthority> authorities = java.util.Arrays.stream(roles)
        .map(role -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + role)).toList();
    return jwt().jwt(token(subject, roles)).authorities(authorities);
  }

  private static org.springframework.security.oauth2.jwt.Jwt token(
      String subject, String... roles) {
    return org.springframework.security.oauth2.jwt.Jwt.withTokenValue("synthetic")
        .header("alg", "none").subject(subject)
        .issuer("http://issuer.test/realms/medflow").audience(List.of("medflow-api"))
        .issuedAt(Instant.parse("2026-09-16T11:00:00Z"))
        .expiresAt(Instant.parse("2026-09-16T13:00:00Z"))
        .claim("resource_access", Map.of("medflow-api", Map.of("roles", List.of(roles))))
        .build();
  }

  private record Fixture(String subject, UUID doctorId, UUID patientId,
      UUID specialtyId, UUID roomId, UUID clinicId, UUID ruleId,
      AuthenticatedActor patient, AuthenticatedActor doctor,
      AuthenticatedActor receptionist) { }
}
