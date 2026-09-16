package br.com.medflow.clinic.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.util.UUID;

@Entity
@Table(name = "especialidade")
public class Especialidade {

  @Id @GeneratedValue private UUID id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "clinica_id") private Clinica clinica;
  @Column(nullable = false, length = 200) private String nome;
  @Column(nullable = false) private boolean ativo;
  @Version private long version;

  protected Especialidade() { }

  public Especialidade(Clinica clinica, String nome, boolean ativo) {
    this.clinica = clinica;
    alterar(nome, ativo);
  }

  public UUID id() { return id; }
  public Clinica clinica() { return clinica; }
  public String nome() { return nome; }
  public boolean ativo() { return ativo; }
  public long version() { return version; }

  public void alterar(String nome, boolean ativo) {
    this.nome = Clinica.requiredText(nome, 200, "nome");
    this.ativo = ativo;
  }
}
