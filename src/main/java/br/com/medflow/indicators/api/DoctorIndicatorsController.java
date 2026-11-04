package br.com.medflow.indicators.api;

import br.com.medflow.indicators.application.DoctorIndicatorsService;
import br.com.medflow.security.AuthenticatedContextService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/medico/indicadores")
@Validated
public class DoctorIndicatorsController {

  private final DoctorIndicatorsService indicators;
  private final AuthenticatedContextService contexts;

  public DoctorIndicatorsController(DoctorIndicatorsService indicators,
      AuthenticatedContextService contexts) {
    this.indicators = indicators;
    this.contexts = contexts;
  }

  @GetMapping
  @PreAuthorize("hasRole('DOCTOR')")
  @Operation(summary = "Indicadores operacionais do médico autenticado",
      description = "Agrega consultas pela data local agendada e finalizações pela data local real. "
          + "O intervalo inclusivo aceita no máximo 366 dias.")
  DoctorIndicatorsApi.Response find(Authentication authentication,
      @RequestParam @NotNull LocalDate inicio,
      @RequestParam @NotNull LocalDate fim) {
    return DoctorIndicatorsApi.response(
        indicators.find(contexts.resolve(authentication), inicio, fim));
  }
}
