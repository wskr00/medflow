package br.com.medflow.health;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Expõe apenas a disponibilidade HTTP do processo, sem detalhes de infraestrutura. */
@RestController
public class HealthController {

    /**
     * Informa que o processo consegue atender à requisição HTTP.
     *
     * @return status mínimo, sem declarar conectividade com banco ou identidade
     */
    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
