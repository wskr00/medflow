package br.com.medflow.indicators.api;

import br.com.medflow.indicators.application.AdminIndicatorsService;
import br.com.medflow.security.AuthenticatedContextService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/indicadores")
@Validated
public class AdminIndicatorsController {

  private final AdminIndicatorsService indicators;
  private final AuthenticatedContextService contexts;

  public AdminIndicatorsController(AdminIndicatorsService indicators,
      AuthenticatedContextService contexts) {
    this.indicators = indicators;
    this.contexts = contexts;
  }

  @GetMapping
  @PreAuthorize("hasRole('ADMINISTRATOR')")
  @Operation(summary = "Indicadores operacionais agregados da clínica",
      description = "Agrupa consultas pela data local agendada e finalizações pela data local real. "
          + "O intervalo inclusivo aceita no máximo 366 dias; filtros de unidade e especialidade "
          + "só aceitam recursos da clínica autenticada.")
  AdminIndicatorsApi.Response find(Authentication authentication,
      @RequestParam @NotNull LocalDate inicio,
      @RequestParam @NotNull LocalDate fim,
      @RequestParam(required = false) UUID unidadeId,
      @RequestParam(required = false) UUID especialidadeId) {
    return AdminIndicatorsApi.response(indicators.find(contexts.resolve(authentication),
        inicio, fim, unidadeId, especialidadeId));
  }
}
