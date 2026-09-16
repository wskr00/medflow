package br.com.medflow.care;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.medflow.PostgresTestConfiguration;
import br.com.medflow.care.application.CareService;
import br.com.medflow.care.domain.RegistroClinico;
import br.com.medflow.care.persistence.AtendimentoRepository;
import br.com.medflow.clinic.application.ClinicConfigurationService;
import br.com.medflow.clinic.application.PatientProvisioningService;
import br.com.medflow.common.auth.AuthenticatedActor;
import br.com.medflow.reception.application.ReceptionService;
import br.com.medflow.scheduling.FixedSchedulingClockConfiguration;
import br.com.medflow.scheduling.application.AppointmentService;
import br.com.medflow.scheduling.application.SchedulingConfigurationService;
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
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
    "spring.security.oauth2.resourceserver.jwt.issuer-uri=http://issuer.test/realms/medflow",
    "spring.security.oauth2.resourceserver.jwt.jwk-set-uri=http://localhost.invalid/jwks",
    "spring.security.oauth2.resourceserver.jwt.audiences=medflow-api"
})
@AutoConfigureMockMvc
@Import({PostgresTestConfiguration.class, FixedSchedulingClockConfiguration.class})
class CareHttpIntegrationTests {

  private static final LocalDate TODAY = LocalDate.of(2026, 9, 16);
  private static final ZoneId BELEM = ZoneId.of("America/Belem");
  private static final AtomicInteger IDS = new AtomicInteger();

  @Autowired private MockMvc mvc;
  @Autowired private ClinicConfigurationService clinic;
  @Autowired private PatientProvisioningService provisioning;
  @Autowired private SchedulingConfigurationService scheduling;
  @Autowired private AppointmentService appointments;
  @Autowired private ReceptionService reception;
  @Autowired private CareService care;
  @Autowired private AtendimentoRepository careRepository;

  @Test
  void doctorFlowPaginatesAgendaAndQueueThenPersistsFinalizedClinicalRecord() throws Exception {
    Fixture fixture = fixture("http-flow");
    var first = waiting(fixture, 10);
    var second = waiting(fixture, 11);
    var third = waiting(fixture, 12);
    var doctor = principal(fixture.doctor().subject(), "DOCTOR");

    mvc.perform(get("/api/medico/agenda?data=2026-09-16&status=EM_ESPERA&page=0&size=2")
            .with(doctor))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.page").value(0))
        .andExpect(jsonPath("$.size").value(2))
        .andExpect(jsonPath("$.totalElements").value(3))
        .andExpect(jsonPath("$.items[0].id").value(first.id().toString()))
        .andExpect(jsonPath("$.items[1].id").value(second.id().toString()))
        .andExpect(jsonPath("$.items[0].paciente.id").value(fixture.patient().pacienteId().toString()))
        .andExpect(jsonPath("$.items[0].registroClinico").doesNotExist());
    mvc.perform(get("/api/medico/agenda?data=2026-09-16&status=EM_ESPERA&page=1&size=2")
            .with(doctor))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(3))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].id").value(third.id().toString()));
    mvc.perform(get("/api/medico/fila?page=0&size=2").with(doctor))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(3))
        .andExpect(jsonPath("$.items[0].id").value(first.id().toString()))
        .andExpect(jsonPath("$.items[1].id").value(second.id().toString()))
        .andExpect(jsonPath("$.items[0].registroClinico").doesNotExist());

    mvc.perform(post("/api/agendamentos/" + first.id() + "/atendimento").with(doctor)
            .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":1}"))
        .andExpect(status().isCreated())
        .andExpect(header().exists("Location"))
        .andExpect(jsonPath("$.agendamento.status").value("EM_ATENDIMENTO"))
        .andExpect(jsonPath("$.agendamento.version").value(2))
        .andExpect(jsonPath("$.atendimento.version").value(0))
        .andExpect(jsonPath("$.atendimento.registroClinico.queixaPrincipal").value(""));
    UUID careId = careRepository.findByAgendamentoId(first.id()).orElseThrow().id();

    mvc.perform(get("/api/atendimentos/" + careId).with(doctor))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.agendamentoId").value(first.id().toString()));
    mvc.perform(put("/api/atendimentos/" + careId + "/registro-clinico").with(doctor)
            .contentType(MediaType.APPLICATION_JSON).content("""
                {"expectedVersion":0,"queixaPrincipal":"  Dor  ",
                 "resumoAnamnese":"","conduta":null,"observacoes":"  nota  "}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.version").value(1))
        .andExpect(jsonPath("$.registroClinico.queixaPrincipal").value("Dor"))
        .andExpect(jsonPath("$.registroClinico.observacoes").value("nota"));
    mvc.perform(post("/api/atendimentos/" + careId + "/finalizacao").with(doctor)
            .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":1}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("REGISTRO_INCOMPLETO"));
    mvc.perform(put("/api/atendimentos/" + careId + "/registro-clinico").with(doctor)
            .contentType(MediaType.APPLICATION_JSON).content("""
                {"expectedVersion":1,"queixaPrincipal":"Dor",
                 "resumoAnamnese":"Resumo","conduta":"Conduta","observacoes":"Nota"}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.version").value(2));
    mvc.perform(post("/api/atendimentos/" + careId + "/finalizacao").with(doctor)
            .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":2}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.agendamento.status").value("FINALIZADA"))
        .andExpect(jsonPath("$.atendimento.version").value(3))
        .andExpect(jsonPath("$.atendimento.finalizadoEm").value("2026-09-16T09:00:00-03:00"));

    mvc.perform(get("/api/medico/pacientes/" + fixture.patient().pacienteId()
            + "/historico?page=0&size=10").with(doctor))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.items[0].registroClinico.queixaPrincipal").value("Dor"));
    mvc.perform(get("/api/me/historico?page=0&size=10")
            .with(principal(fixture.patient().subject(), "PATIENT")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.items[0].id").value(first.id().toString()))
        .andExpect(jsonPath("$.items[0].registroClinico").doesNotExist())
        .andExpect(jsonPath("$.items[0].queixaPrincipal").doesNotExist());
  }

  @Test
  void routesRequireConcreteRoleAndActiveLinkIncludingMultiRoleContext() throws Exception {
    Fixture fixture = fixture("http-auth");
    var waiting = waiting(fixture, 10);
    var started = care.start(fixture.doctor(), waiting.id(), waiting.version());
    UUID careId = started.atendimento().id();

    for (String role : List.of("PATIENT", "RECEPTIONIST", "ADMINISTRATOR")) {
      RequestPostProcessor denied = principal(
          role.equals("PATIENT") ? fixture.patient().subject() : "denied-" + role, role);
      mvc.perform(get("/api/medico/agenda?data=2026-09-16").with(denied))
          .andExpect(status().isForbidden());
      mvc.perform(get("/api/medico/fila").with(denied)).andExpect(status().isForbidden());
      mvc.perform(post("/api/agendamentos/" + waiting.id() + "/atendimento").with(denied)
              .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":2}"))
          .andExpect(status().isForbidden());
      mvc.perform(get("/api/atendimentos/" + careId).with(denied))
          .andExpect(status().isForbidden());
      mvc.perform(put("/api/atendimentos/" + careId + "/registro-clinico").with(denied)
              .contentType(MediaType.APPLICATION_JSON).content("""
                  {"expectedVersion":0,"queixaPrincipal":"x","resumoAnamnese":"x",
                   "conduta":"x","observacoes":"x"}
                  """))
          .andExpect(status().isForbidden());
      mvc.perform(post("/api/atendimentos/" + careId + "/finalizacao").with(denied)
              .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":0}"))
          .andExpect(status().isForbidden());
    }
    for (String role : List.of("DOCTOR", "RECEPTIONIST", "ADMINISTRATOR")) {
      String subject = role.equals("DOCTOR") ? fixture.doctor().subject() : "history-" + role;
      mvc.perform(get("/api/me/historico").with(principal(subject, role)))
          .andExpect(status().isForbidden());
    }

    mvc.perform(get("/api/medico/agenda?data=2026-09-16")
            .with(principal("doctor-without-link", "DOCTOR")))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("ACESSO_NEGADO"));
    var inactiveSpecialty = clinic.criarEspecialidade("Especialidade inativa HTTP", true);
    var inactiveDoctor = clinic.criarMedico("Médico inativo HTTP", "99881", "PA",
        List.of(inactiveSpecialty.id()), true);
    var linkedInactive = clinic.provisionarSubjectMedico(
        inactiveDoctor.id(), "inactive-doctor-http");
    clinic.alterarMedico(linkedInactive.id(), linkedInactive.version(), linkedInactive.nome(),
        linkedInactive.crmNumero(), linkedInactive.crmUf(), List.of(inactiveSpecialty.id()), false);
    mvc.perform(get("/api/medico/agenda?data=2026-09-16")
            .with(principal("inactive-doctor-http", "DOCTOR")))
        .andExpect(status().isForbidden());

    String multiSubject = "multi-care-" + IDS.incrementAndGet();
    var multiSpecialty = clinic.criarEspecialidade("Especialidade multi HTTP", true);
    var multiDoctor = clinic.criarMedico("Médico multi HTTP", "99882", "PA",
        List.of(multiSpecialty.id()), true);
    clinic.provisionarSubjectMedico(multiDoctor.id(), multiSubject);
    provisioning.provisionar(multiSubject, "Paciente multi HTTP");
    var multi = principal(multiSubject, "DOCTOR", "PATIENT");
    mvc.perform(get("/api/medico/agenda?data=2026-09-16").with(multi))
        .andExpect(status().isOk());
    mvc.perform(get("/api/me/historico").with(multi)).andExpect(status().isOk());
  }

  @Test
  void idsOutsideDoctorContextReturnUniform404AndMedicalHistoryIsUniformlyEmpty() throws Exception {
    Fixture own = fixture("http-own");
    Fixture other = fixture("http-other");
    var otherWaiting = waiting(other, 10);
    var otherStarted = care.start(other.doctor(), otherWaiting.id(), otherWaiting.version());
    var otherDraft = care.saveDraft(other.doctor(), otherStarted.atendimento().id(), 0,
        "queixa alheia", "resumo alheio", "conduta alheia", "observação alheia");
    care.finish(other.doctor(), otherDraft.id(), otherDraft.version());
    var ownDoctor = principal(own.doctor().subject(), "DOCTOR");
    UUID missing = UUID.randomUUID();
    String version = "{\"expectedVersion\":0}";
    String draft = """
        {"expectedVersion":0,"queixaPrincipal":"segredo",
         "resumoAnamnese":"segredo","conduta":"segredo","observacoes":"segredo"}
        """;

    for (UUID id : List.of(otherWaiting.id(), missing)) {
      mvc.perform(post("/api/agendamentos/" + id + "/atendimento").with(ownDoctor)
              .contentType(MediaType.APPLICATION_JSON).content(version))
          .andExpect(status().isNotFound())
          .andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"));
    }
    for (UUID id : List.of(otherStarted.atendimento().id(), missing)) {
      mvc.perform(get("/api/atendimentos/" + id).with(ownDoctor))
          .andExpect(status().isNotFound())
          .andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"));
      mvc.perform(put("/api/atendimentos/" + id + "/registro-clinico").with(ownDoctor)
              .contentType(MediaType.APPLICATION_JSON).content(draft))
          .andExpect(status().isNotFound());
      mvc.perform(post("/api/atendimentos/" + id + "/finalizacao").with(ownDoctor)
              .contentType(MediaType.APPLICATION_JSON).content(version))
          .andExpect(status().isNotFound());
    }

    for (UUID patientId : List.of(other.patient().pacienteId(), UUID.randomUUID())) {
      mvc.perform(get("/api/medico/pacientes/" + patientId + "/historico").with(ownDoctor))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.items").isEmpty())
          .andExpect(jsonPath("$.totalElements").value(0));
    }
  }

  @Test
  void validationAndBusinessErrorsNeverEchoClinicalPayload() throws Exception {
    Fixture fixture = fixture("http-sensitive-errors");
    var waiting = waiting(fixture, 10);
    var started = care.start(fixture.doctor(), waiting.id(), waiting.version());
    var doctor = principal(fixture.doctor().subject(), "DOCTOR");
    String marker = "SEGREDO-CLINICO-NAO-ECOAR";
    String oversized = marker + "x".repeat(RegistroClinico.QUEIXA_MAX);
    String body = "{\"expectedVersion\":0,\"queixaPrincipal\":\"" + oversized
        + "\",\"resumoAnamnese\":\"\",\"conduta\":\"\",\"observacoes\":\"\"}";

    mvc.perform(put("/api/atendimentos/" + started.atendimento().id() + "/registro-clinico")
            .with(doctor).contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("ENTRADA_INVALIDA"))
        .andExpect(jsonPath("$.fieldErrors[0].message").value("Valor inválido."))
        .andExpect(content().string(not(containsString(marker))));
    mvc.perform(post("/api/atendimentos/" + started.atendimento().id() + "/finalizacao")
            .with(doctor).contentType(MediaType.APPLICATION_JSON)
            .content("{\"expectedVersion\":0}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("REGISTRO_INCOMPLETO"))
        .andExpect(content().string(not(containsString(marker))));
  }

  private Fixture fixture(String name) {
    String suffix = name + "-" + IDS.incrementAndGet();
    var specialty = clinic.criarEspecialidade("Especialidade " + suffix, true);
    var unit = clinic.criarUnidade("Unidade " + suffix, "Endereço " + suffix, true);
    var room = clinic.criarConsultorio(unit.id(), "Sala " + suffix, true);
    var doctorEntity = clinic.criarMedico("Médico " + suffix,
        Integer.toString(950000 + IDS.get()), "PA", List.of(specialty.id()), true);
    String doctorSubject = "doctor-" + suffix;
    clinic.provisionarSubjectMedico(doctorEntity.id(), doctorSubject);
    var rule = scheduling.criarRegra(new SchedulingConfigurationService.RegraCommand(
        doctorEntity.id(), specialty.id(), room.id(), DayOfWeek.WEDNESDAY,
        LocalTime.of(10, 0), LocalTime.of(13, 0), 30, TODAY, TODAY, true, 0));
    String patientSubject = "patient-" + suffix;
    var patientEntity = provisioning.provisionar(patientSubject, "Paciente " + suffix);
    var singleton = clinic.clinica();
    var patient = new AuthenticatedActor(patientSubject, Set.of("PATIENT"), patientEntity.id(),
        null, singleton.id(), singleton.timeZone());
    var doctor = new AuthenticatedActor(doctorSubject, Set.of("DOCTOR"), null, doctorEntity.id(),
        singleton.id(), singleton.timeZone());
    var receptionist = new AuthenticatedActor("reception-" + suffix, Set.of("RECEPTIONIST"),
        null, null, singleton.id(), singleton.timeZone());
    return new Fixture(rule.id(), patient, doctor, receptionist);
  }

  private AppointmentService.AppointmentView waiting(Fixture fixture, int hour) {
    var scheduled = appointments.criar(fixture.patient(), fixture.ruleId(), offset(hour));
    reception.checkIn(fixture.receptionist(), scheduled.id(), scheduled.version());
    return appointments.obter(fixture.patient(), scheduled.id());
  }

  private static RequestPostProcessor principal(String subject, String... roles) {
    List<GrantedAuthority> authorities = java.util.Arrays.stream(roles)
        .map(role -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + role)).toList();
    return jwt().jwt(token(subject, roles)).authorities(authorities);
  }

  private static Jwt token(String subject, String... roles) {
    return Jwt.withTokenValue("synthetic").header("alg", "none").subject(subject)
        .issuer("http://issuer.test/realms/medflow").audience(List.of("medflow-api"))
        .issuedAt(Instant.parse("2026-09-16T11:00:00Z"))
        .expiresAt(Instant.parse("2026-09-16T13:00:00Z"))
        .claim("resource_access", Map.of("medflow-api", Map.of("roles", List.of(roles))))
        .build();
  }

  private static OffsetDateTime offset(int hour) {
    return TODAY.atTime(hour, 0).atZone(BELEM).toOffsetDateTime();
  }

  private record Fixture(UUID ruleId, AuthenticatedActor patient,
      AuthenticatedActor doctor, AuthenticatedActor receptionist) { }
}
