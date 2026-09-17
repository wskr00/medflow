package br.com.medflow.scheduling.persistence;

import br.com.medflow.scheduling.domain.BloqueioAgenda;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BloqueioAgendaRepository extends JpaRepository<BloqueioAgenda, UUID>,
    JpaSpecificationExecutor<BloqueioAgenda> {
  @Override
  @EntityGraph(attributePaths = {"clinica", "medico"})
  Optional<BloqueioAgenda> findById(UUID id);
  @Override
  @EntityGraph(attributePaths = {"clinica", "medico"})
  Page<BloqueioAgenda> findAll(Specification<BloqueioAgenda> specification, Pageable pageable);
  Page<BloqueioAgenda> findByClinicaIdAndAtivoTrue(UUID clinicaId, Pageable pageable);
  Page<BloqueioAgenda> findByClinicaId(UUID clinicaId, Pageable pageable);

  @Query("""
      select b from BloqueioAgenda b
      where b.clinica.id = :clinicaId and b.ativo = true
        and b.inicio < :fim and :inicio < b.fim
      """)
  List<BloqueioAgenda> findAtivosNoIntervalo(
      @Param("clinicaId") UUID clinicaId,
      @Param("inicio") Instant inicio,
      @Param("fim") Instant fim);
}
