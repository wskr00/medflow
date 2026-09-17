package br.com.medflow.scheduling.persistence;

import br.com.medflow.scheduling.domain.RegraAgenda;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.domain.Specification;

public interface RegraAgendaRepository extends JpaRepository<RegraAgenda, UUID>,
    JpaSpecificationExecutor<RegraAgenda> {
  @Override
  @EntityGraph(attributePaths = {"clinica", "medico", "especialidade", "consultorio",
      "consultorio.unidade"})
  Optional<RegraAgenda> findById(UUID id);
  @Override
  @EntityGraph(attributePaths = {"clinica", "medico", "especialidade", "consultorio",
      "consultorio.unidade"})
  Page<RegraAgenda> findAll(Specification<RegraAgenda> specification, Pageable pageable);
  Page<RegraAgenda> findByClinicaIdAndAtivoTrue(UUID clinicaId, Pageable pageable);
  Page<RegraAgenda> findByClinicaId(UUID clinicaId, Pageable pageable);
}
