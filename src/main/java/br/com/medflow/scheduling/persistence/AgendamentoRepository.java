package br.com.medflow.scheduling.persistence;

import br.com.medflow.scheduling.domain.Agendamento;
import br.com.medflow.scheduling.domain.StatusAgendamento;
import java.time.Instant;
import java.util.Collection;
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
      select a from Agendamento a
      where a.clinica.id = :clinicaId
        and a.status <> br.com.medflow.scheduling.domain.StatusAgendamento.CANCELADA
        and (a.medico.id = :medicoId or a.consultorio.id = :consultorioId)
        and a.inicio < :fim and :inicio < a.fim
      """)
  List<Agendamento> findOcupacoesDoMedicoOuConsultorio(
      @Param("clinicaId") UUID clinicaId,
      @Param("medicoId") UUID medicoId,
      @Param("consultorioId") UUID consultorioId,
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

  @Query("""
      select a from Agendamento a
      where a.clinica.id = :clinicaId
        and a.medico.id = :medicoId
        and a.especialidade.id = :especialidadeId
        and a.consultorio.id = :consultorioId
        and a.status <> br.com.medflow.scheduling.domain.StatusAgendamento.CANCELADA
        and a.inicio > :agora
      """)
  List<Agendamento> findReservasFuturasDaConfiguracao(
      @Param("clinicaId") UUID clinicaId,
      @Param("medicoId") UUID medicoId,
      @Param("especialidadeId") UUID especialidadeId,
      @Param("consultorioId") UUID consultorioId,
      @Param("agora") Instant agora);

  @Query("""
      select case when count(a) > 0 then true else false end
      from Agendamento a
      where a.clinica.id = :clinicaId
        and a.medico.id = :medicoId
        and a.status <> br.com.medflow.scheduling.domain.StatusAgendamento.CANCELADA
        and a.inicio > :agora
        and a.inicio < :fim and :inicio < a.fim
      """)
  boolean existeReservaFuturaDoMedicoNoIntervalo(
      @Param("clinicaId") UUID clinicaId,
      @Param("medicoId") UUID medicoId,
      @Param("agora") Instant agora,
      @Param("inicio") Instant inicio,
      @Param("fim") Instant fim);

  @Query("""
      select case when count(a) > 0 then true else false end from Agendamento a
      where a.clinica.id = :id
        and a.status <> br.com.medflow.scheduling.domain.StatusAgendamento.CANCELADA
        and a.inicio > :agora
      """)
  boolean existsFutureActiveByClinic(@Param("id") UUID id, @Param("agora") Instant agora);

  @Query("""
      select case when count(a) > 0 then true else false end from Agendamento a
      where a.consultorio.unidade.id = :id
        and a.status <> br.com.medflow.scheduling.domain.StatusAgendamento.CANCELADA
        and a.inicio > :agora
      """)
  boolean existsFutureActiveByUnit(@Param("id") UUID id, @Param("agora") Instant agora);

  @Query("""
      select case when count(a) > 0 then true else false end from Agendamento a
      where a.consultorio.id = :id
        and a.status <> br.com.medflow.scheduling.domain.StatusAgendamento.CANCELADA
        and a.inicio > :agora
      """)
  boolean existsFutureActiveByRoom(@Param("id") UUID id, @Param("agora") Instant agora);

  @Query("""
      select case when count(a) > 0 then true else false end from Agendamento a
      where a.especialidade.id = :id
        and a.status <> br.com.medflow.scheduling.domain.StatusAgendamento.CANCELADA
        and a.inicio > :agora
      """)
  boolean existsFutureActiveBySpecialty(@Param("id") UUID id, @Param("agora") Instant agora);

  @Query("""
      select case when count(a) > 0 then true else false end from Agendamento a
      where a.medico.id = :id
        and a.status <> br.com.medflow.scheduling.domain.StatusAgendamento.CANCELADA
        and a.inicio > :agora
      """)
  boolean existsFutureActiveByDoctor(@Param("id") UUID id, @Param("agora") Instant agora);

  @Query("""
      select case when count(a) > 0 then true else false end from Agendamento a
      where a.medico.id = :medicoId and a.especialidade.id in :especialidadeIds
        and a.status <> br.com.medflow.scheduling.domain.StatusAgendamento.CANCELADA
        and a.inicio > :agora
      """)
  boolean existsFutureActiveByDoctorAndSpecialties(
      @Param("medicoId") UUID medicoId,
      @Param("especialidadeIds") Collection<UUID> especialidadeIds,
      @Param("agora") Instant agora);
}
