package br.com.medflow.common.http;

/** Conflito de regra de negócio que pode ser comunicado sem revelar estado interno. */
public class BusinessConflictException extends RuntimeException {

  private final String code;

  public BusinessConflictException(String code, String message) {
    super(message);
    this.code = code;
  }

  public String code() { return code; }
}
