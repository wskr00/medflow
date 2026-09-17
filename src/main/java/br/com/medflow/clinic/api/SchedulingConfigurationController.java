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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
import org.springframework.validation.annotation.Validated;

/** Rotas de configuração; disponibilidade e agendamento são implementados na Issue #10. */
@RestController
@RequestMapping("/api")
@PreAuthorize("hasRole('ADMINISTRATOR')")
@Validated
public class SchedulingConfigurationController {

  private final SchedulingConfigurationService service;

  public SchedulingConfigurationController(SchedulingConfigurationService service) { this.service = service; }

  @GetMapping("/regras-agenda")
  ConfigurationApi.PageResponse<ConfigurationApi.RegraResponse> regras(
      @RequestParam(defaultValue = "false") boolean incluirInativas,
      @RequestParam(required = false) UUID medicoId,
      @RequestParam(required = false) UUID especialidadeId,
      @RequestParam(required = false) UUID consultorioId,
      @RequestParam(defaultValue = "0") @PositiveOrZero int page,
      @RequestParam(defaultValue = "20") @jakarta.validation.constraints.Min(1) @Max(100) int size) {
    return page(service.regras(incluirInativas, medicoId, especialidadeId, consultorioId,
        PageRequest.of(page, size, Sort.by(Sort.Order.desc("vigenteDe"), Sort.Order.asc("id")))),
        ConfigurationApi::regra);
  }

  @GetMapping("/regras-agenda/{id}")
  @Operation(summary = "Detalha regra de agenda administrativa")
  ConfigurationApi.RegraResponse regra(@PathVariable UUID id) {
    return ConfigurationApi.regra(service.regra(id));
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
  ConfigurationApi.PageResponse<ConfigurationApi.BloqueioResponse> bloqueios(
      @RequestParam(defaultValue = "false") boolean incluirInativas,
      @RequestParam(required = false) UUID medicoId,
      @RequestParam(defaultValue = "0") @PositiveOrZero int page,
      @RequestParam(defaultValue = "20") @jakarta.validation.constraints.Min(1) @Max(100) int size) {
    return page(service.bloqueios(incluirInativas, medicoId,
        PageRequest.of(page, size, Sort.by(Sort.Order.desc("inicio"), Sort.Order.asc("id")))),
        ConfigurationApi::bloqueio);
  }

  @GetMapping("/bloqueios-agenda/{id}")
  @Operation(summary = "Detalha bloqueio de agenda administrativa",
      description = "Instantes são devolvidos com o offset do fuso da clínica.")
  ConfigurationApi.BloqueioResponse bloqueio(@PathVariable UUID id) {
    return ConfigurationApi.bloqueio(service.bloqueio(id));
  }

  @PostMapping("/bloqueios-agenda")
  ResponseEntity<ConfigurationApi.BloqueioResponse> criarBloqueio(@Valid @RequestBody BloqueioInput input) {
    var value = ConfigurationApi.bloqueio(service.criarBloqueioLocal(input.toCommand(0)));
    return ResponseEntity.created(URI.create("/api/bloqueios-agenda/" + value.id())).body(value);
  }

  @PutMapping("/bloqueios-agenda/{id}")
  ConfigurationApi.BloqueioResponse alterarBloqueio(@PathVariable UUID id, @Valid @RequestBody BloqueioUpdate input) {
    return ConfigurationApi.bloqueio(service.alterarBloqueioLocal(id, input.toCommand()));
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
      @NotNull @PositiveOrZero Long expectedVersion) {
    SchedulingConfigurationService.RegraCommand toCommand() {
      return new SchedulingConfigurationService.RegraCommand(medicoId, especialidadeId, consultorioId,
          DayOfWeek.of(diaSemana), horaInicio, horaFim, duracaoMinutos, vigenteDe, vigenteAte, ativo, expectedVersion);
    }
  }
  record BloqueioInput(@NotNull UUID medicoId, @NotNull LocalDateTime inicio,
      @NotNull LocalDateTime fim, boolean ativo) {
    SchedulingConfigurationService.BloqueioLocalCommand toCommand(long expectedVersion) {
      return new SchedulingConfigurationService.BloqueioLocalCommand(
          medicoId, inicio, fim, ativo, expectedVersion);
    }
  }
  record BloqueioUpdate(@NotNull UUID medicoId, @NotNull LocalDateTime inicio,
      @NotNull LocalDateTime fim, boolean ativo,
      @NotNull @PositiveOrZero Long expectedVersion) {
    SchedulingConfigurationService.BloqueioLocalCommand toCommand() {
      return new SchedulingConfigurationService.BloqueioLocalCommand(
          medicoId, inicio, fim, ativo, expectedVersion);
    }
  }

  private static <S, T> ConfigurationApi.PageResponse<T> page(Page<S> source,
      java.util.function.Function<S, T> mapper) {
    return new ConfigurationApi.PageResponse<>(source.getContent().stream().map(mapper).toList(),
        source.getNumber(), source.getSize(), source.getTotalElements());
  }
}
