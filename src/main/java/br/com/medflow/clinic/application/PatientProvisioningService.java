package br.com.medflow.clinic.application;

import br.com.medflow.clinic.domain.Paciente;
import br.com.medflow.clinic.persistence.ClinicaRepository;
import br.com.medflow.clinic.persistence.PacienteRepository;
import br.com.medflow.common.http.ResourceNotFoundException;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Provisiona vínculo sintético/confiável de paciente sem expor autocadastro ou credenciais. */
@Service
public class PatientProvisioningService {
  private final ClinicaRepository clinicas;
  private final PacienteRepository pacientes;

  public PatientProvisioningService(ClinicaRepository clinicas, PacienteRepository pacientes) {
    this.clinicas = clinicas;
    this.pacientes = pacientes;
  }

  @Transactional
  public Paciente provisionar(String subject, String nome) {
    var clinica = clinicas.findSingletonForUpdate().orElseThrow(ResourceNotFoundException::new);
    return pacientes.findBySubject(subject).orElseGet(() ->
        pacientes.saveAndFlush(new Paciente(UUID.randomUUID(), clinica, nome, subject)));
  }
}
