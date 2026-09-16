package br.com.medflow.clinic.persistence;

import br.com.medflow.clinic.domain.Especialidade;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EspecialidadeRepository extends JpaRepository<Especialidade, UUID> {
  Page<Especialidade> findByClinicaId(UUID clinicaId, Pageable pageable);
  Page<Especialidade> findByClinicaIdAndAtivoTrue(UUID clinicaId, Pageable pageable);
}
