package br.com.medflow.scheduling.domain;

import br.com.medflow.clinic.domain.Clinica;
import br.com.medflow.clinic.domain.Medico;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "bloqueio_agenda")
public class BloqueioAgenda {

  @Id @GeneratedValue private UUID id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "clinica_id") private Clinica clinica;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "medico_id") private Medico medico;
  @Column(nullable = false) private Instant inicio;
  @Column(nullable = false) private Instant fim;
  @Column(nullable = false) private boolean ativo;
  @Version private long version;

  protected BloqueioAgenda() { }

  public BloqueioAgenda(Clinica clinica, Medico medico, Instant inicio, Instant fim, boolean ativo) {
    this.clinica = clinica;
    this.medico = medico;
    alterar(inicio, fim, ativo);
  }

  public UUID id() { return id; }
  public Clinica clinica() { return clinica; }
  public Medico medico() { return medico; }
  public Instant inicio() { return inicio; }
  public Instant fim() { return fim; }
  public boolean ativo() { return ativo; }
  public long version() { return version; }

  public void alterar(Instant inicio, Instant fim, boolean ativo) {
    if (inicio == null || fim == null || !inicio.isBefore(fim)) {
      throw new IllegalArgumentException("bloqueio de agenda inválido");
    }
    this.inicio = inicio;
    this.fim = fim;
    this.ativo = ativo;
  }

  public boolean conflitaCom(BloqueioAgenda outro) {
    return ativo && outro.ativo && medico.id().equals(outro.medico.id())
        && inicio.isBefore(outro.fim) && outro.inicio.isBefore(fim);
  }

  public boolean cobre(Instant inicioSlot, Instant fimSlot) {
    return ativo && inicio.isBefore(fimSlot) && inicioSlot.isBefore(fim);
  }
}
