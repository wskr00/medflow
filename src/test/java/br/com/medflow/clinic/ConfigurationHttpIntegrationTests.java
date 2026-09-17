package br.com.medflow.clinic;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.medflow.PostgresTestConfiguration;
import br.com.medflow.clinic.application.ClinicConfigurationService;
import br.com.medflow.scheduling.FixedSchedulingClockConfiguration;
import br.com.medflow.scheduling.application.SchedulingConfigurationService;
import java.time.DayOfWeek;
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

@SpringBootTest(properties = {
    "spring.security.oauth2.resourceserver.jwt.issuer-uri=http://issuer.test/realms/medflow",
    "spring.security.oauth2.resourceserver.jwt.jwk-set-uri=http://localhost.invalid/jwks",
    "spring.security.oauth2.resourceserver.jwt.audiences=medflow-api"
})
@AutoConfigureMockMvc
@Import({PostgresTestConfiguration.class, FixedSchedulingClockConfiguration.class})
class ConfigurationHttpIntegrationTests {

  private static final LocalDate TODAY = LocalDate.of(2026, 9, 16);
  private static final AtomicInteger IDS = new AtomicInteger();

  @Autowired private MockMvc mvc;
  @Autowired private ClinicConfigurationService clinic;
  @Autowired private SchedulingConfigurationService scheduling;

  @Test
  void administratorReadsDetailsFiltersRelationsAndUsesClinicLocalBlockDateTimes() throws Exception {
    Fixture fixture = fixture("admin-contract");
    var admin = principal("admin-contract", "ADMINISTRATOR");

    mvc.perform(get("/api/unidades/" + fixture.unitId()).with(admin))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(fixture.unitId().toString()))
        .andExpect(jsonPath("$.endereco").value("Endereço " + fixture.suffix()));
    mvc.perform(get("/api/consultorios/" + fixture.roomId()).with(admin))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.unidadeId").value(fixture.unitId().toString()));
    mvc.perform(get("/api/especialidades/" + fixture.specialtyId()).with(admin))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(fixture.specialtyId().toString()));
    mvc.perform(get("/api/medicos/" + fixture.doctorId()).with(admin))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.especialidadeIds[0]").value(fixture.specialtyId().toString()));

    mvc.perform(get("/api/consultorios?incluirInativas=true&page=0&size=100").with(admin))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[?(@.id == '%s')].unidade.id".formatted(fixture.roomId()))
            .value(fixture.unitId().toString()))
        .andExpect(jsonPath("$.items[?(@.id == '%s')].unidade.nome".formatted(fixture.roomId()))
            .value("Unidade " + fixture.suffix()));
    mvc.perform(get("/api/regras-agenda?medicoId=" + fixture.doctorId()
            + "&especialidadeId=" + fixture.specialtyId() + "&consultorioId=" + fixture.roomId())
            .with(admin))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.items[0].medico.id").value(fixture.doctorId().toString()))
        .andExpect(jsonPath("$.items[0].especialidade.id").value(fixture.specialtyId().toString()))
        .andExpect(jsonPath("$.items[0].unidade.id").value(fixture.unitId().toString()))
        .andExpect(jsonPath("$.items[0].consultorio.id").value(fixture.roomId().toString()));
    mvc.perform(get("/api/regras-agenda/" + fixture.ruleId()).with(admin))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(fixture.ruleId().toString()))
        .andExpect(jsonPath("$.medico.nome").value("Médico " + fixture.suffix()));

    var created = mvc.perform(post("/api/bloqueios-agenda").with(admin)
            .contentType(MediaType.APPLICATION_JSON).content("""
                {"medicoId":"%s","inicio":"2026-09-16T15:00:00",
                 "fim":"2026-09-16T16:00:00","ativo":true}
                """.formatted(fixture.doctorId())))
        .andExpect(status().isCreated())
        .andExpect(header().exists("Location"))
        .andExpect(jsonPath("$.medico.id").value(fixture.doctorId().toString()))
        .andExpect(jsonPath("$.inicio").value("2026-09-16T15:00:00-03:00"))
        .andExpect(jsonPath("$.fim").value("2026-09-16T16:00:00-03:00"))
        .andReturn();
    UUID blockId = idFromLocation(created.getResponse().getHeader("Location"));
    mvc.perform(get("/api/bloqueios-agenda?medicoId=" + fixture.doctorId()).with(admin))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.items[0].id").value(blockId.toString()));
    mvc.perform(get("/api/bloqueios-agenda/" + blockId).with(admin))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.medico.nome").value("Médico " + fixture.suffix()));
  }

  @Test
  void administrativeDetailsAndRelationFiltersDoNotLeakOutsideTheAdministratorContext()
      throws Exception {
    Fixture fixture = fixture("admin-security");
    var patient = principal("patient-admin-security", "PATIENT");
    for (String path : List.of("/api/unidades/" + fixture.unitId(),
        "/api/consultorios/" + fixture.roomId(), "/api/especialidades/" + fixture.specialtyId(),
        "/api/medicos/" + fixture.doctorId(), "/api/regras-agenda/" + fixture.ruleId(),
        "/api/bloqueios-agenda")) {
      mvc.perform(get(path).with(patient)).andExpect(status().isForbidden());
    }
    mvc.perform(get("/api/regras-agenda?medicoId=" + UUID.randomUUID())
            .with(principal("admin-filter-security", "ADMINISTRATOR")))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"));
  }

  private Fixture fixture(String name) {
    String suffix = name + "-" + IDS.incrementAndGet();
    var specialty = clinic.criarEspecialidade("Especialidade " + suffix, true);
    var unit = clinic.criarUnidade("Unidade " + suffix, "Endereço " + suffix, true);
    var room = clinic.criarConsultorio(unit.id(), "Sala " + suffix, true);
    var doctor = clinic.criarMedico("Médico " + suffix, Integer.toString(820000 + IDS.get()), "PA",
        List.of(specialty.id()), true);
    var rule = scheduling.criarRegra(new SchedulingConfigurationService.RegraCommand(
        doctor.id(), specialty.id(), room.id(), DayOfWeek.WEDNESDAY,
        LocalTime.of(10, 0), LocalTime.of(11, 0), 30, TODAY, TODAY, true, 0));
    return new Fixture(suffix, specialty.id(), unit.id(), room.id(), doctor.id(), rule.id());
  }

  private static UUID idFromLocation(String location) {
    return UUID.fromString(location.substring(location.lastIndexOf('/') + 1));
  }

  private static org.springframework.test.web.servlet.request.RequestPostProcessor principal(
      String subject, String role) {
    return jwt().jwt(token(subject, role)).authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }

  private static Jwt token(String subject, String role) {
    return Jwt.withTokenValue("synthetic").header("alg", "none").subject(subject)
        .issuer("http://issuer.test/realms/medflow").audience(List.of("medflow-api"))
        .issuedAt(FixedSchedulingClockConfiguration.NOW).expiresAt(
            FixedSchedulingClockConfiguration.NOW.plusSeconds(7200))
        .claim("resource_access", Map.of("medflow-api", Map.of("roles", List.of(role))))
        .build();
  }

  private record Fixture(String suffix, UUID specialtyId, UUID unitId, UUID roomId,
      UUID doctorId, UUID ruleId) { }
}
