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

/** Transação independente usada somente depois que a operação funcional falhou. */
@Service
public class AuditFailureRecorder {

  private final AuditEventRepository events;
  private final Clock clock;

  public AuditFailureRecorder(AuditEventRepository events, Clock clock) {
    this.events = events;
    this.clock = clock;
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void record(UUID clinicId, AuditRequestContext.Context actor,
      AuditAction action, AuditResult result,
      AuditResourceType resourceType, UUID resourceId) {
    if (result == AuditResult.SUCESSO) throw new IllegalArgumentException("resultado inválido");
    events.add(SpringAuditEventFactory.create(clock.instant(), actor, clinicId,
        action, result, resourceType, resourceId));
  }
}
