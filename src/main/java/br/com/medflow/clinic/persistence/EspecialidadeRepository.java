package br.com.medflow.clinic.persistence;

import br.com.medflow.clinic.domain.Especialidade;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EspecialidadeRepository extends JpaRepository<Especialidade, UUID> {
  List<Especialidade> findByClinicaIdOrderByNome(UUID clinicaId);
  List<Especialidade> findByClinicaIdAndAtivoTrueOrderByNome(UUID clinicaId);
}
