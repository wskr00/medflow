package br.com.medflow.common.http;

import java.util.List;

/**
 * Representa erros HTTP sem incluir dados clínicos ou detalhes internos.
 *
 * @param status código de status HTTP
 * @param code código estável para o cliente
 * @param message mensagem segura para apresentação
 * @param requestId identificador de correlação gerado pelo servidor
 * @param fieldErrors erros de campos, sem os valores rejeitados
 */
public record ApiError(int status, String code, String message, String requestId,
                       List<FieldError> fieldErrors) {

    /**
     * Representa uma falha de validação sem reproduzir o valor informado.
     *
     * @param field nome do campo
     * @param code código da validação
     * @param message mensagem segura
     */
    public record FieldError(String field, String code, String message) { }
}
