package br.com.medflow.scheduling.api;

import br.com.medflow.common.auth.AuthenticatedActor;
import br.com.medflow.scheduling.application.AppointmentService;
import br.com.medflow.scheduling.application.PatientAppointmentSection;
import br.com.medflow.scheduling.domain.StatusAgendamento;
import br.com.medflow.reception.api.ReceptionApi;
import br.com.medflow.reception.application.ReceptionService;
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
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
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
  private final ReceptionService reception;
  private final AuthenticatedContextService contexts;

  public AppointmentController(AppointmentService service, ReceptionService reception,
      AuthenticatedContextService contexts) {
    this.service = service;
    this.reception = reception;
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
  @Operation(summary = "Lista os próprios agendamentos", description = "`q` aceita somente os aliases "
      + "status, inicio, medicoId, especialidadeId e unidadeId. O recorte temporal e a ordem "
      + "são definidos pelo servidor no fuso da clínica.")
  SchedulingApi.PageResponse<SchedulingApi.PatientAppointmentResponse> proprios(
      Authentication authentication,
      @RequestParam(defaultValue = "0") @PositiveOrZero int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
      @Parameter(description = "Filtro RSQL com os aliases documentados.")
      @RequestParam(required = false) String q,
      @RequestParam(required = false) PatientAppointmentSection recorte,
      @RequestParam(required = false) StatusAgendamento status,
      @RequestParam(required = false) LocalDate dataDe,
      @RequestParam(required = false) LocalDate dataAte) {
    Sort.Direction direction = recorte == PatientAppointmentSection.UPCOMING
        ? Sort.Direction.ASC : Sort.Direction.DESC;
    return SchedulingApi.patientPage(service.proprios(actor(authentication), recorte, q, status, dataDe,
        dataAte, PageRequest.of(page, size, Sort.by(new Sort.Order(direction, "inicio"),
            new Sort.Order(Sort.Direction.ASC, "id")))));
  }

  @GetMapping("/agendamentos/{id}")
  @PreAuthorize("hasAnyRole('PATIENT','RECEPTIONIST')")
  @Operation(summary = "Consulta um agendamento",
      description = "Recepção recebe a projeção operacional completa, com paciente, ações "
          + "recalculadas e indicação de pendência; a projeção do Paciente é restrita.")
  Object obter(Authentication authentication, @PathVariable UUID id) {
    AuthenticatedActor actor = actor(authentication);
    return response(actor, id, service.obter(actor, id));
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
  @Operation(summary = "Reagenda um agendamento",
      description = "Revalida autorização, versão, estado AGENDADA e horário futuro. A resposta "
          + "da Recepção usa a projeção operacional atualizada.")
  Object reagendar(Authentication authentication, @PathVariable UUID id,
      @Valid @RequestBody RescheduleInput input) {
    AuthenticatedActor actor = actor(authentication);
    var result = service.reagendar(actor, id, input.regraAgendaId(), input.inicio(),
        input.expectedVersion());
    return response(actor, id, result);
  }

  @PostMapping("/agendamentos/{id}/cancelamento")
  @PreAuthorize("hasAnyRole('PATIENT','RECEPTIONIST')")
  @Operation(summary = "Cancela um agendamento",
      description = "Revalida autorização, versão, estado AGENDADA e horário futuro. A resposta "
          + "da Recepção usa a projeção operacional atualizada.")
  Object cancelar(Authentication authentication, @PathVariable UUID id,
      @Valid @RequestBody VersionInput input) {
    AuthenticatedActor actor = actor(authentication);
    return response(actor, id, service.cancelar(actor, id, input.expectedVersion()));
  }

  private AuthenticatedActor actor(Authentication authentication) {
    return contexts.resolve(authentication);
  }

  private Object response(AuthenticatedActor actor, UUID id, AppointmentService.AppointmentView value) {
    return actor.hasRole("RECEPTIONIST")
        ? ReceptionApi.appointment(reception.obter(actor, id)) : SchedulingApi.patient(value);
  }

  record CreateInput(@NotNull UUID regraAgendaId, @NotNull OffsetDateTime inicio) { }
  record RescheduleInput(@NotNull UUID regraAgendaId, @NotNull OffsetDateTime inicio,
      @NotNull @PositiveOrZero Long expectedVersion) { }
  record VersionInput(@NotNull @PositiveOrZero Long expectedVersion) { }
}
