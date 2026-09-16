package br.com.medflow.audit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Registro append-only pela API, deliberadamente sem conteúdo de negócio ou clínico. */
@Entity
@Table(name = "audit_event")
public class AuditEvent {

  @Id
  private UUID id;

  @Column(name = "clinica_id")
  private UUID clinicaId;

  @Enumerated(EnumType.STRING)
  @Column(name = "actor_kind", nullable = false, length = 20)
  private AuditActorKind actorKind;

  @Column(name = "actor_subject", length = 255)
  private String actorSubject;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 80)
  private AuditAction action;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private AuditResult result;

  @Enumerated(EnumType.STRING)
  @Column(name = "resource_type", nullable = false, length = 40)
  private AuditResourceType resourceType;

  @Column(name = "resource_id")
  private UUID resourceId;

  @Column(name = "occurred_at", nullable = false)
  private Instant occurredAt;

  @Column(name = "request_id", nullable = false)
  private UUID requestId;

  protected AuditEvent() {
  }

  public AuditEvent(UUID clinicaId, AuditActorKind actorKind, String actorSubject,
      AuditAction action, AuditResult result, AuditResourceType resourceType,
      UUID resourceId, Instant occurredAt, UUID requestId) {
    this.id = UUID.randomUUID();
    this.clinicaId = clinicaId;
    this.actorKind = Objects.requireNonNull(actorKind, "actorKind");
    this.actorSubject = normalizedSubject(actorKind, actorSubject);
    this.action = Objects.requireNonNull(action, "action");
    this.result = Objects.requireNonNull(result, "result");
    this.resourceType = Objects.requireNonNull(resourceType, "resourceType");
    this.resourceId = resourceId;
    this.occurredAt = Objects.requireNonNull(occurredAt, "occurredAt");
    this.requestId = Objects.requireNonNull(requestId, "requestId");
  }

  public UUID id() { return id; }
  public UUID clinicaId() { return clinicaId; }
  public AuditActorKind actorKind() { return actorKind; }
  public String actorSubject() { return actorSubject; }
  public AuditAction action() { return action; }
  public AuditResult result() { return result; }
  public AuditResourceType resourceType() { return resourceType; }
  public UUID resourceId() { return resourceId; }
  public Instant occurredAt() { return occurredAt; }
  public UUID requestId() { return requestId; }

  private static String normalizedSubject(AuditActorKind kind, String subject) {
    if (kind == AuditActorKind.ANONIMO) return null;
    String normalized = Objects.requireNonNull(subject, "actorSubject").trim();
    if (normalized.isEmpty() || normalized.length() > 255) {
      throw new IllegalArgumentException("actorSubject inválido");
    }
    return normalized;
  }
}
