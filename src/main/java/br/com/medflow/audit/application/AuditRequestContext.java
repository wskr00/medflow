package br.com.medflow.audit.application;

import br.com.medflow.audit.domain.AuditActorKind;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/** Captura somente identidade e correlação já confiadas pela infraestrutura. */
@Component
public class AuditRequestContext {

  public Context current() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    AuditActorKind actorKind = AuditActorKind.ANONIMO;
    String subject = null;
    if (authentication instanceof JwtAuthenticationToken jwt && authentication.isAuthenticated()) {
      actorKind = AuditActorKind.AUTENTICADO;
      subject = jwt.getToken().getSubject();
    }
    return new Context(actorKind, subject, requestId());
  }

  private UUID requestId() {
    String requestId = MDC.get("requestId");
    if (requestId != null) return UUID.fromString(requestId);
    return UUID.randomUUID();
  }

  public record Context(AuditActorKind actorKind, String actorSubject, UUID requestId) { }
}
