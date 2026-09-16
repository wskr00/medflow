CREATE TABLE audit_event (
    id UUID PRIMARY KEY,
    clinica_id UUID,
    actor_kind VARCHAR(20) NOT NULL,
    actor_subject VARCHAR(255),
    action VARCHAR(80) NOT NULL,
    result VARCHAR(20) NOT NULL,
    resource_type VARCHAR(40) NOT NULL,
    resource_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL,
    request_id UUID NOT NULL,
    CONSTRAINT audit_event_actor_kind_check CHECK (actor_kind IN ('ANONIMO', 'AUTENTICADO')),
    CONSTRAINT audit_event_result_check CHECK (result IN ('SUCESSO', 'NEGADO', 'CONFLITO')),
    CONSTRAINT audit_event_action_check CHECK (action IN (
        'ALTERAR_CLINICA',
        'CRIAR_UNIDADE', 'ALTERAR_UNIDADE',
        'CRIAR_CONSULTORIO', 'ALTERAR_CONSULTORIO',
        'CRIAR_ESPECIALIDADE', 'ALTERAR_ESPECIALIDADE',
        'CRIAR_MEDICO', 'ALTERAR_MEDICO',
        'CRIAR_REGRA_AGENDA', 'ALTERAR_REGRA_AGENDA',
        'CRIAR_BLOQUEIO_AGENDA', 'ALTERAR_BLOQUEIO_AGENDA',
        'AGENDAR', 'REAGENDAR', 'CANCELAR', 'REALIZAR_CHECK_IN',
        'INICIAR_ATENDIMENTO', 'SALVAR_REGISTRO_CLINICO', 'FINALIZAR_ATENDIMENTO',
        'LER_REGISTRO_CLINICO', 'CONSULTAR_HISTORICO_CLINICO', 'CONSULTAR_AUDITORIA'
    )),
    CONSTRAINT audit_event_resource_type_check CHECK (resource_type IN (
        'CLINICA', 'UNIDADE', 'CONSULTORIO', 'ESPECIALIDADE', 'MEDICO',
        'REGRA_AGENDA', 'BLOQUEIO_AGENDA', 'AGENDAMENTO', 'ATENDIMENTO',
        'PACIENTE', 'AUDITORIA'
    )),
    CONSTRAINT audit_event_actor_check CHECK (
        (actor_kind = 'ANONIMO' AND actor_subject IS NULL)
        OR (actor_kind = 'AUTENTICADO' AND actor_subject IS NOT NULL AND btrim(actor_subject) <> '')
    )
);

CREATE INDEX idx_audit_event_clinic_time
    ON audit_event (clinica_id, occurred_at DESC, id);
