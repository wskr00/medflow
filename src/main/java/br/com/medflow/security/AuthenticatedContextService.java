package br.com.medflow.security;

import br.com.medflow.clinic.application.IdentityProjectionService;
import br.com.medflow.common.auth.AuthenticatedActor;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;

/** Resolve a identidade autenticada sem criar ou alterar vínculos locais. */
@Service
public class AuthenticatedContextService {

  private static final String ROLE_PREFIX = "ROLE_";

  private final IdentityProjectionService identities;

  public AuthenticatedContextService(IdentityProjectionService identities) {
    this.identities = identities;
  }

  public AuthenticatedActor resolve(Authentication authentication) {
    if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication)
        || !authentication.isAuthenticated()) {
      throw new AuthenticationCredentialsNotFoundException("Identidade autenticada ausente.");
    }
    Set<String> roles = authentication.getAuthorities().stream()
        .map(authority -> authority.getAuthority())
        .filter(authority -> authority.startsWith(ROLE_PREFIX))
        .map(authority -> authority.substring(ROLE_PREFIX.length()))
        .collect(Collectors.toUnmodifiableSet());
    var projection = identities.lookup(jwtAuthentication.getToken().getSubject());
    return new AuthenticatedActor(
        jwtAuthentication.getToken().getSubject(),
        roles,
        roles.contains("PATIENT") ? projection.pacienteId() : null,
        roles.contains("DOCTOR") ? projection.medicoId() : null,
        projection.clinicaId(),
        projection.timeZone());
  }
}
