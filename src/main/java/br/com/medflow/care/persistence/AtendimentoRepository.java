package br.com.medflow.care.persistence;

import br.com.medflow.care.domain.Atendimento;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AtendimentoRepository extends JpaRepository<Atendimento, UUID> {

  boolean existsByIdAndAgendamentoMedicoId(UUID id, UUID medicoId);

  long countByAgendamentoId(UUID agendamentoId);

  Optional<Atendimento> findByAgendamentoId(UUID agendamentoId);

  @EntityGraph(attributePaths = {
      "agendamento", "agendamento.clinica", "agendamento.paciente", "agendamento.medico",
      "agendamento.especialidade", "agendamento.consultorio",
      "agendamento.consultorio.unidade"
  })
  Optional<Atendimento> findByIdAndAgendamentoMedicoId(UUID id, UUID medicoId);

  @Query("select a.agendamento.id from Atendimento a where a.id = :id and a.agendamento.medico.id = :medicoId")
  Optional<UUID> findAgendamentoIdEscopado(
      @Param("id") UUID id, @Param("medicoId") UUID medicoId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select a from Atendimento a where a.id = :id")
  Optional<Atendimento> findByIdForUpdate(@Param("id") UUID id);

  @EntityGraph(attributePaths = {
      "agendamento", "agendamento.clinica", "agendamento.paciente", "agendamento.medico",
      "agendamento.especialidade", "agendamento.consultorio",
      "agendamento.consultorio.unidade"
  })
  Page<Atendimento> findByAgendamentoMedicoIdAndAgendamentoPacienteIdAndFinalizadoEmIsNotNull(
      UUID medicoId, UUID pacienteId, Pageable pageable);
}
