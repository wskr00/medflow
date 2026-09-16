package br.com.medflow.care.application;

import br.com.medflow.care.domain.Atendimento;
import br.com.medflow.care.domain.RegistroClinico;
import br.com.medflow.care.persistence.AtendimentoRepository;
import br.com.medflow.clinic.domain.Clinica;
import br.com.medflow.clinic.domain.Medico;
import br.com.medflow.clinic.persistence.ClinicaRepository;
import br.com.medflow.clinic.persistence.MedicoRepository;
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

/** Casos de uso médicos e históricos autorizados do atendimento clínico mínimo. */
@Service
public class CareService {

  private final ClinicaRepository clinicas;
  private final MedicoRepository medicos;
  private final AgendamentoRepository agendamentos;
  private final AtendimentoRepository atendimentos;
  private final Clock clock;

  public CareService(ClinicaRepository clinicas, MedicoRepository medicos,
      AgendamentoRepository agendamentos, AtendimentoRepository atendimentos, Clock clock) {
    this.clinicas = clinicas;
    this.medicos = medicos;
    this.agendamentos = agendamentos;
    this.atendimentos = atendimentos;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public Page<OperationalAppointment> agenda(AuthenticatedActor actor, LocalDate data,
      StatusAgendamento status, Pageable pageable) {
    requireDoctor(actor);
    if (data == null) throw new IllegalArgumentException("data obrigatória");
    Clinica clinic = clinic(actor);
    activeDoctor(actor, clinic);
    ZoneId zone = ZoneId.of(clinic.timeZone());
    Instant start = data.atStartOfDay(zone).toInstant();
    Instant end = data.plusDays(1).atStartOfDay(zone).toInstant();
    Specification<Agendamento> specification = doctorSpecification(actor.medicoId())
        .and((root, query, builder) -> builder.greaterThanOrEqualTo(root.get("inicio"), start))
        .and((root, query, builder) -> builder.lessThan(root.get("inicio"), end));
    if (status != null) {
      specification = specification.and((root, query, builder) ->
          builder.equal(root.get("status"), status));
    }
    return agendamentos.findAll(specification, pageable).map(this::appointmentView);
  }

  @Transactional(readOnly = true)
  public Page<OperationalAppointment> queue(AuthenticatedActor actor, Pageable pageable) {
    requireDoctor(actor);
    Clinica clinic = clinic(actor);
    activeDoctor(actor, clinic);
    Specification<Agendamento> specification = doctorSpecification(actor.medicoId())
        .and((root, query, builder) ->
            builder.equal(root.get("status"), StatusAgendamento.EM_ESPERA));
    return agendamentos.findAll(specification, pageable).map(this::appointmentView);
  }

  @Transactional(isolation = Isolation.READ_COMMITTED)
  public StartResult start(AuthenticatedActor actor, UUID appointmentId, long expectedVersion) {
    requireDoctor(actor);
    activeDoctor(actor, clinic(actor));
    if (!agendamentos.existsByIdAndMedicoId(appointmentId, actor.medicoId())) {
      throw new ResourceNotFoundException();
    }
    Clinica clinic = lockClinic(actor);
    activeDoctor(actor, clinic);
    Agendamento appointment = agendamentos.findByIdForUpdate(appointmentId)
        .orElseThrow(ResourceNotFoundException::new);
    assertAssigned(actor, clinic, appointment);
    appointment.iniciarAtendimento(expectedVersion);
    Atendimento care = atendimentos.save(new Atendimento(appointment, clock.instant()));
    atendimentos.flush();
    return new StartResult(appointmentView(appointment), careView(care));
  }

  @Transactional(readOnly = true)
  public CareView get(AuthenticatedActor actor, UUID id) {
    requireDoctor(actor);
    activeDoctor(actor, clinic(actor));
    Atendimento care = atendimentos.findByIdAndAgendamentoMedicoId(id, actor.medicoId())
        .orElseThrow(ResourceNotFoundException::new);
    return careView(care);
  }

  @Transactional(isolation = Isolation.READ_COMMITTED)
  public CareView saveDraft(AuthenticatedActor actor, UUID id, long expectedVersion,
      String complaint, String history, String plan, String notes) {
    requireDoctor(actor);
    activeDoctor(actor, clinic(actor));
    if (!atendimentos.existsByIdAndAgendamentoMedicoId(id, actor.medicoId())) {
      throw new ResourceNotFoundException();
    }
    Atendimento care = atendimentos.findByIdForUpdate(id)
        .orElseThrow(ResourceNotFoundException::new);
    if (!care.agendamento().medico().id().equals(actor.medicoId())) {
      throw new ResourceNotFoundException();
    }
    care.salvarRegistro(new RegistroClinico(complaint, history, plan, notes), expectedVersion);
    atendimentos.flush();
    return careView(care, ZoneId.of(actor.timeZone()));
  }

  @Transactional(isolation = Isolation.READ_COMMITTED)
  public FinishResult finish(AuthenticatedActor actor, UUID id, long expectedVersion) {
    requireDoctor(actor);
    activeDoctor(actor, clinic(actor));
    UUID appointmentId = atendimentos.findAgendamentoIdEscopado(id, actor.medicoId())
        .orElseThrow(ResourceNotFoundException::new);
    Clinica clinic = lockClinic(actor);
    activeDoctor(actor, clinic);
    Agendamento appointment = agendamentos.findByIdForUpdate(appointmentId)
        .orElseThrow(ResourceNotFoundException::new);
    assertAssigned(actor, clinic, appointment);
    Atendimento care = atendimentos.findByIdForUpdate(id)
        .orElseThrow(ResourceNotFoundException::new);
    if (!care.agendamento().id().equals(appointment.id())) throw new ResourceNotFoundException();
    care.finalizar(clock.instant(), expectedVersion);
    appointment.finalizarAtendimento();
    atendimentos.flush();
    return new FinishResult(appointmentView(appointment), careView(care));
  }

  @Transactional(readOnly = true)
  public Page<PatientHistoryItem> patientHistory(
      AuthenticatedActor actor, Pageable pageable) {
    requirePatient(actor);
    Specification<Agendamento> specification = (root, query, builder) -> builder.and(
        builder.equal(root.get("paciente").get("id"), actor.pacienteId()),
        builder.equal(root.get("status"), StatusAgendamento.FINALIZADA));
    return agendamentos.findAll(specification, pageable).map(this::patientHistoryView);
  }

  @Transactional(readOnly = true)
  public Page<DoctorHistoryItem> doctorHistory(
      AuthenticatedActor actor, UUID patientId, Pageable pageable) {
    requireDoctor(actor);
    activeDoctor(actor, clinic(actor));
    return atendimentos
        .findByAgendamentoMedicoIdAndAgendamentoPacienteIdAndFinalizadoEmIsNotNull(
            actor.medicoId(), patientId, pageable)
        .map(this::doctorHistoryView);
  }

  private static Specification<Agendamento> doctorSpecification(UUID doctorId) {
    return (root, query, builder) -> builder.equal(root.get("medico").get("id"), doctorId);
  }

  private OperationalAppointment appointmentView(Agendamento value) {
    ZoneId zone = ZoneId.of(value.clinica().timeZone());
    return new OperationalAppointment(value.id(), value.version(),
        value.inicio().atZone(zone).toOffsetDateTime(),
        value.fim().atZone(zone).toOffsetDateTime(), value.status(),
        value.checkInEm() == null ? null : value.checkInEm().atZone(zone).toOffsetDateTime(),
        named(value.medico().id(), value.medico().nome()),
        named(value.especialidade().id(), value.especialidade().nome()),
        named(value.consultorio().unidade().id(), value.consultorio().unidade().nome()),
        named(value.consultorio().id(), value.consultorio().nome()),
        named(value.paciente().id(), value.paciente().nome()));
  }

  private CareView careView(Atendimento value) {
    return careView(value, ZoneId.of(value.agendamento().clinica().timeZone()));
  }

  private CareView careView(Atendimento value, ZoneId zone) {
    RegistroClinico record = value.registroClinico();
    return new CareView(value.id(), value.agendamento().id(), value.version(),
        value.iniciadoEm().atZone(zone).toOffsetDateTime(),
        value.finalizadoEm() == null ? null : value.finalizadoEm().atZone(zone).toOffsetDateTime(),
        new ClinicalRecord(record.queixaPrincipal(), record.resumoAnamnese(),
            record.conduta(), record.observacoes()));
  }

  private PatientHistoryItem patientHistoryView(Agendamento value) {
    OperationalAppointment view = appointmentView(value);
    return new PatientHistoryItem(view.id(), view.inicio(), view.fim(), view.status(),
        view.medico(), view.especialidade(), view.unidade(), view.consultorio());
  }

  private DoctorHistoryItem doctorHistoryView(Atendimento value) {
    OperationalAppointment appointment = appointmentView(value.agendamento());
    CareView care = careView(value);
    return new DoctorHistoryItem(care.id(), appointment.id(), appointment.inicio(), appointment.fim(),
        care.iniciadoEm(), care.finalizadoEm(), appointment.paciente(), appointment.especialidade(),
        appointment.unidade(), appointment.consultorio(), care.registroClinico());
  }

  private static NamedResource named(UUID id, String name) {
    return new NamedResource(id, name);
  }

  private Clinica clinic(AuthenticatedActor actor) {
    return clinicas.findById(actor.clinicaId()).orElseThrow(ResourceNotFoundException::new);
  }

  private Clinica lockClinic(AuthenticatedActor actor) {
    Clinica clinic = clinicas.findSingletonForUpdate().orElseThrow(ResourceNotFoundException::new);
    if (!clinic.id().equals(actor.clinicaId())) throw new ResourceNotFoundException();
    return clinic;
  }

  private Medico activeDoctor(AuthenticatedActor actor, Clinica clinic) {
    Medico doctor = medicos.findById(actor.medicoId())
        .orElseThrow(() -> new AccessDeniedException("Vínculo médico ativo necessário."));
    if (!doctor.ativo() || !doctor.clinica().id().equals(clinic.id())) {
      throw new AccessDeniedException("Vínculo médico ativo necessário.");
    }
    return doctor;
  }

  private static void assertAssigned(
      AuthenticatedActor actor, Clinica clinic, Agendamento appointment) {
    if (!appointment.clinica().id().equals(clinic.id())
        || !appointment.medico().id().equals(actor.medicoId())) {
      throw new ResourceNotFoundException();
    }
  }

  private static void requireDoctor(AuthenticatedActor actor) {
    if (!actor.hasRole("DOCTOR") || actor.medicoId() == null) {
      throw new AccessDeniedException("Vínculo médico ativo necessário.");
    }
  }

  private static void requirePatient(AuthenticatedActor actor) {
    if (!actor.hasRole("PATIENT") || actor.pacienteId() == null) {
      throw new AccessDeniedException("Vínculo de paciente necessário.");
    }
  }

  public record NamedResource(UUID id, String nome) { }

  public record OperationalAppointment(UUID id, long version, OffsetDateTime inicio,
      OffsetDateTime fim, StatusAgendamento status, OffsetDateTime checkInEm,
      NamedResource medico, NamedResource especialidade, NamedResource unidade,
      NamedResource consultorio, NamedResource paciente) { }

  public record ClinicalRecord(String queixaPrincipal, String resumoAnamnese,
      String conduta, String observacoes) { }

  public record CareView(UUID id, UUID agendamentoId, long version,
      OffsetDateTime iniciadoEm, OffsetDateTime finalizadoEm, ClinicalRecord registroClinico) { }

  public record StartResult(OperationalAppointment agendamento, CareView atendimento) { }

  public record FinishResult(OperationalAppointment agendamento, CareView atendimento) { }

  public record PatientHistoryItem(UUID id, OffsetDateTime inicio, OffsetDateTime fim,
      StatusAgendamento status, NamedResource medico, NamedResource especialidade,
      NamedResource unidade, NamedResource consultorio) { }

  public record DoctorHistoryItem(UUID atendimentoId, UUID agendamentoId,
      OffsetDateTime inicio, OffsetDateTime fim, OffsetDateTime iniciadoEm,
      OffsetDateTime finalizadoEm, NamedResource paciente, NamedResource especialidade,
      NamedResource unidade, NamedResource consultorio, ClinicalRecord registroClinico) { }
}
