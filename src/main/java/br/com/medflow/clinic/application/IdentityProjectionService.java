package br.com.medflow.clinic.application;

import br.com.medflow.clinic.persistence.ClinicaRepository;
import br.com.medflow.clinic.persistence.MedicoRepository;
import br.com.medflow.clinic.persistence.PacienteRepository;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Projeção somente-leitura para a borda de segurança; não importa classes de security. */
@Service
public class IdentityProjectionService {

  private final ClinicaRepository clinicas;
  private final PacienteRepository pacientes;
  private final MedicoRepository medicos;

  public IdentityProjectionService(ClinicaRepository clinicas, PacienteRepository pacientes,
      MedicoRepository medicos) {
    this.clinicas = clinicas;
    this.pacientes = pacientes;
    this.medicos = medicos;
  }

  @Transactional(readOnly = true)
  public IdentityProjection lookup(String subject, Set<String> roles) {
    var clinica = clinicas.findBySingletonTrue().orElseThrow();
    UUID pacienteId = roles.contains("PATIENT")
        ? pacientes.findBySubject(subject).map(paciente -> paciente.id()).orElse(null) : null;
    UUID medicoId = roles.contains("DOCTOR")
        ? medicos.findBySubject(subject).map(medico -> medico.id()).orElse(null) : null;
    return new IdentityProjection(pacienteId, medicoId, clinica.id(), clinica.timeZone());
  }

  public record IdentityProjection(UUID pacienteId, UUID medicoId, UUID clinicaId, String timeZone) { }
}
