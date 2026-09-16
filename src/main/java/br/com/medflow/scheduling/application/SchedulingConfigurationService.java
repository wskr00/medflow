package br.com.medflow.scheduling.application;

import br.com.medflow.clinic.domain.Clinica;
import br.com.medflow.clinic.domain.Consultorio;
import br.com.medflow.clinic.domain.Especialidade;
import br.com.medflow.clinic.domain.Medico;
import br.com.medflow.clinic.persistence.ClinicaRepository;
import br.com.medflow.clinic.persistence.ConsultorioRepository;
import br.com.medflow.clinic.persistence.EspecialidadeRepository;
import br.com.medflow.clinic.persistence.MedicoRepository;
import br.com.medflow.common.http.BusinessConflictException;
import br.com.medflow.common.http.ResourceNotFoundException;
import br.com.medflow.scheduling.domain.BloqueioAgenda;
import br.com.medflow.scheduling.domain.RegraAgenda;
import br.com.medflow.scheduling.persistence.BloqueioAgendaRepository;
import br.com.medflow.scheduling.persistence.RegraAgendaRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Configura regras e bloqueios; cálculo público de disponibilidade pertence à Issue #10. */
@Service
public class SchedulingConfigurationService {

  private final ClinicaRepository clinicas;
  private final MedicoRepository medicos;
  private final EspecialidadeRepository especialidades;
  private final ConsultorioRepository consultorios;
  private final RegraAgendaRepository regras;
  private final BloqueioAgendaRepository bloqueios;

  public SchedulingConfigurationService(ClinicaRepository clinicas, MedicoRepository medicos,
      EspecialidadeRepository especialidades, ConsultorioRepository consultorios,
      RegraAgendaRepository regras, BloqueioAgendaRepository bloqueios) {
    this.clinicas = clinicas;
    this.medicos = medicos;
    this.especialidades = especialidades;
    this.consultorios = consultorios;
    this.regras = regras;
    this.bloqueios = bloqueios;
  }

  @Transactional(readOnly = true)
  public Page<RegraAgenda> regras(boolean incluirInativas, Pageable pageable) {
    Clinica clinica = clinicas.findBySingletonTrue().orElseThrow(ResourceNotFoundException::new);
    return incluirInativas ? regras.findByClinicaId(clinica.id(), pageable)
        : regras.findByClinicaIdAndAtivoTrue(clinica.id(), pageable);
  }

  @Transactional
  public RegraAgenda criarRegra(RegraCommand command) {
    Clinica clinica = lockClinica();
    RegraAgenda regra = novaRegra(clinica, command);
    validarConflitoRegra(regra, null);
    return regras.saveAndFlush(regra);
  }

  @Transactional
  public RegraAgenda alterarRegra(UUID id, RegraCommand command) {
    Clinica clinica = lockClinica();
    RegraAgenda regra = regraDaClinica(id, clinica);
    assertVersion(regra.version(), command.expectedVersion());
    if (!regra.medico().id().equals(command.medicoId())
        || !regra.especialidade().id().equals(command.especialidadeId())
        || !regra.consultorio().id().equals(command.consultorioId())) {
      throw conflict("Não é permitido trocar vínculos de uma regra existente.");
    }
    validarReferencias(clinica, regra.medico(), regra.especialidade(), regra.consultorio(), command.ativo());
    regra.alterar(command.diaSemana(), command.horaInicio(), command.horaFim(), command.duracaoMinutos(),
        command.vigenteDe(), command.vigenteAte(), command.ativo());
    validarConflitoRegra(regra, regra.id());
    regras.flush();
    return regra;
  }

  @Transactional(readOnly = true)
  public Page<BloqueioAgenda> bloqueios(boolean incluirInativos, Pageable pageable) {
    Clinica clinica = clinicas.findBySingletonTrue().orElseThrow(ResourceNotFoundException::new);
    return incluirInativos ? bloqueios.findByClinicaId(clinica.id(), pageable)
        : bloqueios.findByClinicaIdAndAtivoTrue(clinica.id(), pageable);
  }

  @Transactional
  public BloqueioAgenda criarBloqueio(BloqueioCommand command) {
    Clinica clinica = lockClinica();
    Medico medico = medicoDaClinica(command.medicoId(), clinica);
    if (command.ativo() && !medico.ativo()) throw conflict("Bloqueio ativo exige médico ativo.");
    BloqueioAgenda bloqueio = new BloqueioAgenda(clinica, medico, command.inicio(), command.fim(), command.ativo());
    validarConflitoBloqueio(bloqueio, null);
    return bloqueios.saveAndFlush(bloqueio);
  }

  @Transactional
  public BloqueioAgenda alterarBloqueio(UUID id, BloqueioCommand command) {
    Clinica clinica = lockClinica();
    BloqueioAgenda bloqueio = bloqueioDaClinica(id, clinica);
    assertVersion(bloqueio.version(), command.expectedVersion());
    if (!bloqueio.medico().id().equals(command.medicoId())) {
      throw conflict("Não é permitido trocar o médico de um bloqueio.");
    }
    if (command.ativo() && !bloqueio.medico().ativo()) throw conflict("Bloqueio ativo exige médico ativo.");
    bloqueio.alterar(command.inicio(), command.fim(), command.ativo());
    validarConflitoBloqueio(bloqueio, bloqueio.id());
    bloqueios.flush();
    return bloqueio;
  }

  private RegraAgenda novaRegra(Clinica clinica, RegraCommand command) {
    Medico medico = medicoDaClinica(command.medicoId(), clinica);
    Especialidade especialidade = especialidadeDaClinica(command.especialidadeId(), clinica);
    Consultorio consultorio = consultorioDaClinica(command.consultorioId(), clinica);
    validarReferencias(clinica, medico, especialidade, consultorio, command.ativo());
    return new RegraAgenda(clinica, medico, especialidade, consultorio, command.diaSemana(),
        command.horaInicio(), command.horaFim(), command.duracaoMinutos(), command.vigenteDe(),
        command.vigenteAte(), command.ativo());
  }

  private void validarReferencias(Clinica clinica, Medico medico, Especialidade especialidade,
      Consultorio consultorio, boolean ativo) {
    if (!medico.clinica().id().equals(clinica.id()) || !especialidade.clinica().id().equals(clinica.id())
        || !consultorio.unidade().clinica().id().equals(clinica.id())) throw new ResourceNotFoundException();
    if (!medico.possuiEspecialidade(especialidade)) {
      throw conflict("Especialidade não está vinculada ao médico.");
    }
    if (ativo && (!clinica.ativo() || !medico.ativo() || !especialidade.ativo()
        || !consultorio.ativo() || !consultorio.unidade().ativo())) {
      throw conflict("Regra ativa exige estrutura e vínculos ativos.");
    }
  }

  private void validarConflitoRegra(RegraAgenda candidata, UUID idIgnorado) {
    boolean conflitante = regras.findByClinicaIdAndAtivoTrue(candidata.clinica().id(), Pageable.unpaged()).stream()
        .filter(existente -> !existente.id().equals(idIgnorado))
        .anyMatch(candidata::conflitaCom);
    if (conflitante) throw conflict("Regra de agenda conflita com médico ou consultório.");
  }

  private void validarConflitoBloqueio(BloqueioAgenda candidato, UUID idIgnorado) {
    boolean conflitante = bloqueios.findByClinicaIdAndAtivoTrue(candidato.clinica().id(), Pageable.unpaged()).stream()
        .filter(existente -> !existente.id().equals(idIgnorado))
        .anyMatch(candidato::conflitaCom);
    if (conflitante) throw conflict("Bloqueio de agenda conflita com bloqueio existente.");
  }

  private Clinica lockClinica() { return clinicas.findSingletonForUpdate().orElseThrow(ResourceNotFoundException::new); }

  private Medico medicoDaClinica(UUID id, Clinica clinica) {
    Medico medico = medicos.findById(id).orElseThrow(ResourceNotFoundException::new);
    if (!medico.clinica().id().equals(clinica.id())) throw new ResourceNotFoundException();
    return medico;
  }

  private Especialidade especialidadeDaClinica(UUID id, Clinica clinica) {
    Especialidade especialidade = especialidades.findById(id).orElseThrow(ResourceNotFoundException::new);
    if (!especialidade.clinica().id().equals(clinica.id())) throw new ResourceNotFoundException();
    return especialidade;
  }

  private Consultorio consultorioDaClinica(UUID id, Clinica clinica) {
    Consultorio consultorio = consultorios.findById(id).orElseThrow(ResourceNotFoundException::new);
    if (!consultorio.unidade().clinica().id().equals(clinica.id())) throw new ResourceNotFoundException();
    return consultorio;
  }

  private RegraAgenda regraDaClinica(UUID id, Clinica clinica) {
    RegraAgenda regra = regras.findById(id).orElseThrow(ResourceNotFoundException::new);
    if (!regra.clinica().id().equals(clinica.id())) throw new ResourceNotFoundException();
    return regra;
  }

  private BloqueioAgenda bloqueioDaClinica(UUID id, Clinica clinica) {
    BloqueioAgenda bloqueio = bloqueios.findById(id).orElseThrow(ResourceNotFoundException::new);
    if (!bloqueio.clinica().id().equals(clinica.id())) throw new ResourceNotFoundException();
    return bloqueio;
  }

  private static void assertVersion(long atual, long esperada) {
    if (atual != esperada) throw new BusinessConflictException(
        "VERSAO_DESATUALIZADA", "O recurso foi alterado por outra operação.");
  }

  private static BusinessConflictException conflict(String message) {
    return new BusinessConflictException("CONFIGURACAO_CONFLITANTE", message);
  }

  public record RegraCommand(UUID medicoId, UUID especialidadeId, UUID consultorioId,
      DayOfWeek diaSemana, LocalTime horaInicio, LocalTime horaFim, int duracaoMinutos,
      LocalDate vigenteDe, LocalDate vigenteAte, boolean ativo, long expectedVersion) { }

  public record BloqueioCommand(UUID medicoId, Instant inicio, Instant fim, boolean ativo,
      long expectedVersion) { }
}
