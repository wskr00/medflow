package br.com.medflow.audit.web;

import br.com.medflow.audit.domain.AuditAction;
import br.com.medflow.audit.domain.AuditResourceType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.server.PathContainer;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

/** Anexa metadados estáticos da operação; não lê payload, parâmetros ou cabeçalhos. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class AuditIntentFilter extends OncePerRequestFilter {

  public static final String ATTRIBUTE = AuditIntentFilter.class.getName() + ".intent";
  private static final PathPatternParser PARSER = new PathPatternParser();
  private static final List<Route> ROUTES = List.of(
      route(HttpMethod.PUT, "/api/clinica", AuditAction.ALTERAR_CLINICA, AuditResourceType.CLINICA),
      route(HttpMethod.POST, "/api/unidades", AuditAction.CRIAR_UNIDADE, AuditResourceType.UNIDADE),
      route(HttpMethod.PUT, "/api/unidades/{id}", AuditAction.ALTERAR_UNIDADE, AuditResourceType.UNIDADE),
      route(HttpMethod.POST, "/api/consultorios", AuditAction.CRIAR_CONSULTORIO, AuditResourceType.CONSULTORIO),
      route(HttpMethod.PUT, "/api/consultorios/{id}", AuditAction.ALTERAR_CONSULTORIO, AuditResourceType.CONSULTORIO),
      route(HttpMethod.POST, "/api/especialidades", AuditAction.CRIAR_ESPECIALIDADE, AuditResourceType.ESPECIALIDADE),
      route(HttpMethod.PUT, "/api/especialidades/{id}", AuditAction.ALTERAR_ESPECIALIDADE, AuditResourceType.ESPECIALIDADE),
      route(HttpMethod.POST, "/api/medicos", AuditAction.CRIAR_MEDICO, AuditResourceType.MEDICO),
      route(HttpMethod.PUT, "/api/medicos/{id}", AuditAction.ALTERAR_MEDICO, AuditResourceType.MEDICO),
      route(HttpMethod.POST, "/api/regras-agenda", AuditAction.CRIAR_REGRA_AGENDA, AuditResourceType.REGRA_AGENDA),
      route(HttpMethod.PUT, "/api/regras-agenda/{id}", AuditAction.ALTERAR_REGRA_AGENDA, AuditResourceType.REGRA_AGENDA),
      route(HttpMethod.POST, "/api/bloqueios-agenda", AuditAction.CRIAR_BLOQUEIO_AGENDA, AuditResourceType.BLOQUEIO_AGENDA),
      route(HttpMethod.PUT, "/api/bloqueios-agenda/{id}", AuditAction.ALTERAR_BLOQUEIO_AGENDA, AuditResourceType.BLOQUEIO_AGENDA),
      route(HttpMethod.POST, "/api/agendamentos", AuditAction.AGENDAR, AuditResourceType.AGENDAMENTO),
      route(HttpMethod.POST, "/api/agendamentos/{id}/reagendamento", AuditAction.REAGENDAR, AuditResourceType.AGENDAMENTO),
      route(HttpMethod.POST, "/api/agendamentos/{id}/cancelamento", AuditAction.CANCELAR, AuditResourceType.AGENDAMENTO),
      route(HttpMethod.POST, "/api/agendamentos/{id}/check-in", AuditAction.REALIZAR_CHECK_IN, AuditResourceType.AGENDAMENTO),
      route(HttpMethod.POST, "/api/agendamentos/{id}/atendimento", AuditAction.INICIAR_ATENDIMENTO, AuditResourceType.AGENDAMENTO),
      route(HttpMethod.GET, "/api/atendimentos/{id}", AuditAction.LER_REGISTRO_CLINICO, AuditResourceType.ATENDIMENTO),
      route(HttpMethod.PUT, "/api/atendimentos/{id}/registro-clinico", AuditAction.SALVAR_REGISTRO_CLINICO, AuditResourceType.ATENDIMENTO),
      route(HttpMethod.POST, "/api/atendimentos/{id}/finalizacao", AuditAction.FINALIZAR_ATENDIMENTO, AuditResourceType.ATENDIMENTO),
      route(HttpMethod.GET, "/api/medico/pacientes/{id}/historico", AuditAction.CONSULTAR_HISTORICO_CLINICO, AuditResourceType.PACIENTE),
      route(HttpMethod.GET, "/api/auditoria", AuditAction.CONSULTAR_AUDITORIA, AuditResourceType.AUDITORIA));

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    PathContainer path = PathContainer.parsePath(request.getRequestURI());
    for (Route route : ROUTES) {
      if (!route.method().matches(request.getMethod())) continue;
      PathPattern.PathMatchInfo match = route.pattern().matchAndExtract(path);
      if (match != null) {
        request.setAttribute(ATTRIBUTE, new AuditIntent(route.action(), route.resourceType(),
            resourceId(match.getUriVariables().get("id"))));
        break;
      }
    }
    filterChain.doFilter(request, response);
  }

  public static AuditIntent intent(HttpServletRequest request) {
    return request.getAttribute(ATTRIBUTE) instanceof AuditIntent intent ? intent : null;
  }

  private static Route route(HttpMethod method, String path,
      AuditAction action, AuditResourceType resourceType) {
    return new Route(method, PARSER.parse(path), action, resourceType);
  }

  private static UUID resourceId(String value) {
    if (value == null) return null;
    try {
      return UUID.fromString(value);
    } catch (IllegalArgumentException exception) {
      return null;
    }
  }

  private record Route(HttpMethod method, PathPattern pattern,
      AuditAction action, AuditResourceType resourceType) { }
}
