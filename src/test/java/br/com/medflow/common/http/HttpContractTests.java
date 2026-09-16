package br.com.medflow.common.http;

import java.util.UUID;

import br.com.medflow.health.HealthController;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Tests HTTP/MVC independently of authentication; fixtures exist only in test sources. */
class HttpContractTests {

    private MockMvc mvc;
    private LocalValidatorFactoryBean validator;

    @BeforeEach
    void setUp() {
        validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mvc = MockMvcBuilders.standaloneSetup(new HealthController(), new HttpFixture())
                .setControllerAdvice(new ApiExceptionHandler())
                .setValidator(validator)
                .addFilters(new RequestIdFilter())
                .build();
    }

    @AfterEach
    void tearDown() {
        validator.close();
        MDC.clear();
    }

    @Test
    void healthExposesOnlyProcessStatusAndServerGeneratedCorrelation() throws Exception {
        MvcResult first = mvc.perform(get("/api/health").header(RequestIdFilter.HEADER, "client-controlled"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"UP\"}"))
                .andExpect(jsonPath("$.length()").value(1))
                .andReturn();
        String id = first.getResponse().getHeader(RequestIdFilter.HEADER);
        assertThat(UUID.fromString(id).toString()).isEqualTo(id);
        MvcResult second = mvc.perform(get("/api/health")).andReturn();
        assertThat(second.getResponse().getHeader(RequestIdFilter.HEADER)).isNotEqualTo(id);
        assertThat(MDC.get("requestId")).isNull();
    }

    @Test
    void beanValidationReturnsSafe400WithMatchingRequestId() throws Exception {
        MvcResult result = mvc.perform(post("/test-only/validation")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"value\":\" \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("ENTRADA_INVALIDA"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("value"))
                .andExpect(jsonPath("$.fieldErrors[0].code").value("CAMPO_INVALIDO"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("Valor inválido."))
                .andExpect(content().string(not(containsString("sensitive-constraint-message"))))
                .andExpect(jsonPath("$.length()").value(5))
                .andReturn();
        mvcResultHasMatchingCorrelation(result);
    }

    @Test
    void validFixturePayloadIsAccepted() throws Exception {
        mvc.perform(post("/test-only/validation").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"synthetic\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void malformedJsonDoesNotLeakInputOrParserDetails() throws Exception {
        mvc.perform(post("/test-only/validation").contentType(MediaType.APPLICATION_JSON)
                        .content("{secret-clinical-value"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ENTRADA_INVALIDA"))
                .andExpect(jsonPath("$.fieldErrors").isEmpty())
                .andExpect(content().string(not(containsString("secret-clinical-value"))));
    }

    @Test
    void typeMismatchAndMissingParameterRemain400() throws Exception {
        mvc.perform(get("/test-only/parameter").param("number", "secret-invalid-value"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ENTRADA_INVALIDA"))
                .andExpect(content().string(not(containsString("secret-invalid-value"))));
        mvc.perform(get("/test-only/parameter"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ENTRADA_INVALIDA"));
    }

    @Test
    void unsupportedMethodKeeps405AndAllowHeader() throws Exception {
        mvc.perform(post("/api/health"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(header().string("Allow", containsString("GET")))
                .andExpect(jsonPath("$.status").value(405))
                .andExpect(jsonPath("$.code").value("METODO_NAO_PERMITIDO"));
    }

    @Test
    void unsupportedContentTypeRemains415() throws Exception {
        mvc.perform(post("/test-only/validation").contentType(MediaType.TEXT_PLAIN).content("sensitive"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.status").value(415))
                .andExpect(jsonPath("$.code").value("TIPO_DE_CONTEUDO_NAO_SUPORTADO"));
    }

    @Test
    void unknownRouteRemains404() throws Exception {
        mvc.perform(get("/api/does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"));
    }

    @Test
    void unexpectedFailureIsGenericAndCorrelated() throws Exception {
        MvcResult result = mvc.perform(get("/test-only/failure"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.code").value("ERRO_INTERNO"))
                .andExpect(jsonPath("$.message").value("Não foi possível concluir a operação."))
                .andExpect(jsonPath("$.fieldErrors").isEmpty())
                .andExpect(content().string(not(containsString("SELECT"))))
                .andExpect(content().string(not(containsString("clinical-secret"))))
                .andReturn();
        mvcResultHasMatchingCorrelation(result);
        assertThat(MDC.get("requestId")).isNull();
    }

    @Test
    void securityExceptionIsLeftForSecurityHandlers() {
        assertThatThrownBy(() -> mvc.perform(get("/test-only/denied")))
                .hasCauseInstanceOf(AccessDeniedException.class);
        assertThat(MDC.get("requestId")).isNull();
    }

    private void mvcResultHasMatchingCorrelation(MvcResult result) throws Exception {
        jsonPath("$.requestId").value(result.getResponse().getHeader(RequestIdFilter.HEADER)).match(result);
    }

    @RestController
    static class HttpFixture {
        @PostMapping("/test-only/validation")
        void validate(@Valid @RequestBody ValidatedInput input) { }

        @GetMapping("/test-only/parameter")
        void parameter(@RequestParam int number) { }

        @GetMapping("/test-only/failure")
        void failure() {
            throw new IllegalStateException("SELECT clinical-secret FROM private_record");
        }

        @GetMapping("/test-only/denied")
        void denied() {
            throw new AccessDeniedException("private resource");
        }
    }

    record ValidatedInput(@NotBlank(message = "sensitive-constraint-message") String value) { }
}
