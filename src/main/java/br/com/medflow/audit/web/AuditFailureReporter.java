package br.com.medflow.audit.web;

import br.com.medflow.audit.application.AuditFailureRecorder;
import br.com.medflow.audit.application.AuditRequestContext;
import br.com.medflow.audit.domain.AuditActorKind;
import br.com.medflow.audit.domain.AuditResult;
import br.com.medflow.audit.persistence.AuditJpaRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Mantém a resposta original quando a persistência independente estiver indisponível. */
@Component
public class AuditFailureReporter {

  private static final Logger log = LoggerFactory.getLogger(AuditFailureReporter.class);
  private static final String RECORDED_ATTRIBUTE =
      AuditFailureReporter.class.getName() + ".recorded";
  private final AuditFailureRecorder recorder;
  private final AuditRequestContext context;
  private final AuditJpaRepository events;

  public AuditFailureReporter(AuditFailureRecorder recorder,
      AuditRequestContext context, AuditJpaRepository events) {
    this.recorder = recorder;
    this.context = context;
    this.events = events;
  }

  public void record(HttpServletRequest request, AuditResult result) {
    AuditIntent intent = AuditIntentFilter.intent(request);
    if (intent == null || request.getAttribute(RECORDED_ATTRIBUTE) != null) return;
    request.setAttribute(RECORDED_ATTRIBUTE, Boolean.TRUE);
    try {
      AuditRequestContext.Context actor = context.current();
      UUID clinicId = actor.actorKind() == AuditActorKind.AUTENTICADO
          ? events.findClinicScope().map(AuditJpaRepository.ClinicScope::getId).orElse(null)
          : null;
      recorder.record(clinicId, actor, intent.action(), result,
          intent.resourceType(), intent.resourceId());
    } catch (RuntimeException exception) {
      log.error("Falha ao persistir auditoria requestId={} tipo={}",
          org.slf4j.MDC.get("requestId"),
          exception.getClass().getSimpleName());
    }
  }
}
