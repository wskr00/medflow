package br.com.medflow.audit.persistence;

import br.com.medflow.audit.domain.AuditAction;
import br.com.medflow.audit.domain.AuditEvent;
import br.com.medflow.audit.domain.AuditResult;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

/** Persistência interna, separada do SPI homônimo do Spring Boot Actuator. */
public interface AuditJpaRepository
    extends JpaRepository<AuditEvent, UUID>, JpaSpecificationExecutor<AuditEvent> {

  long countByActionAndResult(AuditAction action, AuditResult result);

  Page<AuditEvent> findByClinicaIdAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(
      UUID clinicaId, Instant fromInclusive, Instant untilExclusive, Pageable pageable);

  @Query(value = "select id, time_zone as \"timeZone\" from clinica where singleton = true",
      nativeQuery = true)
  Optional<ClinicScope> findClinicScope();

  interface ClinicScope {
    UUID getId();
    String getTimeZone();
  }
}
