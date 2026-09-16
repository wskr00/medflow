package br.com.medflow.common.http;

/** Recurso não encontrado; a API não distingue recurso inexistente de inacessível. */
public class ResourceNotFoundException extends RuntimeException {
  public ResourceNotFoundException() {
    super("Recurso não encontrado.");
  }
}
