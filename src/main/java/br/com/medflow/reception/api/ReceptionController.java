package br.com.medflow.reception.api;

import br.com.medflow.reception.application.ReceptionService;
import br.com.medflow.scheduling.domain.StatusAgendamento;
import br.com.medflow.security.AuthenticatedContextService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@PreAuthorize("hasRole('RECEPTIONIST')")
@Validated
public class ReceptionController {

  private final ReceptionService service;
  private final AuthenticatedContextService contexts;

  public ReceptionController(ReceptionService service, AuthenticatedContextService contexts) {
    this.service = service;
    this.contexts = contexts;
  }

  @GetMapping("/recepcao/agenda")
  ReceptionApi.PageResponse<ReceptionApi.AppointmentResponse> agenda(
      Authentication authentication,
      @RequestParam @NotNull LocalDate data,
      @RequestParam(required = false) UUID unidadeId,
      @RequestParam(required = false) UUID medicoId,
      @RequestParam(required = false) StatusAgendamento status,
      @RequestParam(defaultValue = "0") @PositiveOrZero int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return ReceptionApi.page(service.agenda(contexts.resolve(authentication), data,
        unidadeId, medicoId, status,
        PageRequest.of(page, size, Sort.by(Sort.Order.asc("inicio"), Sort.Order.asc("id")))));
  }

  @GetMapping("/recepcao/fila")
  ReceptionApi.PageResponse<ReceptionApi.AppointmentResponse> queue(
      Authentication authentication,
      @RequestParam(required = false) UUID unidadeId,
      @RequestParam(required = false) UUID medicoId,
      @RequestParam(defaultValue = "0") @PositiveOrZero int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return ReceptionApi.page(service.queue(contexts.resolve(authentication), unidadeId, medicoId,
        PageRequest.of(page, size, Sort.by(Sort.Order.asc("inicio"),
            Sort.Order.asc("checkInEm"), Sort.Order.asc("id")))));
  }

  @PostMapping("/agendamentos/{id}/check-in")
  ReceptionApi.AppointmentResponse checkIn(Authentication authentication, @PathVariable UUID id,
      @Valid @RequestBody VersionInput input) {
    return ReceptionApi.appointment(service.checkIn(
        contexts.resolve(authentication), id, input.expectedVersion()));
  }

  record VersionInput(@NotNull @PositiveOrZero Long expectedVersion) { }
}
