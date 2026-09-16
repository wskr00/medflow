package br.com.medflow.audit.api;

import br.com.medflow.audit.application.AuditQueryService;
import br.com.medflow.audit.domain.AuditAction;
import br.com.medflow.audit.domain.AuditActorKind;
import br.com.medflow.audit.domain.AuditResourceType;
import br.com.medflow.audit.domain.AuditResult;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;

final class AuditApi {

  private AuditApi() {
  }

  static PageResponse<EventResponse> page(Page<AuditQueryService.AuditEventView> source) {
    return new PageResponse<>(source.getContent().stream().map(AuditApi::event).toList(),
        source.getNumber(), source.getSize(), source.getTotalElements());
  }

  private static EventResponse event(AuditQueryService.AuditEventView value) {
    return new EventResponse(value.id(), value.clinicaId(), value.actorKind(),
        value.actorSubject(), value.action(), value.result(), value.resourceType(),
        value.resourceId(), value.occurredAt(), value.requestId());
  }

  record EventResponse(UUID id, UUID clinicaId, AuditActorKind actorKind,
      String actorSubject, AuditAction action, AuditResult result,
      AuditResourceType resourceType, UUID resourceId, Instant occurredAt, UUID requestId) { }

  record PageResponse<T>(List<T> items, int page, int size, long totalElements) { }
}
