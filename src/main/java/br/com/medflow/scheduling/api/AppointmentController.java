package br.com.medflow.scheduling.api;

import br.com.medflow.common.auth.AuthenticatedActor;
import br.com.medflow.scheduling.application.AppointmentService;
import br.com.medflow.scheduling.domain.StatusAgendamento;
import br.com.medflow.security.AuthenticatedContextService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.net.URI;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
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
@Validated
public class AppointmentController {

  private final AppointmentService service;
  private final AuthenticatedContextService contexts;

  public AppointmentController(AppointmentService service, AuthenticatedContextService contexts) {
    this.service = service;
    this.contexts = contexts;
  }

  @GetMapping("/disponibilidades")
  @PreAuthorize("hasAnyRole('PATIENT','ADMINISTRATOR')")
  SchedulingApi.AvailabilityResponse disponibilidade(Authentication authentication,
      @RequestParam @NotNull LocalDate data,
      @RequestParam @NotNull UUID unidadeId,
      @RequestParam @NotNull UUID especialidadeId,
      @RequestParam(required = false) UUID medicoId) {
    return SchedulingApi.availability(service.disponibilidade(
        actor(authentication), data, unidadeId, especialidadeId, medicoId));
  }

  @PostMapping("/agendamentos")
  @PreAuthorize("hasRole('PATIENT')")
  ResponseEntity<SchedulingApi.PatientAppointmentResponse> criar(Authentication authentication,
      @Valid @RequestBody CreateInput input) {
    var result = SchedulingApi.patient(service.criar(
        actor(authentication), input.regraAgendaId(), input.inicio()));
    return ResponseEntity.created(URI.create("/api/agendamentos/" + result.id())).body(result);
  }

  @GetMapping("/me/agendamentos")
  @PreAuthorize("hasRole('PATIENT')")
  SchedulingApi.PageResponse<SchedulingApi.PatientAppointmentResponse> proprios(
      Authentication authentication,
      @RequestParam(defaultValue = "0") @PositiveOrZero int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
      @RequestParam(required = false) StatusAgendamento status,
      @RequestParam(required = false) LocalDate dataDe,
      @RequestParam(required = false) LocalDate dataAte) {
    return SchedulingApi.patientPage(service.proprios(actor(authentication), status, dataDe, dataAte,
        PageRequest.of(page, size, Sort.by(Sort.Order.desc("inicio"), Sort.Order.asc("id")))));
  }

  @GetMapping("/agendamentos/{id}")
  @PreAuthorize("hasAnyRole('PATIENT','RECEPTIONIST')")
  Object obter(Authentication authentication, @PathVariable UUID id) {
    AuthenticatedActor actor = actor(authentication);
    return response(actor, service.obter(actor, id));
  }

  @GetMapping("/agendamentos/{id}/disponibilidades")
  @PreAuthorize("hasAnyRole('PATIENT','RECEPTIONIST')")
  SchedulingApi.AvailabilityResponse disponibilidadeReagendamento(
      Authentication authentication, @PathVariable UUID id, @RequestParam @NotNull LocalDate data) {
    return SchedulingApi.availability(
        service.disponibilidadeReagendamento(actor(authentication), id, data));
  }

  @PostMapping("/agendamentos/{id}/reagendamento")
  @PreAuthorize("hasAnyRole('PATIENT','RECEPTIONIST')")
  Object reagendar(Authentication authentication, @PathVariable UUID id,
      @Valid @RequestBody RescheduleInput input) {
    AuthenticatedActor actor = actor(authentication);
    return response(actor, service.reagendar(actor, id, input.regraAgendaId(),
        input.inicio(), input.expectedVersion()));
  }

  @PostMapping("/agendamentos/{id}/cancelamento")
  @PreAuthorize("hasAnyRole('PATIENT','RECEPTIONIST')")
  Object cancelar(Authentication authentication, @PathVariable UUID id,
      @Valid @RequestBody VersionInput input) {
    AuthenticatedActor actor = actor(authentication);
    return response(actor, service.cancelar(actor, id, input.expectedVersion()));
  }

  private AuthenticatedActor actor(Authentication authentication) {
    return contexts.resolve(authentication);
  }

  private static Object response(AuthenticatedActor actor, AppointmentService.AppointmentView value) {
    return actor.hasRole("RECEPTIONIST")
        ? SchedulingApi.reception(value) : SchedulingApi.patient(value);
  }

  record CreateInput(@NotNull UUID regraAgendaId, @NotNull OffsetDateTime inicio) { }
  record RescheduleInput(@NotNull UUID regraAgendaId, @NotNull OffsetDateTime inicio,
      @NotNull @PositiveOrZero Long expectedVersion) { }
  record VersionInput(@NotNull @PositiveOrZero Long expectedVersion) { }
}
