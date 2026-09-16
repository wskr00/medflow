package br.com.medflow.audit.persistence;

import static br.com.medflow.audit.application.SpringAuditEventFactory.ACTOR_KIND;
import static br.com.medflow.audit.application.SpringAuditEventFactory.CLINIC_ID;
import static br.com.medflow.audit.application.SpringAuditEventFactory.REQUEST_ID;
import static br.com.medflow.audit.application.SpringAuditEventFactory.RESOURCE_ID;
import static br.com.medflow.audit.application.SpringAuditEventFactory.RESOURCE_TYPE;
import static br.com.medflow.audit.application.SpringAuditEventFactory.RESULT;

import br.com.medflow.audit.domain.AuditAction;
import br.com.medflow.audit.domain.AuditActorKind;
import br.com.medflow.audit.domain.AuditResourceType;
import br.com.medflow.audit.domain.AuditResult;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.boot.actuate.audit.AuditEvent;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Repository;

/** Adapter persistente do SPI do Actuator com allowlist estrita e sem dados livres. */
@Repository
public class PersistentSanitizedAuditEventRepository
    implements org.springframework.boot.actuate.audit.AuditEventRepository {

  private final AuditJpaRepository events;

  public PersistentSanitizedAuditEventRepository(AuditJpaRepository events) {
    this.events = events;
  }

  @Override
  public void add(AuditEvent event) {
    AuditAction action;
    try {
      action = AuditAction.valueOf(event.getType());
    } catch (IllegalArgumentException exception) {
      return; // Eventos genéricos do framework nunca carregam dados livres para o domínio.
    }
    Map<String, Object> data = event.getData();
    AuditActorKind actorKind = AuditActorKind.valueOf(required(data, ACTOR_KIND));
    AuditResult result = AuditResult.valueOf(required(data, RESULT));
    AuditResourceType resourceType = AuditResourceType.valueOf(required(data, RESOURCE_TYPE));
    UUID clinicId = optionalUuid(data, CLINIC_ID);
    UUID resourceId = optionalUuid(data, RESOURCE_ID);
    UUID requestId = UUID.fromString(required(data, REQUEST_ID));
    String subject = actorKind == AuditActorKind.ANONIMO ? null : event.getPrincipal();
    events.saveAndFlush(new br.com.medflow.audit.domain.AuditEvent(clinicId, actorKind, subject,
        action, result, resourceType, resourceId, event.getTimestamp(), requestId));
  }

  @Override
  public List<AuditEvent> find(String principal, Instant after, String type) {
    AuditAction action = null;
    if (type != null) {
      try {
        action = AuditAction.valueOf(type);
      } catch (IllegalArgumentException exception) {
        return List.of();
      }
    }
    Specification<br.com.medflow.audit.domain.AuditEvent> specification =
        (root, query, builder) -> builder.conjunction();
    if (principal != null) {
      specification = specification.and((root, query, builder) ->
          builder.equal(root.get("actorSubject"), principal));
    }
    if (after != null) {
      specification = specification.and((root, query, builder) ->
          builder.greaterThan(root.get("occurredAt"), after));
    }
    if (action != null) {
      AuditAction expected = action;
      specification = specification.and((root, query, builder) ->
          builder.equal(root.get("action"), expected));
    }
    return events.findAll(specification, Sort.by(Sort.Order.desc("occurredAt"), Sort.Order.asc("id")))
        .stream().map(this::springEvent).toList();
  }

  private AuditEvent springEvent(br.com.medflow.audit.domain.AuditEvent event) {
    Map<String, Object> data = new LinkedHashMap<>();
    data.put(ACTOR_KIND, event.actorKind().name());
    if (event.clinicaId() != null) data.put(CLINIC_ID, event.clinicaId().toString());
    data.put(RESULT, event.result().name());
    data.put(RESOURCE_TYPE, event.resourceType().name());
    if (event.resourceId() != null) data.put(RESOURCE_ID, event.resourceId().toString());
    data.put(REQUEST_ID, event.requestId().toString());
    return new AuditEvent(event.occurredAt(), event.actorSubject(), event.action().name(), data);
  }

  private static String required(Map<String, Object> data, String key) {
    Object value = data.get(key);
    if (!(value instanceof String text) || text.isBlank()) {
      throw new IllegalArgumentException("metadado de auditoria ausente");
    }
    return text;
  }

  private static UUID optionalUuid(Map<String, Object> data, String key) {
    Object value = data.get(key);
    if (value == null) return null;
    if (!(value instanceof String text)) {
      throw new IllegalArgumentException("metadado de auditoria inválido");
    }
    return UUID.fromString(text);
  }
}
