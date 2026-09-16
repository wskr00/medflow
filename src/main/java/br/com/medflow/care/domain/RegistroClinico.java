package br.com.medflow.care.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** Valor interno do Atendimento; não possui identidade ou ciclo de vida independente. */
@Embeddable
public class RegistroClinico {

  public static final int QUEIXA_MAX = 2_000;
  public static final int RESUMO_MAX = 10_000;
  public static final int CONDUTA_MAX = 10_000;
  public static final int OBSERVACOES_MAX = 5_000;

  @Column(name = "queixa_principal", nullable = false, length = QUEIXA_MAX)
  private String queixaPrincipal;
  @Column(name = "resumo_anamnese", nullable = false, length = RESUMO_MAX)
  private String resumoAnamnese;
  @Column(nullable = false, length = CONDUTA_MAX)
  private String conduta;
  @Column(nullable = false, length = OBSERVACOES_MAX)
  private String observacoes;

  protected RegistroClinico() { }

  public RegistroClinico(String queixaPrincipal, String resumoAnamnese,
      String conduta, String observacoes) {
    this.queixaPrincipal = normalize(queixaPrincipal, QUEIXA_MAX, "queixaPrincipal");
    this.resumoAnamnese = normalize(resumoAnamnese, RESUMO_MAX, "resumoAnamnese");
    this.conduta = normalize(conduta, CONDUTA_MAX, "conduta");
    this.observacoes = normalize(observacoes, OBSERVACOES_MAX, "observacoes");
  }

  public static RegistroClinico vazio() {
    return new RegistroClinico(null, null, null, null);
  }

  public String queixaPrincipal() { return queixaPrincipal; }
  public String resumoAnamnese() { return resumoAnamnese; }
  public String conduta() { return conduta; }
  public String observacoes() { return observacoes; }

  public boolean completo() {
    return !queixaPrincipal.isBlank() && !resumoAnamnese.isBlank() && !conduta.isBlank();
  }

  private static String normalize(String value, int max, String field) {
    String normalized = value == null ? "" : value.trim();
    if (normalized.length() > max) {
      throw new IllegalArgumentException(field + " excede o limite permitido");
    }
    return normalized;
  }
}
