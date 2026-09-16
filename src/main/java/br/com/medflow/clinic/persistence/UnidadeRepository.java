package br.com.medflow.clinic.persistence;

import br.com.medflow.clinic.domain.Unidade;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UnidadeRepository extends JpaRepository<Unidade, UUID> {
  List<Unidade> findByClinicaIdOrderByNome(UUID clinicaId);
  List<Unidade> findByClinicaIdAndAtivoTrueOrderByNome(UUID clinicaId);
}
