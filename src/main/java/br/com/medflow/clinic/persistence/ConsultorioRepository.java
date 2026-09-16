package br.com.medflow.clinic.persistence;

import br.com.medflow.clinic.domain.Consultorio;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsultorioRepository extends JpaRepository<Consultorio, UUID> {
  List<Consultorio> findByUnidadeClinicaIdOrderByNome(UUID clinicaId);
  List<Consultorio> findByUnidadeClinicaIdAndAtivoTrueOrderByNome(UUID clinicaId);
}
