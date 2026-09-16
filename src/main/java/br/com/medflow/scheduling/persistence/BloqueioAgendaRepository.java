package br.com.medflow.scheduling.persistence;

import br.com.medflow.scheduling.domain.BloqueioAgenda;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BloqueioAgendaRepository extends JpaRepository<BloqueioAgenda, UUID> {
  Page<BloqueioAgenda> findByClinicaIdAndAtivoTrue(UUID clinicaId, Pageable pageable);
  Page<BloqueioAgenda> findByClinicaId(UUID clinicaId, Pageable pageable);
}
