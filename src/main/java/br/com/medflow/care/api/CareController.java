package br.com.medflow.care.api;

import br.com.medflow.care.application.CareService;
import br.com.medflow.care.domain.RegistroClinico;
import br.com.medflow.scheduling.domain.StatusAgendamento;
import br.com.medflow.security.AuthenticatedContextService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.time.LocalDate;
import java.util.UUID;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Validated
public class CareController {

  private final CareService service;
  private final AuthenticatedContextService contexts;

  public CareController(CareService service, AuthenticatedContextService contexts) {
    this.service = service;
    this.contexts = contexts;
  }

  @GetMapping("/medico/agenda")
  @PreAuthorize("hasRole('DOCTOR')")
  @Operation(summary = "Agenda operacional do médico",
      description = "Retorna atendimentoId opcional e ações de iniciar ou retomar calculadas no servidor.")
  CareApi.PageResponse<CareApi.AppointmentResponse> agenda(
      Authentication authentication,
      @RequestParam @NotNull LocalDate data,
      @RequestParam(required = false) StatusAgendamento status,
      @RequestParam(defaultValue = "0") @PositiveOrZero int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return CareApi.appointmentPage(service.agenda(contexts.resolve(authentication), data, status,
        PageRequest.of(page, size, Sort.by(Sort.Order.asc("inicio"), Sort.Order.asc("id")))));
  }

  @GetMapping("/medico/fila")
  @PreAuthorize("hasRole('DOCTOR')")
  @Operation(summary = "Fila operacional do médico",
      description = "Retorna somente consultas EM_ESPERA com ação de início calculada no servidor.")
  CareApi.PageResponse<CareApi.AppointmentResponse> queue(
      Authentication authentication,
      @RequestParam(defaultValue = "0") @PositiveOrZero int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return CareApi.appointmentPage(service.queue(contexts.resolve(authentication),
        PageRequest.of(page, size, Sort.by(Sort.Order.asc("inicio"),
            Sort.Order.asc("checkInEm"), Sort.Order.asc("id")))));
  }

  @PostMapping("/agendamentos/{id}/atendimento")
  @PreAuthorize("hasRole('DOCTOR')")
  @Operation(summary = "Inicia atendimento", description = "Retorna o workspace clínico autorizado para retomada segura.")
  ResponseEntity<CareApi.WorkspaceResponse> start(Authentication authentication,
      @PathVariable UUID id, @Valid @RequestBody VersionInput input) {
    var response = CareApi.workspace(service.start(
        contexts.resolve(authentication), id, input.expectedVersion()));
    return ResponseEntity.created(URI.create("/api/atendimentos/" + response.atendimento().id()))
        .body(response);
  }

  @GetMapping("/atendimentos/{id}")
  @PreAuthorize("hasRole('DOCTOR')")
  @Operation(summary = "Retoma atendimento", description = "Retorna o workspace clínico autorizado, inclusive contexto operacional e versões.")
  CareApi.WorkspaceResponse get(Authentication authentication, @PathVariable UUID id) {
    return CareApi.workspace(service.get(contexts.resolve(authentication), id));
  }

  @PutMapping("/atendimentos/{id}/registro-clinico")
  @PreAuthorize("hasRole('DOCTOR')")
  @Operation(summary = "Salva rascunho clínico", description = "Retorna o workspace com a versão persistida; não implica autosave nem timestamp adicional.")
  CareApi.WorkspaceResponse saveDraft(Authentication authentication, @PathVariable UUID id,
      @Valid @RequestBody ClinicalRecordInput input) {
    return CareApi.workspace(service.saveDraft(contexts.resolve(authentication), id,
        input.expectedVersion(), input.queixaPrincipal(), input.resumoAnamnese(),
        input.conduta(), input.observacoes()));
  }

  @PostMapping("/atendimentos/{id}/finalizacao")
  @PreAuthorize("hasRole('DOCTOR')")
  @Operation(summary = "Finaliza atendimento", description = "Retorna o workspace finalizado, somente leitura para novos salvamentos.")
  CareApi.WorkspaceResponse finish(Authentication authentication, @PathVariable UUID id,
      @Valid @RequestBody VersionInput input) {
    return CareApi.workspace(service.finish(
        contexts.resolve(authentication), id, input.expectedVersion()));
  }

  @GetMapping("/me/historico")
  @PreAuthorize("hasRole('PATIENT')")
  CareApi.PageResponse<CareApi.PatientHistoryResponse> patientHistory(
      Authentication authentication,
      @RequestParam(defaultValue = "0") @PositiveOrZero int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return CareApi.patientHistoryPage(service.patientHistory(contexts.resolve(authentication),
        PageRequest.of(page, size, Sort.by(Sort.Order.desc("inicio"), Sort.Order.asc("id")))));
  }

  @GetMapping("/medico/pacientes/{id}/historico")
  @PreAuthorize("hasRole('DOCTOR')")
  @Operation(summary = "Histórico clínico permitido", description = "Retorna somente atendimentos finalizados do médico autenticado, em workspace contextual.")
  CareApi.PageResponse<CareApi.WorkspaceResponse> doctorHistory(
      Authentication authentication, @PathVariable UUID id,
      @RequestParam(defaultValue = "0") @PositiveOrZero int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return CareApi.workspacePage(service.doctorHistory(contexts.resolve(authentication), id,
        PageRequest.of(page, size, Sort.by(Sort.Order.desc("agendamento.inicio"),
            Sort.Order.asc("id")))));
  }

  record VersionInput(@NotNull @PositiveOrZero Long expectedVersion) { }

  record ClinicalRecordInput(@NotNull @PositiveOrZero Long expectedVersion,
      @Size(max = RegistroClinico.QUEIXA_MAX) String queixaPrincipal,
      @Size(max = RegistroClinico.RESUMO_MAX) String resumoAnamnese,
      @Size(max = RegistroClinico.CONDUTA_MAX) String conduta,
      @Size(max = RegistroClinico.OBSERVACOES_MAX) String observacoes) { }
}
