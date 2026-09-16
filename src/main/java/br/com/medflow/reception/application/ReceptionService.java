package br.com.medflow.reception.application;

import br.com.medflow.audit.application.AuditSuccessWriter;
import br.com.medflow.audit.domain.AuditAction;
import br.com.medflow.audit.domain.AuditResourceType;
import br.com.medflow.clinic.domain.Clinica;
import br.com.medflow.clinic.persistence.ClinicaRepository;
import br.com.medflow.clinic.persistence.MedicoRepository;
import br.com.medflow.clinic.persistence.UnidadeRepository;
import br.com.medflow.common.auth.AuthenticatedActor;
import br.com.medflow.common.http.ResourceNotFoundException;
import br.com.medflow.scheduling.domain.Agendamento;
import br.com.medflow.scheduling.domain.StatusAgendamento;
import br.com.medflow.scheduling.persistence.AgendamentoRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Casos de uso operacionais da Recepção; fila é uma consulta derivada de Agendamento. */
@Service
public class ReceptionService {

  private final ClinicaRepository clinicas;
  private final UnidadeRepository unidades;
  private final MedicoRepository medicos;
  private final AgendamentoRepository agendamentos;
  private final Clock clock;
  private final AuditSuccessWriter audit;

  public ReceptionService(ClinicaRepository clinicas, UnidadeRepository unidades,
      MedicoRepository medicos, AgendamentoRepository agendamentos, Clock clock,
      AuditSuccessWriter audit) {
    this.clinicas = clinicas;
    this.unidades = unidades;
    this.medicos = medicos;
    this.agendamentos = agendamentos;
    this.clock = clock;
    this.audit = audit;
  }

  @Transactional(readOnly = true)
  public Page<OperationalAppointment> agenda(AuthenticatedActor actor, LocalDate data,
      UUID unidadeId, UUID medicoId, StatusAgendamento status, Pageable pageable) {
    requireReceptionist(actor);
    if (data == null) throw new IllegalArgumentException("data obrigatória");
    Clinica clinica = clinic(actor);
    validateFilters(clinica, unidadeId, medicoId);
    ZoneId zone = ZoneId.of(clinica.timeZone());
    Instant dayStart = data.atStartOfDay(zone).toInstant();
    Instant dayEnd = data.plusDays(1).atStartOfDay(zone).toInstant();
    Specification<Agendamento> specification = clinicSpecification(clinica.id())
        .and((root, query, builder) -> builder.greaterThanOrEqualTo(root.get("inicio"), dayStart))
        .and((root, query, builder) -> builder.lessThan(root.get("inicio"), dayEnd));
    specification = optionalFilters(specification, unidadeId, medicoId, status);
    return agendamentos.findAll(specification, pageable).map(this::view);
  }

  @Transactional(readOnly = true)
  public Page<OperationalAppointment> queue(AuthenticatedActor actor,
      UUID unidadeId, UUID medicoId, Pageable pageable) {
    requireReceptionist(actor);
    Clinica clinica = clinic(actor);
    validateFilters(clinica, unidadeId, medicoId);
    Specification<Agendamento> specification = clinicSpecification(clinica.id())
        .and((root, query, builder) -> builder.equal(
            root.get("status"), StatusAgendamento.EM_ESPERA));
    specification = optionalFilters(specification, unidadeId, medicoId, null);
    return agendamentos.findAll(specification, pageable).map(this::view);
  }

  @Transactional(isolation = Isolation.READ_COMMITTED)
  public OperationalAppointment checkIn(
      AuthenticatedActor actor, UUID id, long expectedVersion) {
    requireReceptionist(actor);
    if (!agendamentos.existsByIdAndClinicaId(id, actor.clinicaId())) {
      throw new ResourceNotFoundException();
    }
    Clinica clinica = clinicas.findSingletonForUpdate().orElseThrow(ResourceNotFoundException::new);
    if (!clinica.id().equals(actor.clinicaId())) throw new ResourceNotFoundException();
    Agendamento appointment = agendamentos.findById(id).orElseThrow(ResourceNotFoundException::new);
    if (!appointment.clinica().id().equals(clinica.id())) throw new ResourceNotFoundException();
    appointment.checkIn(clock.instant(), ZoneId.of(clinica.timeZone()), expectedVersion);
    agendamentos.flush();
    audit.record(clinica.id(), AuditAction.REALIZAR_CHECK_IN,
        AuditResourceType.AGENDAMENTO, appointment.id());
    return view(appointment);
  }

  private Specification<Agendamento> optionalFilters(Specification<Agendamento> specification,
      UUID unidadeId, UUID medicoId, StatusAgendamento status) {
    if (unidadeId != null) {
      specification = specification.and((root, query, builder) ->
          builder.equal(root.get("consultorio").get("unidade").get("id"), unidadeId));
    }
    if (medicoId != null) {
      specification = specification.and((root, query, builder) ->
          builder.equal(root.get("medico").get("id"), medicoId));
    }
    if (status != null) {
      specification = specification.and((root, query, builder) ->
          builder.equal(root.get("status"), status));
    }
    return specification;
  }

  private static Specification<Agendamento> clinicSpecification(UUID clinicId) {
    return (root, query, builder) -> builder.equal(root.get("clinica").get("id"), clinicId);
  }

  private void validateFilters(Clinica clinica, UUID unidadeId, UUID medicoId) {
    if (unidadeId != null) {
      var unit = unidades.findById(unidadeId).orElseThrow(ResourceNotFoundException::new);
      if (!unit.clinica().id().equals(clinica.id())) throw new ResourceNotFoundException();
    }
    if (medicoId != null) {
      var doctor = medicos.findById(medicoId).orElseThrow(ResourceNotFoundException::new);
      if (!doctor.clinica().id().equals(clinica.id())) throw new ResourceNotFoundException();
    }
  }

  private Clinica clinic(AuthenticatedActor actor) {
    return clinicas.findById(actor.clinicaId()).orElseThrow(ResourceNotFoundException::new);
  }

  private OperationalAppointment view(Agendamento value) {
    ZoneId zone = ZoneId.of(value.clinica().timeZone());
    LocalDate today = clock.instant().atZone(zone).toLocalDate();
    return new OperationalAppointment(value.id(), value.version(),
        value.inicio().atZone(zone).toOffsetDateTime(),
        value.fim().atZone(zone).toOffsetDateTime(), value.status(),
        value.checkInEm() == null ? null : value.checkInEm().atZone(zone).toOffsetDateTime(),
        new NamedResource(value.medico().id(), value.medico().nome()),
        new NamedResource(value.especialidade().id(), value.especialidade().nome()),
        new NamedResource(value.consultorio().unidade().id(), value.consultorio().unidade().nome()),
        new NamedResource(value.consultorio().id(), value.consultorio().nome()),
        new NamedResource(value.paciente().id(), value.paciente().nome()),
        value.status() == StatusAgendamento.EM_ESPERA
            && value.inicio().atZone(zone).toLocalDate().isBefore(today));
  }

  private static void requireReceptionist(AuthenticatedActor actor) {
    if (!actor.hasRole("RECEPTIONIST")) {
      throw new AccessDeniedException("Função de recepção necessária.");
    }
  }

  public record NamedResource(UUID id, String nome) { }

  public record OperationalAppointment(UUID id, long version, OffsetDateTime inicio,
      OffsetDateTime fim, StatusAgendamento status, OffsetDateTime checkInEm,
      NamedResource medico, NamedResource especialidade, NamedResource unidade,
      NamedResource consultorio, NamedResource paciente, boolean pendenteDeDiaAnterior) { }
}
