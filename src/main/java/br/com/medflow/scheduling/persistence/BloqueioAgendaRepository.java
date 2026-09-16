package br.com.medflow.scheduling.persistence;

import br.com.medflow.scheduling.domain.BloqueioAgenda;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BloqueioAgendaRepository extends JpaRepository<BloqueioAgenda, UUID> {
  List<BloqueioAgenda> findByClinicaIdAndAtivoTrue(UUID clinicaId);
  List<BloqueioAgenda> findByClinicaIdOrderByInicioDesc(UUID clinicaId);
}
