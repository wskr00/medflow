package br.com.medflow.common.auth;

import java.util.Set;
import java.util.UUID;

/** Identidade local pura; não depende de Spring Security, JWT, HTTP ou estado global. */
public record AuthenticatedActor(
    String subject,
    Set<String> roles,
    UUID pacienteId,
    UUID medicoId,
    UUID clinicaId,
    String timeZone) {

  public AuthenticatedActor {
    roles = Set.copyOf(roles);
  }

  public boolean hasRole(String role) {
    return roles.contains(role);
  }
}
