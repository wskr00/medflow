package br.com.medflow.common.http;

import java.util.List;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Uniformiza erros MVC sem expor exceções, valores rejeitados ou mensagens do banco. */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    /** {@inheritDoc} */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception exception, Object body,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        HttpServletRequest servletRequest = ((ServletWebRequest) request).getRequest();
        List<ApiError.FieldError> fields = exception instanceof MethodArgumentNotValidException validation
                ? validation.getBindingResult().getFieldErrors().stream()
                    .map(error -> new ApiError.FieldError(error.getField(), "CAMPO_INVALIDO", "Valor inválido."))
                    .distinct().toList()
                : List.of();
        ApiError error = error(status.value(), RequestIdFilter.requestId(servletRequest), fields);
        return super.handleExceptionInternal(exception, error, headers, status, request);
    }

    /**
     * Trata falhas inesperadas preservando exceções pertencentes à cadeia de segurança.
     *
     * @param exception falha capturada, nunca serializada nem registrada com seu conteúdo
     * @param request requisição atual
     * @return erro interno genérico com correlação
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception exception, HttpServletRequest request) {
        if (exception instanceof AccessDeniedException denied) {
            throw denied;
        }
        if (exception instanceof AuthenticationException authentication) {
            throw authentication;
        }
        String id = RequestIdFilter.requestId(request);
        log.error("Falha HTTP inesperada requestId={} tipo={}", id, exception.getClass().getSimpleName());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error(500, id, List.of()));
    }

    @ExceptionHandler(BusinessConflictException.class)
    public ResponseEntity<ApiError> handleConflict(BusinessConflictException exception,
            HttpServletRequest request) {
        String id = RequestIdFilter.requestId(request);
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(
            HttpStatus.CONFLICT.value(), exception.code(), exception.getMessage(), id, List.of()));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(ResourceNotFoundException exception,
            HttpServletRequest request) {
        String id = RequestIdFilter.requestId(request);
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(
            HttpStatus.NOT_FOUND.value(), "RECURSO_NAO_ENCONTRADO", "Recurso não encontrado.", id, List.of()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleInvalidArgument(IllegalArgumentException exception,
            HttpServletRequest request) {
        String id = RequestIdFilter.requestId(request);
        return ResponseEntity.badRequest().body(error(HttpStatus.BAD_REQUEST.value(), id, List.of()));
    }

    private ApiError error(int status, String id, List<ApiError.FieldError> fields) {
        String code = switch (status) {
            case 400 -> "ENTRADA_INVALIDA";
            case 401 -> "NAO_AUTENTICADO";
            case 403 -> "ACESSO_NEGADO";
            case 404 -> "RECURSO_NAO_ENCONTRADO";
            case 405 -> "METODO_NAO_PERMITIDO";
            case 406 -> "RESPOSTA_NAO_ACEITAVEL";
            case 409 -> "CONFLITO";
            case 415 -> "TIPO_DE_CONTEUDO_NAO_SUPORTADO";
            default -> status >= 500 ? "ERRO_INTERNO" : "REQUISICAO_INVALIDA";
        };
        String message = switch (status) {
            case 400 -> "Verifique os dados enviados.";
            case 401 -> "Autenticação necessária.";
            case 403 -> "Acesso negado.";
            case 404 -> "Recurso não encontrado.";
            case 405 -> "Método não permitido.";
            case 406 -> "Formato de resposta não suportado.";
            case 409 -> "A operação conflita com o estado atual.";
            case 415 -> "Tipo de conteúdo não suportado.";
            default -> status >= 500 ? "Não foi possível concluir a operação." : "Requisição inválida.";
        };
        return new ApiError(status, code, message, id, fields);
    }
}
