package br.com.medflow.common.http;

import java.io.IOException;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RequestIdFilterTests {

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void ignoresUntrustedHeaderAndRestoresMdcWhenChainFails() {
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        request.addHeader(RequestIdFilter.HEADER, "untrusted\r\nInjected: value");
        MDC.put("requestId", "previous-context");

        assertThatThrownBy(() -> new RequestIdFilter().doFilter(request, response, (req, res) -> {
            assertThat(MDC.get("requestId")).isEqualTo(request.getAttribute(RequestIdFilter.ATTRIBUTE));
            throw new IOException("synthetic failure");
        })).isInstanceOf(IOException.class);

        String id = response.getHeader(RequestIdFilter.HEADER);
        assertThat(UUID.fromString(id).toString()).isEqualTo(id);
        assertThat(id).isNotEqualTo("previous-context");
        assertThat(MDC.get("requestId")).isEqualTo("previous-context");
    }
}
