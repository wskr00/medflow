package br.com.medflow.clinic.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.util.UUID;

/** Vínculo local de paciente provisionado; não possui fluxo de autocadastro neste MVP. */
@Entity
@Table(name = "paciente")
public class Paciente {

  @Id private UUID id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "clinica_id") private Clinica clinica;
  @Column(nullable = false, length = 200) private String nome;
  @Column(nullable = false, unique = true, length = 255) private String subject;
  @Version private long version;

  protected Paciente() { }

  public Paciente(UUID id, Clinica clinica, String nome, String subject) {
    this.id = id;
    this.clinica = clinica;
    this.nome = Clinica.requiredText(nome, 200, "nome");
    this.subject = Clinica.requiredText(subject, 255, "subject");
  }

  public UUID id() { return id; }
  public Clinica clinica() { return clinica; }
  public String nome() { return nome; }
  public String subject() { return subject; }
}
