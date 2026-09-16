package br.com.medflow.common.http;

import java.io.IOException;
import java.util.UUID;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Gera correlação antes dos filtros de segurança, sem confiar em cabeçalhos recebidos. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    /** Nome do cabeçalho de resposta com o identificador gerado. */
    public static final String HEADER = "X-Request-Id";

    /** Atributo interno disponível também aos handlers de autenticação e autorização. */
    public static final String ATTRIBUTE = RequestIdFilter.class.getName() + ".requestId";

    /**
     * Recupera ou cria a correlação interna desta requisição.
     *
     * @param request requisição atual
     * @return UUID gerado pelo servidor, independente dos cabeçalhos do cliente
     */
    public static String requestId(HttpServletRequest request) {
        if (request.getAttribute(ATTRIBUTE) instanceof String id) {
            return id;
        }
        String id = UUID.randomUUID().toString();
        request.setAttribute(ATTRIBUTE, id);
        return id;
    }

    /** {@inheritDoc} */
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String previous = MDC.get("requestId");
        String id = requestId(request);
        response.setHeader(HEADER, id);
        MDC.put("requestId", id);
        try {
            filterChain.doFilter(request, response);
        } finally {
            if (previous == null) {
                MDC.remove("requestId");
            } else {
                MDC.put("requestId", previous);
            }
        }
    }

    /** {@inheritDoc} */
    @Override
    protected boolean shouldNotFilterErrorDispatch() {
        return false;
    }
}
