package br.com.medflow.clinic.persistence;

import br.com.medflow.clinic.domain.Unidade;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface UnidadeRepository extends JpaRepository<Unidade, UUID>, JpaSpecificationExecutor<Unidade> {
  Page<Unidade> findByClinicaId(UUID clinicaId, Pageable pageable);
  Page<Unidade> findByClinicaIdAndAtivoTrue(UUID clinicaId, Pageable pageable);
}
