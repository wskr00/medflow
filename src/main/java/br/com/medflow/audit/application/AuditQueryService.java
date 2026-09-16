package br.com.medflow.audit.application;

import br.com.medflow.audit.domain.AuditAction;
import br.com.medflow.audit.domain.AuditActorKind;
import br.com.medflow.audit.domain.AuditResourceType;
import br.com.medflow.audit.domain.AuditResult;
import br.com.medflow.audit.persistence.AuditJpaRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditQueryService {

  private final AuditJpaRepository events;
  private final AuditSuccessWriter audit;

  public AuditQueryService(AuditJpaRepository events, AuditSuccessWriter audit) {
    this.events = events;
    this.audit = audit;
  }

  @Transactional
  public Page<AuditEventView> find(LocalDate from, LocalDate until, Pageable pageable) {
    if (from == null || until == null || until.isBefore(from)
        || until.isAfter(from.plusDays(30))) {
      throw new IllegalArgumentException("intervalo de auditoria inválido");
    }
    var clinic = events.findClinicScope()
        .orElseThrow(() -> new IllegalStateException("clínica única não configurada"));
    ZoneId zone = ZoneId.of(clinic.getTimeZone());
    Instant fromInclusive = from.atStartOfDay(zone).toInstant();
    Instant untilExclusive = until.plusDays(1).atStartOfDay(zone).toInstant();
    Page<AuditEventView> result = events
        .findByClinicaIdAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(
            clinic.getId(), fromInclusive, untilExclusive, pageable)
        .map(event -> new AuditEventView(event.id(), event.clinicaId(), event.actorKind(),
            event.actorSubject(), event.action(), event.result(), event.resourceType(),
            event.resourceId(), event.occurredAt(), event.requestId()));
    audit.record(clinic.getId(), AuditAction.CONSULTAR_AUDITORIA,
        AuditResourceType.AUDITORIA, null);
    return result;
  }

  public record AuditEventView(UUID id, UUID clinicaId, AuditActorKind actorKind,
      String actorSubject, AuditAction action, AuditResult result,
      AuditResourceType resourceType, UUID resourceId, Instant occurredAt, UUID requestId) { }
}
