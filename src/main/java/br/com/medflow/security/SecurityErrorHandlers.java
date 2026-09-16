package br.com.medflow.security;

import tools.jackson.databind.ObjectMapper;
import br.com.medflow.audit.domain.AuditResult;
import br.com.medflow.audit.web.AuditFailureReporter;
import br.com.medflow.common.http.ApiError;
import br.com.medflow.common.http.RequestIdFilter;
import java.io.IOException;
import java.util.List;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;

final class SecurityErrorHandlers {

  private SecurityErrorHandlers() {
  }

  static AuthenticationEntryPoint authenticationEntryPoint(
      ObjectMapper objectMapper, AuditFailureReporter auditFailures) {
    var bearerEntryPoint = new BearerTokenAuthenticationEntryPoint();
    return (request, response, exception) -> {
      bearerEntryPoint.commence(request, response, exception);
      auditFailures.record(request, AuditResult.NEGADO);
      writeError(
          objectMapper,
          request,
          response,
          HttpServletResponse.SC_UNAUTHORIZED,
          "NAO_AUTENTICADO",
          "É necessário autenticar para acessar este recurso.");
    };
  }

  static AccessDeniedHandler accessDeniedHandler(
      ObjectMapper objectMapper, AuditFailureReporter auditFailures) {
    return (request, response, exception) -> {
      auditFailures.record(request, AuditResult.NEGADO);
      writeError(
          objectMapper,
          request,
          response,
          HttpServletResponse.SC_FORBIDDEN,
          "ACESSO_NEGADO",
          "Você não tem permissão para acessar este recurso.");
    };
  }

  private static void writeError(
      ObjectMapper objectMapper,
      HttpServletRequest request,
      HttpServletResponse response,
      int status,
      String code,
      String message) throws IOException {
    String requestId = requestId(request);
    response.setStatus(status);
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.setCharacterEncoding("UTF-8");
    response.setHeader("X-Request-Id", requestId);
    objectMapper.writeValue(response.getWriter(), new ApiError(
        status,
        code,
        message,
        requestId,
        List.of()));
  }

  private static String requestId(HttpServletRequest request) {
    return RequestIdFilter.requestId(request);
  }
}
