package br.com.medflow.audit.application;

import br.com.medflow.audit.domain.AuditAction;
import br.com.medflow.audit.domain.AuditResourceType;
import br.com.medflow.audit.domain.AuditResult;
import java.time.Clock;
import java.util.UUID;
import org.springframework.boot.actuate.audit.AuditEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Persiste sucesso na mesma transação funcional; nunca abre transação própria. */
@Service
public class AuditSuccessWriter {

  private final AuditEventRepository events;
  private final AuditRequestContext context;
  private final Clock clock;

  public AuditSuccessWriter(AuditEventRepository events, AuditRequestContext context, Clock clock) {
    this.events = events;
    this.context = context;
    this.clock = clock;
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void record(UUID clinicId, AuditAction action,
      AuditResourceType resourceType, UUID resourceId) {
    AuditRequestContext.Context current = context.current();
    events.add(SpringAuditEventFactory.create(clock.instant(), current, clinicId,
        action, AuditResult.SUCESSO, resourceType, resourceId));
  }
}
