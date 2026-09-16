package br.com.medflow.clinic.persistence;

import br.com.medflow.clinic.domain.Medico;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MedicoRepository extends JpaRepository<Medico, UUID> {
  List<Medico> findByClinicaIdOrderByNome(UUID clinicaId);
  List<Medico> findByClinicaIdAndAtivoTrueOrderByNome(UUID clinicaId);
  Optional<Medico> findBySubject(String subject);
}
