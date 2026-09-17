package br.com.medflow.reception;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.medflow.PostgresTestConfiguration;
import br.com.medflow.clinic.application.ClinicConfigurationService;
import br.com.medflow.clinic.application.PatientProvisioningService;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
    "spring.security.oauth2.resourceserver.jwt.issuer-uri=http://issuer.test/realms/medflow",
    "spring.security.oauth2.resourceserver.jwt.jwk-set-uri=http://localhost.invalid/jwks",
    "spring.security.oauth2.resourceserver.jwt.audiences=medflow-api"
})
@AutoConfigureMockMvc
@Import({PostgresTestConfiguration.class, FixedSchedulingClockConfiguration.class})
class ReceptionHttpIntegrationTests {

  private static final LocalDate TODAY = LocalDate.of(2026, 9, 16);
  private static final ZoneId BELEM = ZoneId.of("America/Belem");
  private static final AtomicInteger IDS = new AtomicInteger();

  @Autowired private MockMvc mvc;
  @Autowired private ClinicConfigurationService clinic;
  @Autowired private PatientProvisioningService provisioning;
  @Autowired private SchedulingConfigurationService configuration;
  @Autowired private AppointmentService appointments;
  @Autowired private JdbcTemplate jdbc;

  @Test
  void receptionistReadsPagedAgendaChecksInAndReadsDerivedQueue() throws Exception {
    Fixture fixture = fixture("http-flow");
    var first = appointments.criar(fixture.patient(), fixture.ruleId(), offset(TODAY, 10, 0));
    var second = appointments.criar(patient("http-flow-second"), fixture.ruleId(), offset(TODAY, 11, 0));
    UUID previous = insertEarlierPending(fixture, TODAY.minusDays(1));
    var reception = principal("reception-http-flow", "RECEPTIONIST");

    mvc.perform(get("/api/recepcao/agenda?data=2026-09-16&unidadeId=" + fixture.unitId()
            + "&medicoId=" + fixture.doctorId() + "&status=AGENDADA&page=0&size=1")
            .with(reception))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.page").value(0))
        .andExpect(jsonPath("$.size").value(1))
        .andExpect(jsonPath("$.totalElements").value(2))
        .andExpect(jsonPath("$.items[0].id").value(first.id().toString()))
        .andExpect(jsonPath("$.items[0].paciente.id").value(fixture.patientId().toString()))
        .andExpect(jsonPath("$.items[0].allowedActions.canCheckIn").value(true))
        .andExpect(jsonPath("$.items[0].allowedActions.canReschedule").value(true))
        .andExpect(jsonPath("$.items[0].allowedActions.canCancel").value(true))
        .andExpect(jsonPath("$.items[0].medico.crmNumero").doesNotExist())
        .andExpect(jsonPath("$.items[0].registroClinico").doesNotExist());

    mvc.perform(post("/api/agendamentos/" + first.id() + "/check-in").with(reception)
            .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":0}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("EM_ESPERA"))
        .andExpect(jsonPath("$.version").value(1))
        .andExpect(jsonPath("$.checkInEm").value("2026-09-16T09:00:00-03:00"))
        .andExpect(jsonPath("$.allowedActions.canCheckIn").value(false))
        .andExpect(jsonPath("$.allowedActions.canReschedule").value(false))
        .andExpect(jsonPath("$.allowedActions.canCancel").value(false))
        .andExpect(jsonPath("$.pendenteDeDiaAnterior").value(false));
    mvc.perform(post("/api/agendamentos/" + first.id() + "/check-in").with(reception)
            .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":1}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("CHECKIN_JA_REALIZADO"));

    mvc.perform(get("/api/recepcao/fila?unidadeId=" + fixture.unitId() + "&page=0&size=20")
            .with(reception))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(2))
        .andExpect(jsonPath("$.items[0].id").value(previous.toString()))
        .andExpect(jsonPath("$.items[0].pendenteDeDiaAnterior").value(true))
        .andExpect(jsonPath("$.items[0].allowedActions.canCheckIn").value(false))
        .andExpect(jsonPath("$.items[1].id").value(first.id().toString()))
        .andExpect(jsonPath("$.items[1].pendenteDeDiaAnterior").value(false));
  }

  @Test
  void queuePaginationKeepsGlobalOrderAcrossPages() throws Exception {
    Fixture fixture = fixture("http-queue-pages");
    UUID first = insertPending(fixture, TODAY, 8, 0);
    UUID second = insertPending(fixture, TODAY, 9, 0);
    UUID third = insertPending(fixture, TODAY, 10, 0);
    var reception = principal("reception-http-queue-pages", "RECEPTIONIST");
    String path = "/api/recepcao/fila?unidadeId=" + fixture.unitId();

    mvc.perform(get(path + "&page=0&size=2").with(reception))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.page").value(0))
        .andExpect(jsonPath("$.size").value(2))
        .andExpect(jsonPath("$.totalElements").value(3))
        .andExpect(jsonPath("$.items.length()").value(2))
        .andExpect(jsonPath("$.items[0].id").value(first.toString()))
        .andExpect(jsonPath("$.items[1].id").value(second.toString()));
    mvc.perform(get(path + "&page=1&size=2").with(reception))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.page").value(1))
        .andExpect(jsonPath("$.size").value(2))
        .andExpect(jsonPath("$.totalElements").value(3))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].id").value(third.toString()));
  }

  @Test
  void receptionEndpointsAllowReceptionistDenyOtherRolesAndReturnUniform404ForUnknownResources()
      throws Exception {
    Fixture fixture = fixture("http-auth");
    var scheduled = appointments.criar(fixture.patient(), fixture.ruleId(), offset(TODAY, 10, 0));
    String body = "{\"expectedVersion\":0}";

    mvc.perform(get("/api/recepcao/agenda?data=2026-09-16")
            .with(principal("allowed-reception", "RECEPTIONIST")))
        .andExpect(status().isOk());

    for (String role : List.of("PATIENT", "DOCTOR", "ADMINISTRATOR")) {
      var denied = principal("denied-" + role, role);
      mvc.perform(get("/api/recepcao/agenda?data=2026-09-16").with(denied))
          .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACESSO_NEGADO"));
      mvc.perform(get("/api/recepcao/fila").with(denied))
          .andExpect(status().isForbidden());
      mvc.perform(post("/api/agendamentos/" + scheduled.id() + "/check-in").with(denied)
              .contentType(MediaType.APPLICATION_JSON).content(body))
          .andExpect(status().isForbidden());
    }

    var reception = principal("unlinked-reception", "RECEPTIONIST");
    mvc.perform(get("/api/recepcao/agenda?data=2026-09-16&unidadeId=" + UUID.randomUUID())
            .with(reception))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"));
    mvc.perform(get("/api/recepcao/fila?medicoId=" + UUID.randomUUID()).with(reception))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"));
    mvc.perform(post("/api/agendamentos/" + UUID.randomUUID() + "/check-in").with(reception)
            .contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"));
  }

  private Fixture fixture(String name) {
    String suffix = name + "-" + IDS.incrementAndGet();
    var specialty = clinic.criarEspecialidade("Especialidade " + suffix, true);
    var unit = clinic.criarUnidade("Unidade " + suffix, "Endereço " + suffix, true);
    var room = clinic.criarConsultorio(unit.id(), "Sala " + suffix, true);
    var doctor = clinic.criarMedico("Médico " + suffix,
        Integer.toString(700000 + IDS.get()), "PA", List.of(specialty.id()), true);
    var rule = configuration.criarRegra(new SchedulingConfigurationService.RegraCommand(
        doctor.id(), specialty.id(), room.id(), DayOfWeek.WEDNESDAY,
        LocalTime.of(10, 0), LocalTime.of(13, 0), 30, TODAY, TODAY, true, 0));
    var patient = patient("patient-" + suffix);
    return new Fixture(rule.id(), doctor.id(), specialty.id(), unit.id(), room.id(),
        patient.pacienteId(), patient);
  }

  private br.com.medflow.common.auth.AuthenticatedActor patient(String subject) {
    var patient = provisioning.provisionar(subject, "Paciente " + subject);
    var singleton = clinic.clinica();
    return new br.com.medflow.common.auth.AuthenticatedActor(subject, Set.of("PATIENT"),
        patient.id(), null, singleton.id(), singleton.timeZone());
  }

  private UUID insertEarlierPending(Fixture fixture, LocalDate date) {
    UUID id = UUID.randomUUID();
    Instant start = offset(date, 10, 0).toInstant();
    insertPending(fixture, id, start);
    return id;
  }

  private UUID insertPending(Fixture fixture, LocalDate date, int hour, int minute) {
    UUID id = UUID.randomUUID();
    insertPending(fixture, id, offset(date, hour, minute).toInstant());
    return id;
  }

  private void insertPending(Fixture fixture, UUID id, Instant start) {
    jdbc.update("""
        insert into agendamento
          (id, clinica_id, paciente_id, medico_id, especialidade_id, consultorio_id,
           inicio, fim, status, check_in_em, version)
        values (?, ?, ?, ?, ?, ?, ?, ?, 'EM_ESPERA', ?, 0)
        """, id, clinic.clinica().id(), fixture.patientId(), fixture.doctorId(),
        fixture.specialtyId(), fixture.roomId(), Timestamp.from(start),
        Timestamp.from(start.plusSeconds(1800)), Timestamp.from(start.minusSeconds(600)));
  }

  private static org.springframework.test.web.servlet.request.RequestPostProcessor principal(
      String subject, String role) {
    return jwt().jwt(token(subject, role)).authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }

  private static Jwt token(String subject, String role) {
    return Jwt.withTokenValue("synthetic").header("alg", "none").subject(subject)
        .issuer("http://issuer.test/realms/medflow").audience(List.of("medflow-api"))
        .issuedAt(Instant.parse("2026-09-16T11:00:00Z"))
        .expiresAt(Instant.parse("2026-09-16T13:00:00Z"))
        .claim("resource_access", Map.of("medflow-api", Map.of("roles", List.of(role))))
        .build();
  }

  private static OffsetDateTime offset(LocalDate date, int hour, int minute) {
    return date.atTime(hour, minute).atZone(BELEM).toOffsetDateTime();
  }

  private record Fixture(UUID ruleId, UUID doctorId, UUID specialtyId, UUID unitId,
      UUID roomId, UUID patientId, br.com.medflow.common.auth.AuthenticatedActor patient) { }
}
