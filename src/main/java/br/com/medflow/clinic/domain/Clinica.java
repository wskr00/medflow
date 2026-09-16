package br.com.medflow.clinic.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.util.Objects;
import java.time.ZoneId;
import java.util.UUID;

@Entity
@Table(name = "clinica")
public class Clinica {

  @Id
  private UUID id;

  @Column(nullable = false, unique = true)
  private boolean singleton;

  @Column(nullable = false, length = 200)
  private String nome;

  @Column(name = "time_zone", nullable = false, length = 64)
  private String timeZone;

  @Column(nullable = false)
  private boolean ativo;

  @Version
  private long version;

  protected Clinica() {
  }

  public UUID id() { return id; }
  public String nome() { return nome; }
  public String timeZone() { return timeZone; }
  public boolean ativo() { return ativo; }
  public long version() { return version; }

  public void alterar(String nome, String timeZone, boolean ativo) {
    this.nome = requiredText(nome, 200, "nome");
    this.timeZone = validTimeZone(timeZone);
    this.ativo = ativo;
  }

  public static String requiredText(String value, int maximum, String field) {
    String normalized = Objects.requireNonNull(value, field).trim();
    if (normalized.isEmpty() || normalized.length() > maximum) {
      throw new IllegalArgumentException(field + " inválido");
    }
    return normalized;
  }

  private static String validTimeZone(String value) {
    String normalized = requiredText(value, 64, "timeZone");
    try {
      ZoneId.of(normalized);
      return normalized;
    } catch (RuntimeException exception) {
      throw new IllegalArgumentException("timeZone inválido");
    }
  }
}
