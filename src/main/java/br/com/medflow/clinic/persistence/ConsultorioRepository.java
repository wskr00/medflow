package br.com.medflow.clinic.persistence;

import br.com.medflow.clinic.domain.Consultorio;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsultorioRepository extends JpaRepository<Consultorio, UUID> {
  Page<Consultorio> findByUnidadeClinicaId(UUID clinicaId, Pageable pageable);
  Page<Consultorio> findByUnidadeClinicaIdAndAtivoTrue(UUID clinicaId, Pageable pageable);
}
