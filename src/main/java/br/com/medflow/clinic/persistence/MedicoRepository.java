package br.com.medflow.clinic.persistence;

import br.com.medflow.clinic.domain.Medico;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MedicoRepository extends JpaRepository<Medico, UUID> {
  @EntityGraph(attributePaths = "especialidades")
  Page<Medico> findByClinicaId(UUID clinicaId, Pageable pageable);
  @EntityGraph(attributePaths = "especialidades")
  Page<Medico> findByClinicaIdAndAtivoTrue(UUID clinicaId, Pageable pageable);
  Optional<Medico> findBySubject(String subject);
  Optional<Medico> findBySubjectAndAtivoTrue(String subject);
}
