package br.com.medflow.audit.web;

import br.com.medflow.audit.domain.AuditAction;
import br.com.medflow.audit.domain.AuditResourceType;
import java.util.UUID;

public record AuditIntent(AuditAction action, AuditResourceType resourceType, UUID resourceId) { }
