package br.com.medflow.scheduling.persistence;

import br.com.medflow.scheduling.domain.RegraAgenda;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RegraAgendaRepository extends JpaRepository<RegraAgenda, UUID> {
  List<RegraAgenda> findByClinicaIdAndAtivoTrue(UUID clinicaId);
  List<RegraAgenda> findByClinicaIdOrderByVigenteDeDesc(UUID clinicaId);
}
