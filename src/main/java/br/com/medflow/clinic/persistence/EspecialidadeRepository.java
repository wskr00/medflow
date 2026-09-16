package br.com.medflow.clinic.persistence;

import br.com.medflow.clinic.domain.Especialidade;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface EspecialidadeRepository extends JpaRepository<Especialidade, UUID>, JpaSpecificationExecutor<Especialidade> {
  Page<Especialidade> findByClinicaId(UUID clinicaId, Pageable pageable);
  Page<Especialidade> findByClinicaIdAndAtivoTrue(UUID clinicaId, Pageable pageable);
}
