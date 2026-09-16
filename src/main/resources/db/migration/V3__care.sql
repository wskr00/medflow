CREATE TABLE atendimento (
    id UUID PRIMARY KEY,
    agendamento_id UUID NOT NULL UNIQUE REFERENCES agendamento(id),
    iniciado_em TIMESTAMP WITH TIME ZONE NOT NULL,
    finalizado_em TIMESTAMP WITH TIME ZONE,
    queixa_principal VARCHAR(2000) NOT NULL DEFAULT '',
    resumo_anamnese VARCHAR(10000) NOT NULL DEFAULT '',
    conduta VARCHAR(10000) NOT NULL DEFAULT '',
    observacoes VARCHAR(5000) NOT NULL DEFAULT '',
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (finalizado_em IS NULL OR finalizado_em >= iniciado_em)
);

CREATE INDEX ix_agendamento_medico_status_inicio
    ON agendamento (medico_id, status, inicio, id);

CREATE INDEX ix_atendimento_finalizado
    ON atendimento (finalizado_em DESC, id);
