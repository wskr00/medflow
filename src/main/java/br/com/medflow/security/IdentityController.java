package br.com.medflow.security;

import br.com.medflow.common.auth.AuthenticatedActor;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class IdentityController {

  private final AuthenticatedContextService contexts;

  public IdentityController(AuthenticatedContextService contexts) {
    this.contexts = contexts;
  }

  @GetMapping("/me")
  @PreAuthorize("hasAnyRole('PATIENT','RECEPTIONIST','DOCTOR','ADMINISTRATOR')")
  public ResponseEntity<IdentityResponse> me(Authentication authentication) {
    AuthenticatedActor context = contexts.resolve(authentication);
    List<String> roles = context.roles().stream()
        .sorted(Comparator.naturalOrder())
        .toList();
    return ResponseEntity.ok(new IdentityResponse(
        context.subject(),
        roles,
        context.pacienteId(),
        context.medicoId(),
        context.clinicaId(),
        context.timeZone()));
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
