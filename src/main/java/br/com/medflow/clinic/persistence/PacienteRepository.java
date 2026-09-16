package br.com.medflow.clinic.persistence;

import br.com.medflow.clinic.domain.Paciente;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PacienteRepository extends JpaRepository<Paciente, UUID> {
  Optional<Paciente> findBySubject(String subject);
}
