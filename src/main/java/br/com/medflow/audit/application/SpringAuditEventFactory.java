package br.com.medflow.audit.application;

import br.com.medflow.audit.domain.AuditAction;
import br.com.medflow.audit.domain.AuditResourceType;
import br.com.medflow.audit.domain.AuditResult;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.boot.actuate.audit.AuditEvent;

public final class SpringAuditEventFactory {

  public static final String ACTOR_KIND = "actorKind";
  public static final String CLINIC_ID = "clinicId";
  public static final String RESULT = "result";
  public static final String RESOURCE_TYPE = "resourceType";
  public static final String RESOURCE_ID = "resourceId";
  public static final String REQUEST_ID = "requestId";

  private SpringAuditEventFactory() {
  }

  static AuditEvent create(Instant timestamp, AuditRequestContext.Context actor,
      UUID clinicId, AuditAction action, AuditResult result,
      AuditResourceType resourceType, UUID resourceId) {
    Map<String, Object> data = new LinkedHashMap<>();
    data.put(ACTOR_KIND, actor.actorKind().name());
    if (clinicId != null) data.put(CLINIC_ID, clinicId.toString());
    data.put(RESULT, result.name());
    data.put(RESOURCE_TYPE, resourceType.name());
    if (resourceId != null) data.put(RESOURCE_ID, resourceId.toString());
    data.put(REQUEST_ID, actor.requestId().toString());
    return new AuditEvent(timestamp, actor.actorSubject(), action.name(), data);
  }
}
