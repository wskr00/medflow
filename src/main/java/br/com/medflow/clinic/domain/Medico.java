package br.com.medflow.clinic.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "medico")
public class Medico {

  @Id @GeneratedValue private UUID id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "clinica_id") private Clinica clinica;
  @Column(nullable = false, length = 200) private String nome;
  @Column(name = "crm_numero", nullable = false, length = 30) private String crmNumero;
  @Column(name = "crm_uf", nullable = false, length = 2) private String crmUf;
  @Column(length = 255) private String subject;
  @ManyToMany
  @JoinTable(name = "medico_especialidade", joinColumns = @JoinColumn(name = "medico_id"), inverseJoinColumns = @JoinColumn(name = "especialidade_id"))
  private Set<Especialidade> especialidades = new LinkedHashSet<>();
  @Column(nullable = false) private boolean ativo;
  @Version private long version;

  protected Medico() { }

  public Medico(Clinica clinica, String nome, String crmNumero, String crmUf,
      Collection<Especialidade> especialidades, boolean ativo) {
    this.clinica = clinica;
    alterar(nome, crmNumero, crmUf, especialidades, ativo);
  }

  public UUID id() { return id; }
  public Clinica clinica() { return clinica; }
  public String nome() { return nome; }
  public String crmNumero() { return crmNumero; }
  public String crmUf() { return crmUf; }
  public String subject() { return subject; }
  public Set<Especialidade> especialidades() { return Set.copyOf(especialidades); }
  public boolean ativo() { return ativo; }
  public long version() { return version; }

  public void alterar(String nome, String crmNumero, String crmUf,
      Collection<Especialidade> especialidades, boolean ativo) {
    this.nome = Clinica.requiredText(nome, 200, "nome");
    this.crmNumero = Clinica.requiredText(crmNumero, 30, "crmNumero");
    this.crmUf = Clinica.requiredText(crmUf, 2, "crmUf").toUpperCase();
    if (this.crmUf.length() != 2 || !this.crmUf.chars().allMatch(Character::isLetter)) {
      throw new IllegalArgumentException("crmUf inválido");
    }
    this.especialidades.clear();
    this.especialidades.addAll(especialidades);
    this.ativo = ativo;
  }

  /** Vínculo de identidade é uma operação de provisionamento, não do CRUD administrativo. */
  public void provisionarSubject(String subject) {
    if (this.subject != null) {
      throw new IllegalStateException("subject já provisionado");
    }
    this.subject = Clinica.requiredText(subject, 255, "subject");
  }

  public boolean possuiEspecialidade(Especialidade especialidade) {
    return especialidades.contains(especialidade);
  }
}
