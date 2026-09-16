package br.com.medflow.audit.api;

import br.com.medflow.audit.application.AuditQueryService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.LocalDate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auditoria")
@PreAuthorize("hasRole('ADMINISTRATOR')")
@Validated
public class AuditController {

  private final AuditQueryService service;

  public AuditController(AuditQueryService service) {
    this.service = service;
  }

  @GetMapping
  AuditApi.PageResponse<AuditApi.EventResponse> find(
      @RequestParam @NotNull LocalDate dataDe,
      @RequestParam @NotNull LocalDate dataAte,
      @RequestParam(defaultValue = "0") @PositiveOrZero int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return AuditApi.page(service.find(dataDe, dataAte,
        PageRequest.of(page, size, Sort.by(
            Sort.Order.desc("occurredAt"), Sort.Order.asc("id")))));
  }
}
