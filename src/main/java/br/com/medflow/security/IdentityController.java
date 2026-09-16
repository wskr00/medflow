package br.com.medflow.security;

import com.fasterxml.jackson.annotation.JsonInclude;
import br.com.medflow.clinic.application.IdentityProjectionService;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class IdentityController {

  private final String timeZone;
  private final IdentityProjectionService identities;

  public IdentityController(@Value("${medflow.security.time-zone:America/Belem}") String timeZone,
      IdentityProjectionService identities) {
    this.timeZone = timeZone;
    this.identities = identities;
  }

  @GetMapping("/me")
  public ResponseEntity<IdentityResponse> me(Authentication authentication) {
    Jwt jwt = ((JwtAuthenticationToken) authentication).getToken();
    List<String> roles = authentication.getAuthorities().stream()
        .map(authority -> authority.getAuthority())
        .filter(authority -> authority.startsWith("ROLE_"))
        .map(authority -> authority.substring("ROLE_".length()))
        .sorted(Comparator.naturalOrder())
        .toList();
    var projection = identities.lookup(jwt.getSubject(), Set.copyOf(roles));
    return ResponseEntity.ok(new IdentityResponse(
        jwt.getSubject(),
        roles,
        projection.pacienteId(),
        projection.medicoId(),
        projection.clinicaId(),
        projection.timeZone() == null ? timeZone : projection.timeZone()));
  }

  @JsonInclude(JsonInclude.Include.ALWAYS)
  public record IdentityResponse(
      String subject,
      List<String> roles,
      UUID pacienteId,
      UUID medicoId,
      UUID clinicaId,
      String timeZone) {
  }
}
