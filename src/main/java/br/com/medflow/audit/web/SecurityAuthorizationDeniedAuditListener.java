package br.com.medflow.audit.web;

import br.com.medflow.audit.domain.AuditResult;
import org.springframework.context.ApplicationListener;
import org.springframework.security.authorization.event.AuthorizationDeniedEvent;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Usa o evento nativo de autorização; o handler permanece fallback para Bearer/EntryPoint. */
@Component
public class SecurityAuthorizationDeniedAuditListener
    implements ApplicationListener<AuthorizationDeniedEvent<?>> {

  private final AuditFailureReporter failures;

  public SecurityAuthorizationDeniedAuditListener(AuditFailureReporter failures) {
    this.failures = failures;
  }

  @Override
  public void onApplicationEvent(AuthorizationDeniedEvent<?> event) {
    if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
      failures.record(attributes.getRequest(), AuditResult.NEGADO);
    }
  }
}
