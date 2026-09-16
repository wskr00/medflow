package br.com.medflow.security;

import br.com.medflow.common.auth.AuthenticatedActor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/** Gate de Method Security para os catálogos reais atualmente disponíveis. */
@Component("contextAuthorization")
public class ContextAuthorization {

  private final AuthenticatedContextService contexts;

  public ContextAuthorization(AuthenticatedContextService contexts) {
    this.contexts = contexts;
  }

  /** Catálogo administrativo é completo; recepção e paciente recebem somente itens ativos. */
  public boolean canReadSelectionCatalog(Authentication authentication, boolean incluirInativas) {
    AuthenticatedActor context = contexts.resolve(authentication);
    if (context.hasRole("ADMINISTRATOR")) {
      return true;
    }
    if (incluirInativas) {
      return false;
    }
    if (context.hasRole("RECEPTIONIST")) {
      return true;
    }
    return context.hasRole("PATIENT") && context.pacienteId() != null;
  }
}
