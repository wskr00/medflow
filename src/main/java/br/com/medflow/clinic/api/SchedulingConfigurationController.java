package br.com.medflow.clinic.api;

import br.com.medflow.scheduling.application.SchedulingConfigurationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.net.URI;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Rotas de configuração; disponibilidade e agendamento são implementados na Issue #10. */
@RestController
@RequestMapping("/api")
@PreAuthorize("hasRole('ADMINISTRATOR')")
public class SchedulingConfigurationController {

  private final SchedulingConfigurationService service;

  public SchedulingConfigurationController(SchedulingConfigurationService service) { this.service = service; }

  @GetMapping("/regras-agenda")
  java.util.List<ConfigurationApi.RegraResponse> regras(
      @RequestParam(defaultValue = "false") boolean incluirInativas) {
    return service.regras(incluirInativas).stream().map(ConfigurationApi::regra).toList();
  }

  @PostMapping("/regras-agenda")
  ResponseEntity<ConfigurationApi.RegraResponse> criarRegra(@Valid @RequestBody RegraInput input) {
    var value = ConfigurationApi.regra(service.criarRegra(input.toCommand(0)));
    return ResponseEntity.created(URI.create("/api/regras-agenda/" + value.id())).body(value);
  }

  @PutMapping("/regras-agenda/{id}")
  ConfigurationApi.RegraResponse alterarRegra(@PathVariable UUID id, @Valid @RequestBody RegraUpdate input) {
    return ConfigurationApi.regra(service.alterarRegra(id, input.toCommand()));
  }

  @GetMapping("/bloqueios-agenda")
  java.util.List<ConfigurationApi.BloqueioResponse> bloqueios(
      @RequestParam(defaultValue = "false") boolean incluirInativas) {
    return service.bloqueios(incluirInativas).stream().map(ConfigurationApi::bloqueio).toList();
  }

  @PostMapping("/bloqueios-agenda")
  ResponseEntity<ConfigurationApi.BloqueioResponse> criarBloqueio(@Valid @RequestBody BloqueioInput input) {
    var value = ConfigurationApi.bloqueio(service.criarBloqueio(input.toCommand(0)));
    return ResponseEntity.created(URI.create("/api/bloqueios-agenda/" + value.id())).body(value);
  }

  @PutMapping("/bloqueios-agenda/{id}")
  ConfigurationApi.BloqueioResponse alterarBloqueio(@PathVariable UUID id, @Valid @RequestBody BloqueioUpdate input) {
    return ConfigurationApi.bloqueio(service.alterarBloqueio(id, input.toCommand()));
  }

  record RegraInput(@NotNull UUID medicoId, @NotNull UUID especialidadeId, @NotNull UUID consultorioId,
      @NotNull @Min(1) @Max(7) Integer diaSemana, @NotNull LocalTime horaInicio, @NotNull LocalTime horaFim,
      @Positive int duracaoMinutos, @NotNull LocalDate vigenteDe, LocalDate vigenteAte, boolean ativo) {
    SchedulingConfigurationService.RegraCommand toCommand(long expectedVersion) {
      return new SchedulingConfigurationService.RegraCommand(medicoId, especialidadeId, consultorioId,
          DayOfWeek.of(diaSemana), horaInicio, horaFim, duracaoMinutos, vigenteDe, vigenteAte, ativo, expectedVersion);
    }
  }
  record RegraUpdate(@NotNull UUID medicoId, @NotNull UUID especialidadeId, @NotNull UUID consultorioId,
      @NotNull @Min(1) @Max(7) Integer diaSemana, @NotNull LocalTime horaInicio, @NotNull LocalTime horaFim,
      @Positive int duracaoMinutos, @NotNull LocalDate vigenteDe, LocalDate vigenteAte, boolean ativo,
      @PositiveOrZero long expectedVersion) {
    SchedulingConfigurationService.RegraCommand toCommand() {
      return new SchedulingConfigurationService.RegraCommand(medicoId, especialidadeId, consultorioId,
          DayOfWeek.of(diaSemana), horaInicio, horaFim, duracaoMinutos, vigenteDe, vigenteAte, ativo, expectedVersion);
    }
  }
  record BloqueioInput(@NotNull UUID medicoId, @NotNull Instant inicio, @NotNull Instant fim, boolean ativo) {
    SchedulingConfigurationService.BloqueioCommand toCommand(long expectedVersion) {
      return new SchedulingConfigurationService.BloqueioCommand(medicoId, inicio, fim, ativo, expectedVersion);
    }
  }
  record BloqueioUpdate(@NotNull UUID medicoId, @NotNull Instant inicio, @NotNull Instant fim, boolean ativo,
      @PositiveOrZero long expectedVersion) {
    SchedulingConfigurationService.BloqueioCommand toCommand() {
      return new SchedulingConfigurationService.BloqueioCommand(medicoId, inicio, fim, ativo, expectedVersion);
    }
  }
}
