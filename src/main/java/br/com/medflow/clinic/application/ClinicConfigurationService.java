package br.com.medflow.clinic.application;

import br.com.medflow.clinic.domain.Clinica;
import br.com.medflow.clinic.domain.Consultorio;
import br.com.medflow.clinic.domain.Especialidade;
import br.com.medflow.clinic.domain.Medico;
import br.com.medflow.clinic.domain.Unidade;
import br.com.medflow.clinic.persistence.ClinicaRepository;
import br.com.medflow.clinic.persistence.ConsultorioRepository;
import br.com.medflow.clinic.persistence.EspecialidadeRepository;
import br.com.medflow.clinic.persistence.MedicoRepository;
import br.com.medflow.clinic.persistence.UnidadeRepository;
import br.com.medflow.common.http.BusinessConflictException;
import br.com.medflow.common.http.ResourceNotFoundException;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Casos de uso administrativos da estrutura da clínica única. */
@Service
public class ClinicConfigurationService {

  private final ClinicaRepository clinicas;
  private final UnidadeRepository unidades;
  private final ConsultorioRepository consultorios;
  private final EspecialidadeRepository especialidades;
  private final MedicoRepository medicos;
  private final FutureAppointmentGuard futureAppointments;

  public ClinicConfigurationService(ClinicaRepository clinicas, UnidadeRepository unidades,
      ConsultorioRepository consultorios, EspecialidadeRepository especialidades,
      MedicoRepository medicos, FutureAppointmentGuard futureAppointments) {
    this.clinicas = clinicas;
    this.unidades = unidades;
    this.consultorios = consultorios;
    this.especialidades = especialidades;
    this.medicos = medicos;
    this.futureAppointments = futureAppointments;
  }

  @Transactional(readOnly = true)
  public Clinica clinica() { return clinicas.findBySingletonTrue().orElseThrow(ResourceNotFoundException::new); }

  @Transactional
  public Clinica alterarClinica(long expectedVersion, String nome, String timeZone, boolean ativo) {
    Clinica clinica = lockClinica();
    assertVersion(clinica.version(), expectedVersion);
    String normalizedTimeZone = Clinica.validTimeZone(timeZone);
    if ((clinica.ativo() && !ativo) || !clinica.timeZone().equals(normalizedTimeZone)) {
      futureAppointments.assertClinicCanChangeAvailability(clinica.id());
    }
    clinica.alterar(nome, normalizedTimeZone, ativo);
    clinicas.flush();
    return clinica;
  }

  @Transactional(readOnly = true)
  public Page<Unidade> unidades(boolean incluirInativas, Pageable pageable) {
    UUID clinicaId = clinica().id();
    return incluirInativas ? unidades.findByClinicaId(clinicaId, pageable)
        : unidades.findByClinicaIdAndAtivoTrue(clinicaId, pageable);
  }

  @Transactional
  public Unidade criarUnidade(String nome, String endereco, boolean ativo) {
    return unidades.saveAndFlush(new Unidade(lockClinica(), nome, endereco, ativo));
  }

  @Transactional
  public Unidade alterarUnidade(UUID id, long expectedVersion, String nome, String endereco, boolean ativo) {
    Clinica clinica = lockClinica();
    Unidade unidade = unidadeDaClinica(id, clinica);
    assertVersion(unidade.version(), expectedVersion);
    if (unidade.ativo() && !ativo) {
      futureAppointments.assertUnitCanBeDeactivated(unidade.id());
    }
    unidade.alterar(nome, endereco, ativo);
    unidades.flush();
    return unidade;
  }

  @Transactional(readOnly = true)
  public Page<Consultorio> consultorios(boolean incluirInativos, Pageable pageable) {
    UUID clinicaId = clinica().id();
    return incluirInativos ? consultorios.findByUnidadeClinicaId(clinicaId, pageable)
        : consultorios.findByUnidadeClinicaIdAndAtivoTrue(clinicaId, pageable);
  }

  @Transactional
  public Consultorio criarConsultorio(UUID unidadeId, String nome, boolean ativo) {
    Clinica clinica = lockClinica();
    Unidade unidade = unidadeDaClinica(unidadeId, clinica);
    if (ativo && !unidade.ativo()) {
      throw configurationConflict("Consultório ativo exige unidade ativa.");
    }
    return consultorios.saveAndFlush(new Consultorio(unidade, nome, ativo));
  }

  @Transactional
  public Consultorio alterarConsultorio(UUID id, UUID unidadeId, long expectedVersion, String nome, boolean ativo) {
    Clinica clinica = lockClinica();
    Consultorio consultorio = consultorioDaClinica(id, clinica);
    assertVersion(consultorio.version(), expectedVersion);
    if (!consultorio.unidade().id().equals(unidadeId)) {
      throw configurationConflict("Não é permitido mover consultório entre unidades.");
    }
    if (ativo && !consultorio.unidade().ativo()) {
      throw configurationConflict("Consultório ativo exige unidade ativa.");
    }
    if (consultorio.ativo() && !ativo) {
      futureAppointments.assertRoomCanBeDeactivated(consultorio.id());
    }
    consultorio.alterar(nome, ativo);
    consultorios.flush();
    return consultorio;
  }

  @Transactional(readOnly = true)
  public Page<Especialidade> especialidades(boolean incluirInativas, Pageable pageable) {
    UUID clinicaId = clinica().id();
    return incluirInativas ? especialidades.findByClinicaId(clinicaId, pageable)
        : especialidades.findByClinicaIdAndAtivoTrue(clinicaId, pageable);
  }

  @Transactional
  public Especialidade criarEspecialidade(String nome, boolean ativo) {
    return especialidades.saveAndFlush(new Especialidade(lockClinica(), nome, ativo));
  }

  @Transactional
  public Especialidade alterarEspecialidade(UUID id, long expectedVersion, String nome, boolean ativo) {
    Clinica clinica = lockClinica();
    Especialidade especialidade = especialidadeDaClinica(id, clinica);
    assertVersion(especialidade.version(), expectedVersion);
    if (especialidade.ativo() && !ativo) {
      futureAppointments.assertSpecialtyCanBeDeactivated(especialidade.id());
    }
    especialidade.alterar(nome, ativo);
    especialidades.flush();
    return especialidade;
  }

  @Transactional(readOnly = true)
  public Page<Medico> medicos(boolean incluirInativos, Pageable pageable) {
    UUID clinicaId = clinica().id();
    return incluirInativos ? medicos.findByClinicaId(clinicaId, pageable)
        : medicos.findByClinicaIdAndAtivoTrue(clinicaId, pageable);
  }

  @Transactional
  public Medico criarMedico(String nome, String crmNumero, String crmUf,
      Collection<UUID> especialidadeIds, boolean ativo) {
    Clinica clinica = lockClinica();
    List<Especialidade> vinculos = especialidadesDaClinica(especialidadeIds, clinica);
    if (ativo && vinculos.stream().anyMatch(especialidade -> !especialidade.ativo())) {
      throw configurationConflict("Médico ativo exige especialidades ativas.");
    }
    validarCrmDisponivel(clinica, crmNumero, crmUf, null);
    return medicos.saveAndFlush(new Medico(clinica, nome, crmNumero, crmUf, vinculos, ativo));
  }

  @Transactional
  public Medico alterarMedico(UUID id, long expectedVersion, String nome, String crmNumero, String crmUf,
      Collection<UUID> especialidadeIds, boolean ativo) {
    Clinica clinica = lockClinica();
    Medico medico = medicoDaClinica(id, clinica);
    assertVersion(medico.version(), expectedVersion);
    List<Especialidade> vinculos = especialidadesDaClinica(especialidadeIds, clinica);
    if (ativo && vinculos.stream().anyMatch(especialidade -> !especialidade.ativo())) {
      throw configurationConflict("Médico ativo exige especialidades ativas.");
    }
    if (medico.ativo() && !ativo) {
      futureAppointments.assertDoctorCanBeDeactivated(medico.id());
    } else {
      Set<UUID> removidas = new HashSet<>(medico.especialidades().stream()
          .map(Especialidade::id).toList());
      removidas.removeAll(vinculos.stream().map(Especialidade::id).toList());
      futureAppointments.assertDoctorSpecialtiesCanBeRemoved(medico.id(), removidas);
    }
    validarCrmDisponivel(clinica, crmNumero, crmUf, medico.id());
    medico.alterar(nome, crmNumero, crmUf, vinculos, ativo);
    medicos.flush();
    return medico;
  }

  /** Porta explícita para o provisionamento confiável de vínculo médico, sem endpoint de CRUD. */
  @Transactional
  public Medico provisionarSubjectMedico(UUID medicoId, String subject) {
    Clinica clinica = lockClinica();
    Medico medico = medicoDaClinica(medicoId, clinica);
    if (medicos.findBySubject(subject).isPresent()) {
      throw configurationConflict("Subject já está vinculado a outro médico.");
    }
    medico.provisionarSubject(subject);
    medicos.flush();
    return medico;
  }

  private Clinica lockClinica() {
    return clinicas.findSingletonForUpdate().orElseThrow(ResourceNotFoundException::new);
  }

  private Unidade unidadeDaClinica(UUID id, Clinica clinica) {
    Unidade unidade = unidades.findById(id).orElseThrow(ResourceNotFoundException::new);
    if (!unidade.clinica().id().equals(clinica.id())) throw new ResourceNotFoundException();
    return unidade;
  }

  private Consultorio consultorioDaClinica(UUID id, Clinica clinica) {
    Consultorio consultorio = consultorios.findById(id).orElseThrow(ResourceNotFoundException::new);
    if (!consultorio.unidade().clinica().id().equals(clinica.id())) throw new ResourceNotFoundException();
    return consultorio;
  }

  private Especialidade especialidadeDaClinica(UUID id, Clinica clinica) {
    Especialidade especialidade = especialidades.findById(id).orElseThrow(ResourceNotFoundException::new);
    if (!especialidade.clinica().id().equals(clinica.id())) throw new ResourceNotFoundException();
    return especialidade;
  }

  private Medico medicoDaClinica(UUID id, Clinica clinica) {
    Medico medico = medicos.findById(id).orElseThrow(ResourceNotFoundException::new);
    if (!medico.clinica().id().equals(clinica.id())) throw new ResourceNotFoundException();
    return medico;
  }

  private List<Especialidade> especialidadesDaClinica(Collection<UUID> ids, Clinica clinica) {
    if (ids == null || ids.isEmpty()) throw configurationConflict("Médico deve possuir especialidade.");
    List<Especialidade> found = especialidades.findAllById(ids);
    if (found.size() != ids.stream().distinct().count()
        || found.stream().anyMatch(especialidade -> !especialidade.clinica().id().equals(clinica.id()))) {
      throw new ResourceNotFoundException();
    }
    return found;
  }

  private void validarCrmDisponivel(Clinica clinica, String numero, String uf, UUID atual) {
    String normalizedNumero = Clinica.requiredText(numero, 30, "crmNumero");
    String normalizedUf = Clinica.requiredText(uf, 2, "crmUf").toUpperCase();
    medicos.findByClinicaId(clinica.id(), Pageable.unpaged()).stream()
        .filter(medico -> !medico.id().equals(atual))
        .filter(medico -> medico.crmNumero().equals(normalizedNumero) && medico.crmUf().equals(normalizedUf))
        .findAny().ifPresent(medico -> { throw configurationConflict("CRM já cadastrado na clínica."); });
  }

  private static void assertVersion(long atual, long esperada) {
    if (atual != esperada) throw new BusinessConflictException(
        "VERSAO_DESATUALIZADA", "O recurso foi alterado por outra operação.");
  }

  private static BusinessConflictException configurationConflict(String message) {
    return new BusinessConflictException("CONFIGURACAO_CONFLITANTE", message);
  }
}
