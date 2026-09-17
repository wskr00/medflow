package br.com.medflow.scheduling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.medflow.PostgresTestConfiguration;
import br.com.medflow.clinic.application.ClinicConfigurationService;
import br.com.medflow.clinic.application.PatientProvisioningService;
import br.com.medflow.common.http.RequestIdFilter;
import br.com.medflow.scheduling.application.SchedulingConfigurationService;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
    "spring.security.oauth2.resourceserver.jwt.issuer-uri=http://issuer.test/realms/medflow",
    "spring.security.oauth2.resourceserver.jwt.jwk-set-uri=http://localhost.invalid/jwks",
    "spring.security.oauth2.resourceserver.jwt.audiences=medflow-api"
})
@AutoConfigureMockMvc
@Import({PostgresTestConfiguration.class, FixedSchedulingClockConfiguration.class})
class AppointmentHttpIntegrationTests {

  private static final LocalDate MONDAY = LocalDate.of(2026, 9, 21);
  private static final AtomicInteger IDS = new AtomicInteger();

  @Autowired private MockMvc mvc;
  @Autowired private ObjectMapper json;
  @Autowired private ClinicConfigurationService clinic;
  @Autowired private PatientProvisioningService provisioning;
  @Autowired private SchedulingConfigurationService configuration;

  @Test
  void appliesFunctionalMatrixAndRequiresPatientLinkBeforeAvailabilityOrCreation() throws Exception {
    Fixture fixture = fixture("http-matrix");
    String availability = availabilityUrl(fixture);

    mvc.perform(get(availability).with(principal("missing-link", "PATIENT")))
        .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACESSO_NEGADO"));
    mvc.perform(post("/api/agendamentos").with(principal("missing-link", "PATIENT"))
            .contentType(MediaType.APPLICATION_JSON).content(createBody(fixture, "08:00")))
        .andExpect(status().isForbidden());
    mvc.perform(get(availability).with(principal("doctor", "DOCTOR")))
        .andExpect(status().isForbidden());
    mvc.perform(get(availability).with(principal("reception", "RECEPTIONIST")))
        .andExpect(status().isForbidden());
    mvc.perform(get(availability).with(principal(fixture.subject(), "PATIENT")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(4));

    mvc.perform(get(availability).with(principal("administrator", "ADMINISTRATOR")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.timeZone").value("America/Belem"))
        .andExpect(jsonPath("$.items[0].inicio").value("2026-09-21T08:00:00-03:00"));
    mvc.perform(post("/api/agendamentos").with(principal("administrator", "ADMINISTRATOR"))
            .contentType(MediaType.APPLICATION_JSON).content(createBody(fixture, "08:00")))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/me/agendamentos").with(principal("administrator", "ADMINISTRATOR")))
        .andExpect(status().isForbidden());
  }

  @Test
  void listsOnlyDatesThatStillHaveAvailableSlotsWithinTheRequestedRange() throws Exception {
    Fixture fixture = fixture("http-available-dates");
    String url = "/api/disponibilidades/datas?dataDe=2026-09-20&dataAte=2026-09-27"
        + "&unidadeId=" + fixture.unitId() + "&especialidadeId=" + fixture.specialtyId();

    mvc.perform(get(url).with(principal(fixture.subject(), "PATIENT")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.timeZone").value("America/Belem"))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0]").value("2026-09-21"));

    mvc.perform(get(url.replace("2026-09-27", "2026-12-01"))
            .with(principal(fixture.subject(), "PATIENT")))
        .andExpect(status().isBadRequest());
  }

  @Test
  void derivesOwnerAndReturnsPatientOrReceptionProjectionWithoutClinicalOrAdministrativeFields()
      throws Exception {
    Fixture fixture = fixture("http-projection");
    var other = provisioning.provisionar("http-other-patient", "Paciente alheio");
    String payload = createBody(fixture, "08:00").replace("}",
        ",\"pacienteId\":\"" + other.id() + "\"}");
    var created = mvc.perform(post("/api/agendamentos").with(principal(fixture.subject(), "PATIENT"))
            .contentType(MediaType.APPLICATION_JSON).content(payload))
        .andExpect(status().isCreated())
        .andExpect(header().exists("Location"))
        .andExpect(jsonPath("$.status").value("AGENDADA"))
        .andExpect(jsonPath("$.inicio").value("2026-09-21T08:00:00-03:00"))
        .andExpect(jsonPath("$.fim").value("2026-09-21T08:30:00-03:00"))
        .andExpect(jsonPath("$.paciente").doesNotExist())
        .andExpect(jsonPath("$.checkInEm").value(org.hamcrest.Matchers.nullValue()))
        .andReturn();
    String location = created.getResponse().getHeader("Location");

    mvc.perform(get(location).with(principal(fixture.subject(), "PATIENT")))
        .andExpect(status().isOk()).andExpect(jsonPath("$.paciente").doesNotExist());
    mvc.perform(get(location).with(principal("http-reception", "RECEPTIONIST")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.paciente.id").value(fixture.patientId().toString()))
        .andExpect(jsonPath("$.paciente.nome").value("Paciente " + fixture.suffix()))
        .andExpect(jsonPath("$.allowedActions.canCheckIn").value(false))
        .andExpect(jsonPath("$.allowedActions.canReschedule").value(true))
        .andExpect(jsonPath("$.allowedActions.canCancel").value(true))
        .andExpect(jsonPath("$.pendenteDeDiaAnterior").value(false))
        .andExpect(jsonPath("$.medico.crmNumero").doesNotExist())
        .andExpect(jsonPath("$.registroClinico").doesNotExist());

    mvc.perform(get(location + "/disponibilidades?data=2026-09-21")
            .with(principal("http-reception", "RECEPTIONIST")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].inicio").value("2026-09-21T08:00:00-03:00"));
  }

  @Test
  void returnsUniform404ForForeignAndUnknownAppointmentAndPagesOnlyOwnResults() throws Exception {
    Fixture owner = fixture("http-owner");
    Fixture foreign = fixture("http-foreign");
    var created = mvc.perform(post("/api/agendamentos").with(principal(owner.subject(), "PATIENT"))
            .contentType(MediaType.APPLICATION_JSON).content(createBody(owner, "08:00")))
        .andExpect(status().isCreated()).andReturn();
    String location = created.getResponse().getHeader("Location");

    String foreignBody = mvc.perform(get(location).with(principal(foreign.subject(), "PATIENT")))
        .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"))
        .andExpect(header().exists(RequestIdFilter.HEADER)).andReturn().getResponse().getContentAsString();
    String unknownBody = mvc.perform(get("/api/agendamentos/" + UUID.randomUUID())
            .with(principal(foreign.subject(), "PATIENT")))
        .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"))
        .andReturn().getResponse().getContentAsString();
    JsonNode foreignError = json.readTree(foreignBody);
    JsonNode unknownError = json.readTree(unknownBody);
    assertThat(foreignError.get("status")).isEqualTo(unknownError.get("status"));
    assertThat(foreignError.get("code")).isEqualTo(unknownError.get("code"));
    assertThat(foreignError.get("message")).isEqualTo(unknownError.get("message"));

    String versionBody = "{\"expectedVersion\":0}";
    mvc.perform(post(location + "/cancelamento").with(principal(foreign.subject(), "PATIENT"))
            .contentType(MediaType.APPLICATION_JSON).content(versionBody))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"));
    mvc.perform(post("/api/agendamentos/" + UUID.randomUUID() + "/cancelamento")
            .with(principal(foreign.subject(), "PATIENT"))
            .contentType(MediaType.APPLICATION_JSON).content(versionBody))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"));

    mvc.perform(get(location + "/disponibilidades?data=2026-09-21")
            .with(principal(foreign.subject(), "PATIENT")))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"));
    mvc.perform(get("/api/agendamentos/" + UUID.randomUUID()
            + "/disponibilidades?data=2026-09-21")
            .with(principal(foreign.subject(), "PATIENT")))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"));

    String rescheduleBody = "{\"regraAgendaId\":\"" + owner.ruleId()
        + "\",\"inicio\":\"2026-09-21T08:30:00-03:00\",\"expectedVersion\":0}";
    mvc.perform(post(location + "/reagendamento").with(principal(foreign.subject(), "PATIENT"))
            .contentType(MediaType.APPLICATION_JSON).content(rescheduleBody))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"));
    mvc.perform(post("/api/agendamentos/" + UUID.randomUUID() + "/reagendamento")
            .with(principal(foreign.subject(), "PATIENT"))
            .contentType(MediaType.APPLICATION_JSON).content(rescheduleBody))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"));

    mvc.perform(get("/api/me/agendamentos?page=0&size=1&status=AGENDADA&dataDe=2026-09-21&dataAte=2026-09-21")
            .with(principal(owner.subject(), "PATIENT")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.page").value(0))
        .andExpect(jsonPath("$.size").value(1))
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.items[0].id").exists())
        .andExpect(jsonPath("$.items[0].paciente").doesNotExist());
  }

  @Test
  void patientAndReceptionistRescheduleAndCancelWhileAdminAndDoctorRemainDenied()
      throws Exception {
    Fixture fixture = fixture("http-mutations");
    var room = clinic.criarConsultorio(fixture.unitId(), "Sala alternativa HTTP", true);
    var alternateRule = configuration.criarRegra(new SchedulingConfigurationService.RegraCommand(
        fixture.doctorId(), fixture.specialtyId(), room.id(), DayOfWeek.MONDAY,
        LocalTime.of(10, 0), LocalTime.of(11, 0), 30, MONDAY, MONDAY, true, 0));

    var created = mvc.perform(post("/api/agendamentos").with(principal(fixture.subject(), "PATIENT"))
            .contentType(MediaType.APPLICATION_JSON).content(createBody(fixture, "08:00")))
        .andExpect(status().isCreated()).andReturn();
    String location = created.getResponse().getHeader("Location");
    String receptionistReschedule = "{\"regraAgendaId\":\"" + alternateRule.id()
        + "\",\"inicio\":\"2026-09-21T10:00:00-03:00\",\"expectedVersion\":0}";

    mvc.perform(post(location + "/reagendamento")
            .with(principal("mutations-reception", "RECEPTIONIST"))
            .contentType(MediaType.APPLICATION_JSON).content(receptionistReschedule))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.version").value(1))
        .andExpect(jsonPath("$.consultorio.id").value(room.id().toString()))
        .andExpect(jsonPath("$.allowedActions.canCheckIn").value(false))
        .andExpect(jsonPath("$.allowedActions.canReschedule").value(true))
        .andExpect(jsonPath("$.allowedActions.canCancel").value(true))
        .andExpect(jsonPath("$.paciente.id").value(fixture.patientId().toString()));
    mvc.perform(post(location + "/cancelamento")
            .with(principal("mutations-reception", "RECEPTIONIST"))
            .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":1}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.version").value(2))
        .andExpect(jsonPath("$.status").value("CANCELADA"))
        .andExpect(jsonPath("$.allowedActions.canCheckIn").value(false))
        .andExpect(jsonPath("$.allowedActions.canReschedule").value(false))
        .andExpect(jsonPath("$.allowedActions.canCancel").value(false))
        .andExpect(jsonPath("$.paciente.id").value(fixture.patientId().toString()));

    var patientCreated = mvc.perform(post("/api/agendamentos")
            .with(principal(fixture.subject(), "PATIENT"))
            .contentType(MediaType.APPLICATION_JSON).content(createBody(fixture, "08:30")))
        .andExpect(status().isCreated()).andReturn();
    String patientLocation = patientCreated.getResponse().getHeader("Location");
    String patientReschedule = "{\"regraAgendaId\":\"" + fixture.ruleId()
        + "\",\"inicio\":\"2026-09-21T09:00:00-03:00\",\"expectedVersion\":0}";
    mvc.perform(post(patientLocation + "/reagendamento")
            .with(principal(fixture.subject(), "PATIENT"))
            .contentType(MediaType.APPLICATION_JSON).content(patientReschedule))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.version").value(1))
        .andExpect(jsonPath("$.paciente").doesNotExist());
    mvc.perform(post(patientLocation + "/cancelamento")
            .with(principal(fixture.subject(), "PATIENT"))
            .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":1}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("CANCELADA"));

    for (String role : List.of("ADMINISTRATOR", "DOCTOR")) {
      var principal = principal("denied-" + role, role);
      mvc.perform(post(patientLocation + "/reagendamento").with(principal)
              .contentType(MediaType.APPLICATION_JSON).content(patientReschedule))
          .andExpect(status().isForbidden());
      mvc.perform(post(patientLocation + "/cancelamento").with(principal)
              .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":1}"))
          .andExpect(status().isForbidden());
      mvc.perform(get(patientLocation + "/disponibilidades?data=2026-09-21").with(principal))
          .andExpect(status().isForbidden());
    }
  }

  @Test
  void exposesOnlyWhitelistedRsqlFiltersWithServerOwnedSectionsAndAllowedActions() throws Exception {
    Fixture fixture = fixture("http-rsql");
    var first = mvc.perform(post("/api/agendamentos").with(principal(fixture.subject(), "PATIENT"))
            .contentType(MediaType.APPLICATION_JSON).content(createBody(fixture, "08:00")))
        .andExpect(status().isCreated()).andReturn();
    mvc.perform(post("/api/agendamentos").with(principal(fixture.subject(), "PATIENT"))
            .contentType(MediaType.APPLICATION_JSON).content(createBody(fixture, "08:30")))
        .andExpect(status().isCreated());

    mvc.perform(get("/api/me/agendamentos")
            .param("recorte", "UPCOMING")
            .param("q", "status==AGENDADA;medicoId==" + fixture.doctorId())
            .with(principal(fixture.subject(), "PATIENT")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(2))
        .andExpect(jsonPath("$.items[0].inicio").value("2026-09-21T08:00:00-03:00"))
        .andExpect(jsonPath("$.items[1].inicio").value("2026-09-21T08:30:00-03:00"))
        .andExpect(jsonPath("$.items[0].allowedActions.canReschedule").value(true))
        .andExpect(jsonPath("$.items[0].allowedActions.canCancel").value(true));

    mvc.perform(get("/api/me/agendamentos")
            .param("q", "paciente.subject==" + fixture.subject())
            .with(principal(fixture.subject(), "PATIENT")))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("ENTRADA_INVALIDA"));

    String location = first.getResponse().getHeader("Location");
    mvc.perform(post(location + "/cancelamento").with(principal(fixture.subject(), "PATIENT"))
            .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":0}"))
        .andExpect(status().isOk());
    mvc.perform(get("/api/me/agendamentos").param("recorte", "CANCELLED")
            .with(principal(fixture.subject(), "PATIENT")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.items[0].allowedActions.canReschedule").value(false))
        .andExpect(jsonPath("$.items[0].allowedActions.canCancel").value(false));
    mvc.perform(get(location + "/disponibilidades?data=2026-09-21")
            .with(principal(fixture.subject(), "PATIENT")))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("TRANSICAO_INVALIDA"));
  }

  private Fixture fixture(String name) {
    String suffix = name + "-" + IDS.incrementAndGet();
    var specialty = clinic.criarEspecialidade("Especialidade " + suffix, true);
    var unit = clinic.criarUnidade("Unidade " + suffix, "Endereço " + suffix, true);
    var room = clinic.criarConsultorio(unit.id(), "Sala " + suffix, true);
    var doctor = clinic.criarMedico("Médico " + suffix, Integer.toString(900000 + IDS.get()),
        "PA", List.of(specialty.id()), true);
    var rule = configuration.criarRegra(new SchedulingConfigurationService.RegraCommand(
        doctor.id(), specialty.id(), room.id(), DayOfWeek.MONDAY, LocalTime.of(8, 0),
        LocalTime.of(10, 0), 30, MONDAY, MONDAY, true, 0));
    String subject = "subject-" + suffix;
    var patient = provisioning.provisionar(subject, "Paciente " + suffix);
    return new Fixture(suffix, subject, patient.id(), rule.id(), unit.id(), specialty.id(), doctor.id());
  }

  private static String availabilityUrl(Fixture fixture) {
    return "/api/disponibilidades?data=2026-09-21&unidadeId=" + fixture.unitId()
        + "&especialidadeId=" + fixture.specialtyId() + "&medicoId=" + fixture.doctorId();
  }

  private static String createBody(Fixture fixture, String time) {
    return "{\"regraAgendaId\":\"" + fixture.ruleId()
        + "\",\"inicio\":\"2026-09-21T" + time + ":00-03:00\"}";
  }

  private static org.springframework.test.web.servlet.request.RequestPostProcessor principal(
      String subject, String role) {
    return jwt().jwt(token(subject, role)).authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }

  private static Jwt token(String subject, String role) {
    return Jwt.withTokenValue("synthetic")
        .header("alg", "none").subject(subject)
        .issuer("http://issuer.test/realms/medflow").audience(List.of("medflow-api"))
        .issuedAt(Instant.parse("2026-09-16T11:00:00Z"))
        .expiresAt(Instant.parse("2026-09-16T13:00:00Z"))
        .claim("resource_access", Map.of("medflow-api", Map.of("roles", List.of(role))))
        .build();
  }

  private record Fixture(String suffix, String subject, UUID patientId, UUID ruleId,
      UUID unitId, UUID specialtyId, UUID doctorId) { }
}
