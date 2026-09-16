package br.com.medflow.scheduling.persistence;

import br.com.medflow.scheduling.domain.RegraAgenda;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RegraAgendaRepository extends JpaRepository<RegraAgenda, UUID> {
  Page<RegraAgenda> findByClinicaIdAndAtivoTrue(UUID clinicaId, Pageable pageable);
  Page<RegraAgenda> findByClinicaId(UUID clinicaId, Pageable pageable);
}
