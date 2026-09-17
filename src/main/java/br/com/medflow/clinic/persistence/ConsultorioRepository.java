package br.com.medflow.clinic.persistence;

import br.com.medflow.clinic.domain.Consultorio;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ConsultorioRepository extends JpaRepository<Consultorio, UUID>,
    JpaSpecificationExecutor<Consultorio> {
  @Override
  @EntityGraph(attributePaths = "unidade")
  Page<Consultorio> findAll(Specification<Consultorio> specification, Pageable pageable);
  @Override
  @EntityGraph(attributePaths = "unidade")
  Optional<Consultorio> findById(UUID id);
  Page<Consultorio> findByUnidadeClinicaId(UUID clinicaId, Pageable pageable);
  Page<Consultorio> findByUnidadeClinicaIdAndAtivoTrue(UUID clinicaId, Pageable pageable);
}
