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
@Table(name = "unidade")
public class Unidade {

  @Id @GeneratedValue private UUID id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "clinica_id") private Clinica clinica;
  @Column(nullable = false, length = 200) private String nome;
  @Column(nullable = false, length = 500) private String endereco;
  @Column(nullable = false) private boolean ativo;
  @Version private long version;

  protected Unidade() { }

  public Unidade(Clinica clinica, String nome, String endereco, boolean ativo) {
    this.clinica = clinica;
    alterar(nome, endereco, ativo);
  }

  public UUID id() { return id; }
  public Clinica clinica() { return clinica; }
  public String nome() { return nome; }
  public String endereco() { return endereco; }
  public boolean ativo() { return ativo; }
  public long version() { return version; }

  public void alterar(String nome, String endereco, boolean ativo) {
    this.nome = Clinica.requiredText(nome, 200, "nome");
    this.endereco = Clinica.requiredText(endereco, 500, "endereco");
    this.ativo = ativo;
  }
}
