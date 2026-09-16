package br.com.medflow.scheduling.domain;

import br.com.medflow.clinic.domain.Clinica;
import br.com.medflow.clinic.domain.Consultorio;
import br.com.medflow.clinic.domain.Especialidade;
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
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "regra_agenda")
public class RegraAgenda {

  @Id @GeneratedValue private UUID id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "clinica_id") private Clinica clinica;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "medico_id") private Medico medico;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "especialidade_id") private Especialidade especialidade;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "consultorio_id") private Consultorio consultorio;
  @Column(name = "dia_semana", nullable = false) private short diaSemana;
  @Column(name = "hora_inicio", nullable = false) private LocalTime horaInicio;
  @Column(name = "hora_fim", nullable = false) private LocalTime horaFim;
  @Column(name = "duracao_minutos", nullable = false) private int duracaoMinutos;
  @Column(name = "vigente_de", nullable = false) private LocalDate vigenteDe;
  @Column(name = "vigente_ate") private LocalDate vigenteAte;
  @Column(nullable = false) private boolean ativo;
  @Version private long version;

  protected RegraAgenda() { }

  public RegraAgenda(Clinica clinica, Medico medico, Especialidade especialidade,
      Consultorio consultorio, DayOfWeek diaSemana, LocalTime horaInicio, LocalTime horaFim,
      int duracaoMinutos, LocalDate vigenteDe, LocalDate vigenteAte, boolean ativo) {
    this.clinica = clinica;
    this.medico = medico;
    this.especialidade = especialidade;
    this.consultorio = consultorio;
    alterar(diaSemana, horaInicio, horaFim, duracaoMinutos, vigenteDe, vigenteAte, ativo);
  }

  public UUID id() { return id; }
  public Clinica clinica() { return clinica; }
  public Medico medico() { return medico; }
  public Especialidade especialidade() { return especialidade; }
  public Consultorio consultorio() { return consultorio; }
  public DayOfWeek diaSemana() { return DayOfWeek.of(diaSemana); }
  public LocalTime horaInicio() { return horaInicio; }
  public LocalTime horaFim() { return horaFim; }
  public int duracaoMinutos() { return duracaoMinutos; }
  public LocalDate vigenteDe() { return vigenteDe; }
  public LocalDate vigenteAte() { return vigenteAte; }
  public boolean ativo() { return ativo; }
  public long version() { return version; }

  public void alterar(DayOfWeek diaSemana, LocalTime horaInicio, LocalTime horaFim,
      int duracaoMinutos, LocalDate vigenteDe, LocalDate vigenteAte, boolean ativo) {
    if (diaSemana == null || horaInicio == null || horaFim == null || vigenteDe == null
        || duracaoMinutos <= 0 || !horaInicio.isBefore(horaFim)
        || (vigenteAte != null && vigenteAte.isBefore(vigenteDe))) {
      throw new IllegalArgumentException("regra de agenda inválida");
    }
    if (horaInicio.plusMinutes(duracaoMinutos).isAfter(horaFim)) {
      throw new IllegalArgumentException("duração não cabe na regra");
    }
    this.diaSemana = (short) diaSemana.getValue();
    this.horaInicio = horaInicio;
    this.horaFim = horaFim;
    this.duracaoMinutos = duracaoMinutos;
    this.vigenteDe = vigenteDe;
    this.vigenteAte = vigenteAte;
    this.ativo = ativo;
  }

  public boolean conflitaCom(RegraAgenda outra) {
    return ativo && outra.ativo && diaSemana == outra.diaSemana
        && (medico.id().equals(outra.medico.id()) || consultorio.id().equals(outra.consultorio.id()))
        && intervalosSobrepostos(vigenteDe, vigenteAte, outra.vigenteDe, outra.vigenteAte)
        && horaInicio.isBefore(outra.horaFim) && outra.horaInicio.isBefore(horaFim);
  }

  public boolean vigenteEm(LocalDate data) {
    return !data.isBefore(vigenteDe) && (vigenteAte == null || !data.isAfter(vigenteAte));
  }

  private static boolean intervalosSobrepostos(LocalDate inicioA, LocalDate fimA,
      LocalDate inicioB, LocalDate fimB) {
    return (fimB == null || !inicioA.isAfter(fimB)) && (fimA == null || !inicioB.isAfter(fimA));
  }
}
