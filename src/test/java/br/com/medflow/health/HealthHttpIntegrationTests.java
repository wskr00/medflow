package br.com.medflow.health;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Verifies component/filter registration without replacing the application's security chain. */
@SpringBootTest
@AutoConfigureMockMvc
class HealthHttpIntegrationTests {

    @Autowired
    private MockMvc mvc;

    @Test
    @WithMockUser
    void healthAndCorrelationAreRegisteredInApplicationContext() throws Exception {
        var response = mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"UP\"}"))
                .andExpect(jsonPath("$.length()").value(1))
                .andReturn().getResponse();
        String id = response.getHeader("X-Request-Id");
        assertThat(UUID.fromString(id).toString()).isEqualTo(id);
    }
}
