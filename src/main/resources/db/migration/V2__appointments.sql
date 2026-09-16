CREATE TABLE agendamento (
    id UUID PRIMARY KEY,
    clinica_id UUID NOT NULL REFERENCES clinica(id),
    paciente_id UUID NOT NULL REFERENCES paciente(id),
    medico_id UUID NOT NULL REFERENCES medico(id),
    especialidade_id UUID NOT NULL REFERENCES especialidade(id),
    consultorio_id UUID NOT NULL REFERENCES consultorio(id),
    inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    fim TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(24) NOT NULL,
    check_in_em TIMESTAMP WITH TIME ZONE,
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (inicio < fim),
    CHECK (status IN ('AGENDADA', 'EM_ESPERA', 'EM_ATENDIMENTO', 'FINALIZADA', 'CANCELADA'))
);

CREATE INDEX ix_agendamento_paciente_inicio
    ON agendamento (paciente_id, inicio DESC, id);

CREATE INDEX ix_agendamento_medico_intervalo
    ON agendamento (clinica_id, medico_id, inicio, fim)
    WHERE status <> 'CANCELADA';

CREATE INDEX ix_agendamento_consultorio_intervalo
    ON agendamento (clinica_id, consultorio_id, inicio, fim)
    WHERE status <> 'CANCELADA';
