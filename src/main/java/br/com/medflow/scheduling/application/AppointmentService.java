package br.com.medflow.scheduling.application;

import br.com.medflow.clinic.domain.Clinica;
import br.com.medflow.clinic.domain.Consultorio;
import br.com.medflow.clinic.domain.Medico;
import br.com.medflow.clinic.persistence.ClinicaRepository;
import br.com.medflow.clinic.persistence.PacienteRepository;
import br.com.medflow.common.auth.AuthenticatedActor;
import br.com.medflow.common.http.BusinessConflictException;
import br.com.medflow.common.http.ResourceNotFoundException;
import br.com.medflow.scheduling.domain.Agendamento;
import br.com.medflow.scheduling.domain.BloqueioAgenda;
import br.com.medflow.scheduling.domain.RegraAgenda;
import br.com.medflow.scheduling.domain.StatusAgendamento;
import br.com.medflow.scheduling.persistence.AgendamentoRepository;
import br.com.medflow.scheduling.persistence.BloqueioAgendaRepository;
import br.com.medflow.scheduling.persistence.RegraAgendaRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Casos de uso de disponibilidade e reserva, com Clínica como lock transacional único. */
@Service
public class AppointmentService {

  private final ClinicaRepository clinicas;
  private final PacienteRepository pacientes;
  private final RegraAgendaRepository regras;
  private final BloqueioAgendaRepository bloqueios;
  private final AgendamentoRepository agendamentos;
  private final Clock clock;

  public AppointmentService(ClinicaRepository clinicas, PacienteRepository pacientes,
      RegraAgendaRepository regras, BloqueioAgendaRepository bloqueios,
      AgendamentoRepository agendamentos, Clock clock) {
    this.clinicas = clinicas;
    this.pacientes = pacientes;
    this.regras = regras;
    this.bloqueios = bloqueios;
    this.agendamentos = agendamentos;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public Availability disponibilidade(AuthenticatedActor actor, LocalDate data,
      UUID unidadeId, UUID especialidadeId, UUID medicoId) {
    requireAvailabilityRole(actor);
    if (data == null || unidadeId == null || especialidadeId == null) {
      throw new IllegalArgumentException("filtros de disponibilidade obrigatórios");
    }
    Clinica clinica = clinicaDoAtor(actor);
    return calcularDisponibilidade(clinica, data, unidadeId, especialidadeId, medicoId, null);
  }

  @Transactional(readOnly = true)
  public Availability disponibilidadeReagendamento(AuthenticatedActor actor, UUID id, LocalDate data) {
    requireAppointmentOperator(actor);
    Agendamento atual = agendamentoAutorizado(actor, id);
    return calcularDisponibilidade(atual.clinica(), data, atual.consultorio().unidade().id(),
        atual.especialidade().id(), atual.medico().id(), atual.id());
  }

  @Transactional(isolation = Isolation.READ_COMMITTED)
  public AppointmentView criar(AuthenticatedActor actor, UUID regraAgendaId, OffsetDateTime inicio) {
    requirePatient(actor);
    Clinica clinica = lockClinicaDoAtor(actor);
    var paciente = pacientes.findById(actor.pacienteId()).orElseThrow(ResourceNotFoundException::new);
    if (!paciente.clinica().id().equals(clinica.id())) throw new ResourceNotFoundException();
    Oferta oferta = validarOferta(clinica, regraAgendaId, inicio, null);
    Agendamento agendamento = new Agendamento(clinica, paciente, oferta.regra().medico(),
        oferta.regra().especialidade(), oferta.regra().consultorio(), oferta.inicio(), oferta.fim());
    return view(agendamentos.saveAndFlush(agendamento));
  }

  @Transactional(readOnly = true)
  public Page<AppointmentView> proprios(AuthenticatedActor actor, StatusAgendamento status,
      LocalDate dataDe, LocalDate dataAte, Pageable pageable) {
    requirePatient(actor);
    if (dataDe != null && dataAte != null && dataAte.isBefore(dataDe)) {
      throw new IllegalArgumentException("intervalo de datas inválido");
    }
    ZoneId zone = ZoneId.of(actor.timeZone());
    Instant inicio = dataDe == null ? null : dataDe.atStartOfDay(zone).toInstant();
    Instant fim = dataAte == null ? null : dataAte.plusDays(1).atStartOfDay(zone).toInstant();
    Specification<Agendamento> specification = (root, query, builder) ->
        builder.equal(root.get("paciente").get("id"), actor.pacienteId());
    if (status != null) {
      specification = specification.and((root, query, builder) ->
          builder.equal(root.get("status"), status));
    }
    if (inicio != null) {
      specification = specification.and((root, query, builder) ->
          builder.greaterThanOrEqualTo(root.get("inicio"), inicio));
    }
    if (fim != null) {
      specification = specification.and((root, query, builder) ->
          builder.lessThan(root.get("inicio"), fim));
    }
    return agendamentos.findAll(specification, pageable).map(this::view);
  }

  @Transactional(readOnly = true)
  public AppointmentView obter(AuthenticatedActor actor, UUID id) {
    requireAppointmentOperator(actor);
    return view(agendamentoAutorizado(actor, id));
  }

  @Transactional(isolation = Isolation.READ_COMMITTED)
  public AppointmentView cancelar(AuthenticatedActor actor, UUID id, long expectedVersion) {
    requireAppointmentOperator(actor);
    assertScopedExistence(actor, id);
    Clinica clinica = lockClinicaDoAtor(actor);
    Agendamento agendamento = agendamentoAutorizadoDepoisDoLock(actor, id, clinica);
    agendamento.cancelar(clock.instant(), expectedVersion);
    agendamentos.flush();
    return view(agendamento);
  }

  @Transactional(isolation = Isolation.READ_COMMITTED)
  public AppointmentView reagendar(AuthenticatedActor actor, UUID id, UUID regraAgendaId,
      OffsetDateTime inicio, long expectedVersion) {
    requireAppointmentOperator(actor);
    assertScopedExistence(actor, id);
    Clinica clinica = lockClinicaDoAtor(actor);
    Agendamento atual = agendamentoAutorizadoDepoisDoLock(actor, id, clinica);
    atual.validarMutacao(clock.instant(), expectedVersion);
    Oferta destino = validarOferta(clinica, regraAgendaId, inicio, atual.id());
    if (!destino.regra().medico().id().equals(atual.medico().id())
        || !destino.regra().especialidade().id().equals(atual.especialidade().id())
        || !destino.regra().consultorio().unidade().id().equals(atual.consultorio().unidade().id())) {
      throw unavailable();
    }
    if (atual.atual(destino.regra().consultorio(), destino.inicio(), destino.fim())) {
      return view(atual);
    }
    atual.reagendar(destino.regra().consultorio(), destino.inicio(), destino.fim(),
        clock.instant(), expectedVersion);
    agendamentos.flush();
    return view(atual);
  }

  private Availability calcularDisponibilidade(Clinica clinica, LocalDate data,
      UUID unidadeId, UUID especialidadeId, UUID medicoId, UUID agendamentoIgnorado) {
    ZoneId zone = ZoneId.of(clinica.timeZone());
    Instant diaInicio = data.atStartOfDay(zone).toInstant();
    Instant diaFim = data.plusDays(1).atStartOfDay(zone).toInstant();
    Instant agora = clock.instant();
    List<BloqueioAgenda> bloqueiosDoDia = bloqueios.findAtivosNoIntervalo(clinica.id(), diaInicio, diaFim);
    List<Agendamento> ocupacoes = agendamentos.findOcupacoes(clinica.id(), diaInicio, diaFim);

    List<Slot> slots = regras.findByClinicaIdAndAtivoTrue(clinica.id(), Pageable.unpaged()).stream()
        .filter(regra -> regraDisponivel(regra, data, unidadeId, especialidadeId, medicoId))
        .flatMap(regra -> slotsDaRegra(regra, data, zone).stream())
        .filter(slot -> slot.inicio().isAfter(agora))
        .filter(slot -> bloqueiosDoDia.stream().noneMatch(bloqueio ->
            bloqueio.medico().id().equals(slot.medicoId())
                && sobrepoe(slot.inicio(), slot.fim(), bloqueio.inicio(), bloqueio.fim())))
        .filter(slot -> ocupacoes.stream()
            .filter(ocupacao -> !ocupacao.id().equals(agendamentoIgnorado))
            .noneMatch(ocupacao -> conflito(slot, ocupacao)))
        .sorted(Comparator.comparing(Slot::inicio)
            .thenComparing(Slot::medicoId).thenComparing(Slot::consultorioId))
        .toList();
    return new Availability(slots, clinica.timeZone());
  }

  private Oferta validarOferta(Clinica clinica, UUID regraId, OffsetDateTime inicioComOffset,
      UUID agendamentoIgnorado) {
    if (regraId == null || inicioComOffset == null) throw new IllegalArgumentException("oferta inválida");
    RegraAgenda regra = regras.findById(regraId).orElseThrow(AppointmentService::unavailable);
    Instant inicio = inicioComOffset.toInstant();
    ZoneId zone = ZoneId.of(clinica.timeZone());
    LocalDate data = inicio.atZone(zone).toLocalDate();
    if (!regra.clinica().id().equals(clinica.id()) || !regraDisponivel(regra, data,
        regra.consultorio().unidade().id(), regra.especialidade().id(), regra.medico().id())) {
      throw unavailable();
    }
    Instant fim = inicio.plus(regra.duracaoMinutos(), ChronoUnit.MINUTES);
    ZonedDateTime local = inicio.atZone(zone);
    long minutosDesdeInicio = ChronoUnit.MINUTES.between(regra.horaInicio(), local.toLocalTime());
    if (!inicio.isAfter(clock.instant()) || !local.toLocalDate().equals(data)
        || local.getSecond() != 0 || local.getNano() != 0 || minutosDesdeInicio < 0
        || minutosDesdeInicio % regra.duracaoMinutos() != 0
        || local.toLocalTime().plusMinutes(regra.duracaoMinutos()).isAfter(regra.horaFim())) {
      throw unavailable();
    }
    boolean bloqueado = bloqueios.findAtivosNoIntervalo(clinica.id(), inicio, fim).stream()
        .anyMatch(bloqueio -> bloqueio.medico().id().equals(regra.medico().id()));
    boolean ocupado = agendamentos.existeConflito(clinica.id(), regra.medico().id(),
        regra.consultorio().id(), inicio, fim, agendamentoIgnorado);
    if (bloqueado || ocupado) throw unavailable();
    return new Oferta(regra, inicio, fim);
  }

  private boolean regraDisponivel(RegraAgenda regra, LocalDate data, UUID unidadeId,
      UUID especialidadeId, UUID medicoId) {
    Medico medico = regra.medico();
    Consultorio consultorio = regra.consultorio();
    return regra.ativo() && regra.clinica().ativo() && medico.ativo()
        && regra.especialidade().ativo() && consultorio.ativo() && consultorio.unidade().ativo()
        && medico.possuiEspecialidade(regra.especialidade())
        && regra.vigenteEm(data) && regra.diaSemana() == data.getDayOfWeek()
        && consultorio.unidade().id().equals(unidadeId)
        && regra.especialidade().id().equals(especialidadeId)
        && (medicoId == null || medico.id().equals(medicoId));
  }

  private List<Slot> slotsDaRegra(RegraAgenda regra, LocalDate data, ZoneId zone) {
    var result = new java.util.ArrayList<Slot>();
    for (LocalTime cursor = regra.horaInicio();
         !cursor.plusMinutes(regra.duracaoMinutos()).isAfter(regra.horaFim());
         cursor = cursor.plusMinutes(regra.duracaoMinutos())) {
      Instant inicio = LocalDateTime.of(data, cursor).atZone(zone).toInstant();
      Instant fim = inicio.plus(regra.duracaoMinutos(), ChronoUnit.MINUTES);
      result.add(slot(regra, inicio, fim));
    }
    return result;
  }

  private static boolean conflito(Slot slot, Agendamento agendamento) {
    return (agendamento.medico().id().equals(slot.medicoId())
        || agendamento.consultorio().id().equals(slot.consultorioId()))
        && sobrepoe(slot.inicio(), slot.fim(), agendamento.inicio(), agendamento.fim());
  }

  private static boolean sobrepoe(Instant inicioA, Instant fimA, Instant inicioB, Instant fimB) {
    return inicioA.isBefore(fimB) && inicioB.isBefore(fimA);
  }

  private Slot slot(RegraAgenda regra, Instant inicio, Instant fim) {
    ZoneId zone = ZoneId.of(regra.clinica().timeZone());
    return new Slot(regra.id(), regra.medico().id(), regra.especialidade().id(),
        regra.consultorio().id(), inicio, fim,
        new NamedResource(regra.medico().id(), regra.medico().nome()),
        new NamedResource(regra.especialidade().id(), regra.especialidade().nome()),
        new NamedResource(regra.consultorio().unidade().id(), regra.consultorio().unidade().nome()),
        new NamedResource(regra.consultorio().id(), regra.consultorio().nome()), zone);
  }

  private AppointmentView view(Agendamento value) {
    ZoneId zone = ZoneId.of(value.clinica().timeZone());
    return new AppointmentView(value.id(), value.version(), value.inicio().atZone(zone).toOffsetDateTime(),
        value.fim().atZone(zone).toOffsetDateTime(), value.status(),
        value.checkInEm() == null ? null : value.checkInEm().atZone(zone).toOffsetDateTime(),
        new NamedResource(value.medico().id(), value.medico().nome()),
        new NamedResource(value.especialidade().id(), value.especialidade().nome()),
        new NamedResource(value.consultorio().unidade().id(), value.consultorio().unidade().nome()),
        new NamedResource(value.consultorio().id(), value.consultorio().nome()),
        new NamedResource(value.paciente().id(), value.paciente().nome()));
  }

  private Agendamento agendamentoAutorizado(AuthenticatedActor actor, UUID id) {
    assertScopedExistence(actor, id);
    return agendamentos.findById(id).orElseThrow(ResourceNotFoundException::new);
  }

  private Agendamento agendamentoAutorizadoDepoisDoLock(
      AuthenticatedActor actor, UUID id, Clinica clinica) {
    Agendamento value = agendamentos.findById(id).orElseThrow(ResourceNotFoundException::new);
    boolean authorized = actor.hasRole("RECEPTIONIST")
        ? value.clinica().id().equals(clinica.id())
        : value.paciente().id().equals(actor.pacienteId());
    if (!authorized) throw new ResourceNotFoundException();
    return value;
  }

  private void assertScopedExistence(AuthenticatedActor actor, UUID id) {
    boolean exists = actor.hasRole("RECEPTIONIST")
        ? agendamentos.existsByIdAndClinicaId(id, actor.clinicaId())
        : agendamentos.existsByIdAndPacienteId(id, actor.pacienteId());
    if (!exists) throw new ResourceNotFoundException();
  }

  private Clinica clinicaDoAtor(AuthenticatedActor actor) {
    return clinicas.findById(actor.clinicaId()).orElseThrow(ResourceNotFoundException::new);
  }

  private Clinica lockClinicaDoAtor(AuthenticatedActor actor) {
    Clinica clinica = clinicas.findSingletonForUpdate().orElseThrow(ResourceNotFoundException::new);
    if (!clinica.id().equals(actor.clinicaId())) throw new ResourceNotFoundException();
    return clinica;
  }

  private static void requireAvailabilityRole(AuthenticatedActor actor) {
    if (actor.hasRole("ADMINISTRATOR")) return;
    requirePatient(actor);
  }

  private static void requirePatient(AuthenticatedActor actor) {
    if (!actor.hasRole("PATIENT") || actor.pacienteId() == null) {
      throw new AccessDeniedException("Vínculo de paciente necessário.");
    }
  }

  private static void requireAppointmentOperator(AuthenticatedActor actor) {
    if (actor.hasRole("RECEPTIONIST")) return;
    requirePatient(actor);
  }

  private static BusinessConflictException unavailable() {
    return new BusinessConflictException("HORARIO_INDISPONIVEL", "Este horário não está mais disponível.");
  }

  private record Oferta(RegraAgenda regra, Instant inicio, Instant fim) { }

  public record NamedResource(UUID id, String nome) { }

  public record Slot(UUID regraAgendaId, UUID medicoId, UUID especialidadeId,
      UUID consultorioId, Instant inicio, Instant fim, NamedResource medico,
      NamedResource especialidade, NamedResource unidade, NamedResource consultorio,
      ZoneId zone) {
    public OffsetDateTime inicioComOffset() { return inicio.atZone(zone).toOffsetDateTime(); }
    public OffsetDateTime fimComOffset() { return fim.atZone(zone).toOffsetDateTime(); }
  }

  public record Availability(List<Slot> items, String timeZone) { }

  public record AppointmentView(UUID id, long version, OffsetDateTime inicio,
      OffsetDateTime fim, StatusAgendamento status, OffsetDateTime checkInEm,
      NamedResource medico, NamedResource especialidade, NamedResource unidade,
      NamedResource consultorio, NamedResource paciente) { }
}
