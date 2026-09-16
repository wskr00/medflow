package br.com.medflow.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import br.com.medflow.audit.domain.AuditAction;
import br.com.medflow.audit.domain.AuditActorKind;
import br.com.medflow.audit.domain.AuditEvent;
import br.com.medflow.audit.domain.AuditResult;
import br.com.medflow.audit.persistence.AuditJpaRepository;
import br.com.medflow.audit.persistence.PersistentSanitizedAuditEventRepository;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class PersistentSanitizedAuditEventRepositoryTests {

  @Test
  void discardsFrameworkEventsAndPersistsOnlyTheMedflowAllowlist() {
    AuditJpaRepository jpa = mock(AuditJpaRepository.class);
    var repository = new PersistentSanitizedAuditEventRepository(jpa);
    String sensitive = "exception-message-authorization-details";

    repository.add(new org.springframework.boot.actuate.audit.AuditEvent(
        Instant.parse("2026-09-16T12:00:00Z"), "principal",
        "AUTHENTICATION_FAILURE", Map.of("details", sensitive, "message", sensitive)));
    verify(jpa, never()).saveAndFlush(org.mockito.ArgumentMatchers.any());

    UUID clinicId = UUID.randomUUID();
    UUID resourceId = UUID.randomUUID();
    UUID requestId = UUID.randomUUID();
    repository.add(new org.springframework.boot.actuate.audit.AuditEvent(
        Instant.parse("2026-09-16T12:00:00Z"), "safe-subject", AuditAction.CANCELAR.name(),
        Map.of("actorKind", "AUTENTICADO", "clinicId", clinicId.toString(),
            "result", "CONFLITO", "resourceType", "AGENDAMENTO",
            "resourceId", resourceId.toString(), "requestId", requestId.toString(),
            "details", sensitive, "message", sensitive)));

    ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
    verify(jpa).saveAndFlush(captor.capture());
    AuditEvent persisted = captor.getValue();
    assertThat(persisted.actorKind()).isEqualTo(AuditActorKind.AUTENTICADO);
    assertThat(persisted.actorSubject()).isEqualTo("safe-subject");
    assertThat(persisted.clinicaId()).isEqualTo(clinicId);
    assertThat(persisted.action()).isEqualTo(AuditAction.CANCELAR);
    assertThat(persisted.result()).isEqualTo(AuditResult.CONFLITO);
    assertThat(persisted.resourceId()).isEqualTo(resourceId);
    assertThat(persisted.requestId()).isEqualTo(requestId);
    assertThat(persisted.toString()).doesNotContain(sensitive);
  }
}
