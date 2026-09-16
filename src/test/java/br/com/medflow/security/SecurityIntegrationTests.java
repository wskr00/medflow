package br.com.medflow.security;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import br.com.medflow.PostgresTestConfiguration;
import br.com.medflow.clinic.application.ClinicConfigurationService;
import br.com.medflow.clinic.application.PatientProvisioningService;
import br.com.medflow.common.http.RequestIdFilter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "spring.security.oauth2.resourceserver.jwt.issuer-uri=http://issuer.test/realms/medflow",
    "spring.security.oauth2.resourceserver.jwt.jwk-set-uri=http://localhost.invalid/jwks",
    "spring.security.oauth2.resourceserver.jwt.audiences=medflow-api"
})
@AutoConfigureMockMvc
@Import(PostgresTestConfiguration.class)
class SecurityIntegrationTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ClinicConfigurationService clinic;

    @Autowired
    private PatientProvisioningService patients;

    @Test
    void actuatorHealthIsPublicAndUsesNativeEndpoint() throws Exception {
        mvc.perform(get("/actuator/health"))
            .andExpect(status().isOk())
            .andExpect(content().json("{\"status\":\"UP\"}"));
    }

    @Test
    void protectedEndpointWithoutTokenReturnsCommonCorrelatedError() throws Exception {
        var response = mvc.perform(get("/api/me"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.status").value(401))
            .andExpect(jsonPath("$.code").value("NAO_AUTENTICADO"))
            .andExpect(jsonPath("$.fieldErrors").isEmpty())
            .andExpect(header().string("WWW-Authenticate", org.hamcrest.Matchers.startsWith("Bearer")))
            .andExpect(header().exists(RequestIdFilter.HEADER))
            .andReturn().getResponse();

        assertThat(response.getContentAsString())
            .contains(response.getHeader(RequestIdFilter.HEADER));
    }

    @Test
    void administrativeMutationRequiresAdministratorRole() throws Exception {
        String payload = "{\"nome\":\"Unidade sintética\",\"endereco\":\"Rua 1\",\"ativo\":true}";
        mvc.perform(post("/api/unidades").contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(payload))
            .andExpect(status().isUnauthorized());
        for (String role : List.of("PATIENT", "RECEPTIONIST", "DOCTOR")) {
            mvc.perform(post("/api/unidades").contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .content(payload).with(jwt().jwt(tokenWithRoles(role))
                        .authorities(new SimpleGrantedAuthority("ROLE_" + role))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACESSO_NEGADO"));
        }
        for (String path : List.of("/api/clinica", "/api/consultorios", "/api/regras-agenda", "/api/bloqueios-agenda")) {
            mvc.perform(get(path).with(jwt().jwt(tokenWithRoles("PATIENT"))
                    .authorities(new SimpleGrantedAuthority("ROLE_PATIENT"))))
                .andExpect(status().isForbidden());
        }
        for (String path : List.of("/api/unidades", "/api/especialidades", "/api/medicos")) {
            mvc.perform(get(path).with(jwt().jwt(tokenWithRoles("DOCTOR"))
                    .authorities(new SimpleGrantedAuthority("ROLE_DOCTOR"))))
                .andExpect(status().isForbidden());
        }
    }

    @Test
    void patientAndReceptionistReceiveOnlyActiveMinimalCatalogs() throws Exception {
        var specialty = clinic.criarEspecialidade("Catálogo ativo", true);
        var unit = clinic.criarUnidade("Unidade catálogo", "Endereço privado", true);
        clinic.criarMedico("Médico catálogo", "88888", "PA", List.of(specialty.id()), true);
        clinic.criarEspecialidade("Catálogo inativo", false);
        for (String role : List.of("PATIENT", "RECEPTIONIST")) {
            var principal = jwt().jwt(tokenWithRoles(role))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
            mvc.perform(get("/api/unidades").with(principal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").exists())
                .andExpect(jsonPath("$.items[0].nome").exists())
                .andExpect(jsonPath("$.items[0].endereco").doesNotExist())
                .andExpect(jsonPath("$.items[0].ativo").doesNotExist())
                .andExpect(jsonPath("$.items[0].version").doesNotExist());
            mvc.perform(get("/api/medicos").with(principal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].especialidadeIds").isArray())
                .andExpect(jsonPath("$.items[0].crmNumero").doesNotExist());
            mvc.perform(get("/api/especialidades?incluirInativas=true").with(principal))
                .andExpect(status().isForbidden());
        }
        var admin = jwt().jwt(tokenWithRoles("ADMINISTRATOR"))
            .authorities(new SimpleGrantedAuthority("ROLE_ADMINISTRATOR"));
        mvc.perform(get("/api/especialidades?incluirInativas=true").with(admin))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].ativo").exists())
            .andExpect(jsonPath("$.totalElements").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)));
    }

    @Test
    void administratorCreatesListsAndUpdatesConfigurationWithMandatoryVersion() throws Exception {
        var admin = jwt().jwt(tokenWithRoles("ADMINISTRATOR"))
            .authorities(new SimpleGrantedAuthority("ROLE_ADMINISTRATOR"));
        var created = mvc.perform(post("/api/unidades").with(admin)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"Unidade HTTP\",\"endereco\":\"Rua HTTP\",\"ativo\":true}"))
            .andExpect(status().isCreated())
            .andExpect(header().exists("Location"))
            .andReturn();
        String location = created.getResponse().getHeader("Location");
        mvc.perform(get("/api/unidades?page=0&size=1").with(admin))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items").isArray())
            .andExpect(jsonPath("$.page").value(0))
            .andExpect(jsonPath("$.size").value(1))
            .andExpect(jsonPath("$.totalElements").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(location).with(admin)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"Unidade HTTP alterada\",\"endereco\":\"Rua HTTP\",\"ativo\":true,\"expectedVersion\":0}"))
            .andExpect(status().isOk());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(location).with(admin)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"Inválida\",\"endereco\":\"Rua\",\"ativo\":true}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("ENTRADA_INVALIDA"));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(location).with(admin)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"Versão antiga\",\"endereco\":\"Rua HTTP\",\"ativo\":true,\"expectedVersion\":0}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("VERSAO_DESATUALIZADA"));
    }

    @Test
    void authenticatedTokenWithoutMvpRoleReturnsCorrelated403() throws Exception {
        Jwt token = tokenWithRoles("UNKNOWN_ROLE");

        var response = mvc.perform(get("/api/me").with(jwt().jwt(token).authorities(List.of())))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.status").value(403))
            .andExpect(jsonPath("$.code").value("ACESSO_NEGADO"))
            .andExpect(header().exists(RequestIdFilter.HEADER))
            .andReturn().getResponse();

        assertThat(response.getContentAsString())
            .contains(response.getHeader(RequestIdFilter.HEADER));
    }

    @Test
    void malformedBearerTokenReturnsCommonErrorWithoutDecoderDetails() throws Exception {
        mvc.perform(get("/api/me").header("Authorization", "Bearer not-a-jwt"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("NAO_AUTENTICADO"))
            .andExpect(content().string(org.hamcrest.Matchers.not(
                org.hamcrest.Matchers.containsString("not-a-jwt"))));
    }

    @Test
    void authenticatedIdentityContainsOnlyAllowedClientRoles() throws Exception {
        var specialty = clinic.criarEspecialidade("Especialidade de teste", true);
        var doctor = clinic.criarMedico("Médico de teste", "99999", "PA", List.of(specialty.id()), true);
        clinic.provisionarSubjectMedico(doctor.id(), "subject-sintetico");
        var patient = patients.provisionar("subject-sintetico", "Paciente de teste");
        Jwt token = tokenWithRoles("PATIENT", "DOCTOR", "UNKNOWN_ROLE");
        var converter = new SecurityConfiguration.MedflowApiRolesConverter();

        mvc.perform(get("/api/me").with(jwt().jwt(token).authorities(converter.convert(token))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.subject").value("subject-sintetico"))
            .andExpect(jsonPath("$.roles[0]").value("DOCTOR"))
            .andExpect(jsonPath("$.roles[1]").value("PATIENT"))
            .andExpect(jsonPath("$.roles.length()").value(2))
            .andExpect(jsonPath("$.pacienteId").value(patient.id().toString()))
            .andExpect(jsonPath("$.medicoId").value(doctor.id().toString()))
            .andExpect(jsonPath("$.clinicaId").value("00000000-0000-0000-0000-000000000001"))
            .andExpect(jsonPath("$.timeZone").value("America/Belem"));

        assertThat(converter.convert(token)).containsExactlyInAnyOrder(
            new SimpleGrantedAuthority("ROLE_PATIENT"),
            new SimpleGrantedAuthority("ROLE_DOCTOR"));
    }

    @Test
    void unknownSubjectDoesNotCreateLocalIdentityLink() throws Exception {
        Jwt token = Jwt.withTokenValue("synthetic")
            .header("alg", "none")
            .subject("subject-desconhecido")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(300))
            .claim("resource_access", Map.of("medflow-api", Map.of("roles", List.of("PATIENT"))))
            .build();
        mvc.perform(get("/api/me").with(jwt().jwt(token)
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_PATIENT")))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.pacienteId").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.medicoId").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.clinicaId").value("00000000-0000-0000-0000-000000000001"));
    }

    @Test
    void rolesFromAnotherClientAreIgnored() {
        Jwt token = Jwt.withTokenValue("synthetic")
            .header("alg", "none")
            .subject("subject-sintetico")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(300))
            .claim("resource_access", Map.of(
                "other-client", Map.of("roles", List.of("ADMINISTRATOR"))))
            .build();

        assertThat(new SecurityConfiguration.MedflowApiRolesConverter().convert(token)).isEmpty();
    }

    private Jwt tokenWithRoles(String... roles) {
        return Jwt.withTokenValue("synthetic")
            .header("alg", "none")
            .subject("subject-sintetico")
            .issuer("http://issuer.test/realms/medflow")
            .audience(List.of("medflow-api"))
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(300))
            .claim("resource_access", Map.of(
                "medflow-api", Map.of("roles", List.of(roles))))
            .build();
    }
}
