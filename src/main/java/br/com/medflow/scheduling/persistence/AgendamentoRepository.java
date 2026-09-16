package br.com.medflow.scheduling.persistence;

import br.com.medflow.scheduling.domain.Agendamento;
import br.com.medflow.scheduling.domain.StatusAgendamento;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AgendamentoRepository
    extends JpaRepository<Agendamento, UUID>, JpaSpecificationExecutor<Agendamento> {

  boolean existsByIdAndPacienteId(UUID id, UUID pacienteId);

  boolean existsByIdAndClinicaId(UUID id, UUID clinicaId);

  @Query("""
      select a from Agendamento a
      where a.clinica.id = :clinicaId
        and a.status <> br.com.medflow.scheduling.domain.StatusAgendamento.CANCELADA
        and a.inicio < :fim and :inicio < a.fim
      """)
  List<Agendamento> findOcupacoes(
      @Param("clinicaId") UUID clinicaId,
      @Param("inicio") Instant inicio,
      @Param("fim") Instant fim);

  @Query("""
      select case when count(a) > 0 then true else false end
      from Agendamento a
      where a.clinica.id = :clinicaId
        and a.status <> br.com.medflow.scheduling.domain.StatusAgendamento.CANCELADA
        and (:ignorado is null or a.id <> :ignorado)
        and (a.medico.id = :medicoId or a.consultorio.id = :consultorioId)
        and a.inicio < :fim and :inicio < a.fim
      """)
  boolean existeConflito(
      @Param("clinicaId") UUID clinicaId,
      @Param("medicoId") UUID medicoId,
      @Param("consultorioId") UUID consultorioId,
      @Param("inicio") Instant inicio,
      @Param("fim") Instant fim,
      @Param("ignorado") UUID ignorado);

  long countByStatus(StatusAgendamento status);
}
