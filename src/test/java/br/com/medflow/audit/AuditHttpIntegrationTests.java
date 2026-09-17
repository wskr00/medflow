package br.com.medflow.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.medflow.PostgresTestConfiguration;
import br.com.medflow.audit.domain.AuditAction;
import br.com.medflow.audit.domain.AuditActorKind;
import br.com.medflow.audit.domain.AuditEvent;
import br.com.medflow.audit.domain.AuditResult;
import br.com.medflow.audit.persistence.AuditJpaRepository;
import br.com.medflow.care.application.CareService;
import br.com.medflow.care.persistence.AtendimentoRepository;
import br.com.medflow.clinic.application.ClinicConfigurationService;
import br.com.medflow.clinic.application.PatientProvisioningService;
import br.com.medflow.common.auth.AuthenticatedActor;
import br.com.medflow.common.http.RequestIdFilter;
import br.com.medflow.reception.application.ReceptionService;
import br.com.medflow.scheduling.FixedSchedulingClockConfiguration;
import br.com.medflow.scheduling.application.AppointmentService;
import br.com.medflow.scheduling.application.SchedulingConfigurationService;
import br.com.medflow.scheduling.domain.StatusAgendamento;
import br.com.medflow.scheduling.persistence.AgendamentoRepository;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.audit.AuditEventsEndpoint;
import org.springframework.boot.actuate.security.AuthenticationAuditListener;
import org.springframework.boot.actuate.security.AuthorizationAuditListener;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
    "spring.security.oauth2.resourceserver.jwt.issuer-uri=http://issuer.test/realms/medflow",
    "spring.security.oauth2.resourceserver.jwt.jwk-set-uri=http://localhost.invalid/jwks",
    "spring.security.oauth2.resourceserver.jwt.audiences=medflow-api"
})
@AutoConfigureMockMvc
@Import({PostgresTestConfiguration.class, FixedSchedulingClockConfiguration.class})
class AuditHttpIntegrationTests {

  private static final LocalDate TODAY = LocalDate.of(2026, 9, 16);
  private static final ZoneId BELEM = ZoneId.of("America/Belem");
  private static final AtomicInteger IDS = new AtomicInteger();

  @Autowired private MockMvc mvc;
  @Autowired private ClinicConfigurationService clinic;
  @Autowired private PatientProvisioningService provisioning;
  @Autowired private SchedulingConfigurationService scheduling;
  @Autowired private AppointmentService appointments;
  @Autowired private ReceptionService reception;
  @Autowired private CareService care;
  @Autowired private AtendimentoRepository careRepository;
  @Autowired private AgendamentoRepository appointmentRepository;
  @Autowired private AuditJpaRepository auditEvents;
  @Autowired private org.springframework.boot.actuate.audit.AuditEventRepository springAuditEvents;
  @Autowired private ApplicationContext applicationContext;
  @Autowired private JdbcTemplate jdbc;
  @MockitoBean private JwtDecoder jwtDecoder;

  @BeforeEach
  void clearAudit() {
    jdbc.update("delete from audit_event");
  }

  @AfterEach
  void removeFailureTrigger() {
    jdbc.execute("drop trigger if exists audit_test_failure on audit_event");
    jdbc.execute("drop function if exists audit_test_failure()");
  }

  @Test
  void configurationMutationsPersistEnumeratedSuccessesWithTrustedActor() throws Exception {
    Fixture fixture = fixture("config-success");
    var block = scheduling.criarBloqueio(new SchedulingConfigurationService.BloqueioCommand(
        fixture.doctor().medicoId(), offset(15).toInstant(), offset(16).toInstant(), false, 0));
    var singleton = clinic.clinica();
    clearAudit();
    var admin = principal("admin-audit-config", "ADMINISTRATOR");
    String suffix = "-" + IDS.incrementAndGet();

    mvc.perform(put("/api/clinica").with(admin).contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"nome":"%s","timeZone":"%s","ativo":%s,"expectedVersion":%d}
                """.formatted(singleton.nome(), singleton.timeZone(), singleton.ativo(), singleton.version())))
        .andExpect(status().isOk());
    mvc.perform(post("/api/unidades").with(admin).contentType(MediaType.APPLICATION_JSON)
            .content("{\"nome\":\"Unidade nova%s\",\"endereco\":\"Endereço\",\"ativo\":true}".formatted(suffix)))
        .andExpect(status().isCreated());
    mvc.perform(put("/api/unidades/" + fixture.unitId()).with(admin).contentType(MediaType.APPLICATION_JSON)
            .content("{\"nome\":\"Unidade atualizada%s\",\"endereco\":\"Endereço\",\"ativo\":true,\"expectedVersion\":0}".formatted(suffix)))
        .andExpect(status().isOk());
    mvc.perform(post("/api/consultorios").with(admin).contentType(MediaType.APPLICATION_JSON)
            .content("{\"unidadeId\":\"%s\",\"nome\":\"Sala nova%s\",\"ativo\":true}"
                .formatted(fixture.unitId(), suffix)))
        .andExpect(status().isCreated());
    mvc.perform(put("/api/consultorios/" + fixture.roomId()).with(admin).contentType(MediaType.APPLICATION_JSON)
            .content("{\"unidadeId\":\"%s\",\"nome\":\"Sala atualizada%s\",\"ativo\":true,\"expectedVersion\":0}"
                .formatted(fixture.unitId(), suffix)))
        .andExpect(status().isOk());
    mvc.perform(post("/api/especialidades").with(admin).contentType(MediaType.APPLICATION_JSON)
            .content("{\"nome\":\"Especialidade nova%s\",\"ativo\":true}".formatted(suffix)))
        .andExpect(status().isCreated());
    mvc.perform(put("/api/especialidades/" + fixture.specialtyId()).with(admin)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nome\":\"Especialidade atualizada%s\",\"ativo\":true,\"expectedVersion\":0}"
                .formatted(suffix)))
        .andExpect(status().isOk());
    mvc.perform(post("/api/medicos").with(admin).contentType(MediaType.APPLICATION_JSON)
            .content("{\"nome\":\"Médico novo%s\",\"crmNumero\":\"%d\",\"crmUf\":\"PA\",\"especialidadeIds\":[\"%s\"],\"ativo\":true}"
                .formatted(suffix, 700000 + IDS.incrementAndGet(), fixture.specialtyId())))
        .andExpect(status().isCreated());
    mvc.perform(put("/api/medicos/" + fixture.doctor().medicoId()).with(admin)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nome\":\"Médico atualizado%s\",\"crmNumero\":\"%s\",\"crmUf\":\"PA\",\"especialidadeIds\":[\"%s\"],\"ativo\":true,\"expectedVersion\":1}"
                .formatted(suffix, fixture.crm(), fixture.specialtyId())))
        .andExpect(status().isOk());
    mvc.perform(post("/api/regras-agenda").with(admin).contentType(MediaType.APPLICATION_JSON)
            .content(ruleJson(fixture, false, null)))
        .andExpect(status().isCreated());
    mvc.perform(put("/api/regras-agenda/" + fixture.ruleId()).with(admin)
            .contentType(MediaType.APPLICATION_JSON).content(ruleJson(fixture, true, 0L)))
        .andExpect(status().isOk());
    mvc.perform(post("/api/bloqueios-agenda").with(admin).contentType(MediaType.APPLICATION_JSON)
            .content(blockJson(fixture.doctor().medicoId(), false, null)))
        .andExpect(status().isCreated());
    mvc.perform(put("/api/bloqueios-agenda/" + block.id()).with(admin)
            .contentType(MediaType.APPLICATION_JSON)
            .content(blockJson(fixture.doctor().medicoId(), false, 0L)))
        .andExpect(status().isOk());

    Set<AuditAction> expected = Set.of(AuditAction.ALTERAR_CLINICA,
        AuditAction.CRIAR_UNIDADE, AuditAction.ALTERAR_UNIDADE,
        AuditAction.CRIAR_CONSULTORIO, AuditAction.ALTERAR_CONSULTORIO,
        AuditAction.CRIAR_ESPECIALIDADE, AuditAction.ALTERAR_ESPECIALIDADE,
        AuditAction.CRIAR_MEDICO, AuditAction.ALTERAR_MEDICO,
        AuditAction.CRIAR_REGRA_AGENDA, AuditAction.ALTERAR_REGRA_AGENDA,
        AuditAction.CRIAR_BLOQUEIO_AGENDA, AuditAction.ALTERAR_BLOQUEIO_AGENDA);
    List<AuditEvent> persisted = auditEvents.findAll();
    assertThat(persisted).hasSize(expected.size());
    assertThat(persisted).extracting(AuditEvent::action).containsExactlyInAnyOrderElementsOf(expected);
    assertThat(persisted).allSatisfy(event -> {
      assertThat(event.result()).isEqualTo(AuditResult.SUCESSO);
      assertThat(event.actorKind()).isEqualTo(AuditActorKind.AUTENTICADO);
      assertThat(event.actorSubject()).isEqualTo("admin-audit-config");
      assertThat(event.clinicaId()).isEqualTo(singleton.id());
      assertThat(event.requestId()).isNotNull();
    });
  }

  @Test
  void appointmentAndCareFlowAuditsOnlyEffectiveMutationsAndClinicalReads() throws Exception {
    Fixture fixture = fixture("workflow-success");
    clearAudit();
    var patient = principal(fixture.patient().subject(), "PATIENT");
    var receptionist = principal(fixture.receptionist().subject(), "RECEPTIONIST");
    var doctor = principal(fixture.doctor().subject(), "DOCTOR");

    MvcResult created = mvc.perform(post("/api/agendamentos").with(patient)
            .contentType(MediaType.APPLICATION_JSON).content(createJson(fixture.ruleId(), 10, 0)))
        .andExpect(status().isCreated()).andReturn();
    UUID appointmentId = idFromLocation(created);
    String createRequestId = created.getResponse().getHeader(RequestIdFilter.HEADER);

    mvc.perform(post("/api/agendamentos/" + appointmentId + "/reagendamento").with(patient)
            .contentType(MediaType.APPLICATION_JSON)
            .content(rescheduleJson(fixture.ruleId(), 10, 0, 0)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(0));
    assertThat(events(AuditAction.REAGENDAR, AuditResult.SUCESSO)).isEmpty();

    mvc.perform(post("/api/agendamentos/" + appointmentId + "/reagendamento").with(patient)
            .contentType(MediaType.APPLICATION_JSON)
            .content(rescheduleJson(fixture.ruleId(), 10, 30, 0)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
    mvc.perform(post("/api/agendamentos/" + appointmentId + "/cancelamento").with(patient)
            .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":1}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELADA"));

    MvcResult careAppointment = mvc.perform(post("/api/agendamentos").with(patient)
            .contentType(MediaType.APPLICATION_JSON).content(createJson(fixture.ruleId(), 11, 0)))
        .andExpect(status().isCreated()).andReturn();
    UUID careAppointmentId = idFromLocation(careAppointment);
    mvc.perform(post("/api/agendamentos/" + careAppointmentId + "/check-in").with(receptionist)
            .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":0}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("EM_ESPERA"));
    mvc.perform(post("/api/agendamentos/" + careAppointmentId + "/atendimento").with(doctor)
            .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":1}"))
        .andExpect(status().isCreated());
    UUID careId = careRepository.findByAgendamentoId(careAppointmentId).orElseThrow().id();
    String marker = "SEGREDO-CLINICO-AUDIT-" + IDS.incrementAndGet();
    mvc.perform(put("/api/atendimentos/" + careId + "/registro-clinico").with(doctor)
            .contentType(MediaType.APPLICATION_JSON).content("""
                {"expectedVersion":0,"queixaPrincipal":"%s","resumoAnamnese":"Resumo",
                 "conduta":"Conduta","observacoes":"Observações"}
                """.formatted(marker)))
        .andExpect(status().isOk());
    mvc.perform(get("/api/atendimentos/" + careId).with(doctor))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.atendimento.registroClinico.queixaPrincipal").value(marker));
    mvc.perform(post("/api/atendimentos/" + careId + "/finalizacao").with(doctor)
            .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":1}"))
        .andExpect(status().isOk());
    mvc.perform(get("/api/medico/pacientes/" + fixture.patient().pacienteId()
            + "/historico?page=0&size=10").with(doctor))
        .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));

    Map<AuditAction, Long> counts = auditEvents.findAll().stream()
        .collect(Collectors.groupingBy(AuditEvent::action, Collectors.counting()));
    assertThat(counts).containsEntry(AuditAction.AGENDAR, 2L)
        .containsEntry(AuditAction.REAGENDAR, 1L)
        .containsEntry(AuditAction.CANCELAR, 1L)
        .containsEntry(AuditAction.REALIZAR_CHECK_IN, 1L)
        .containsEntry(AuditAction.INICIAR_ATENDIMENTO, 1L)
        .containsEntry(AuditAction.SALVAR_REGISTRO_CLINICO, 1L)
        .containsEntry(AuditAction.LER_REGISTRO_CLINICO, 1L)
        .containsEntry(AuditAction.FINALIZAR_ATENDIMENTO, 1L)
        .containsEntry(AuditAction.CONSULTAR_HISTORICO_CLINICO, 1L);
    assertThat(events(AuditAction.AGENDAR, AuditResult.SUCESSO).stream()
        .filter(event -> event.resourceId().equals(appointmentId)).findFirst().orElseThrow().requestId())
        .hasToString(createRequestId);
    assertThat(auditRowsAsText()).noneMatch(row -> row.contains(marker));
  }

  @Test
  void denialsAndConflictsSurviveRollbackWithoutFalseSuccess() throws Exception {
    Fixture fixture = fixture("failures");
    var scheduled = appointments.criar(fixture.patient(), fixture.ruleId(), offset(12));
    clearAudit();
    var patient = principal(fixture.patient().subject(), "PATIENT");
    var doctor = principal(fixture.doctor().subject(), "DOCTOR");
    UUID missingForDoctor = UUID.randomUUID();
    UUID missingForAdmin = UUID.randomUUID();
    UUID missingAnonymous = UUID.randomUUID();

    MvcResult conflict = mvc.perform(post("/api/agendamentos/" + scheduled.id() + "/cancelamento")
            .with(patient).contentType(MediaType.APPLICATION_JSON)
            .content("{\"expectedVersion\":99}"))
        .andExpect(status().isConflict()).andReturn();
    MvcResult notFound = mvc.perform(get("/api/atendimentos/" + missingForDoctor).with(doctor))
        .andExpect(status().isNotFound()).andReturn();
    MvcResult forbidden = mvc.perform(get("/api/atendimentos/" + missingForAdmin)
            .with(principal("admin-denied-audit", "ADMINISTRATOR")))
        .andExpect(status().isForbidden()).andReturn();
    MvcResult unauthorized = mvc.perform(get("/api/atendimentos/" + missingAnonymous))
        .andExpect(status().isUnauthorized()).andReturn();

    assertThat(appointmentRepository.findById(scheduled.id()).orElseThrow().status())
        .isEqualTo(StatusAgendamento.AGENDADA);
    assertThat(events(AuditAction.CANCELAR, AuditResult.SUCESSO)).isEmpty();
    AuditEvent conflictEvent = only(AuditAction.CANCELAR, AuditResult.CONFLITO, scheduled.id());
    assertThat(conflictEvent.requestId()).hasToString(
        conflict.getResponse().getHeader(RequestIdFilter.HEADER));
    AuditEvent notFoundEvent = only(AuditAction.LER_REGISTRO_CLINICO,
        AuditResult.NEGADO, missingForDoctor);
    assertThat(notFoundEvent.requestId()).hasToString(
        notFound.getResponse().getHeader(RequestIdFilter.HEADER));
    AuditEvent forbiddenEvent = only(AuditAction.LER_REGISTRO_CLINICO,
        AuditResult.NEGADO, missingForAdmin);
    assertThat(forbiddenEvent.requestId()).hasToString(
        forbidden.getResponse().getHeader(RequestIdFilter.HEADER));
    AuditEvent anonymous = only(AuditAction.LER_REGISTRO_CLINICO,
        AuditResult.NEGADO, missingAnonymous);
    assertThat(anonymous.actorKind()).isEqualTo(AuditActorKind.ANONIMO);
    assertThat(anonymous.actorSubject()).isNull();
    assertThat(anonymous.clinicaId()).isNull();
    assertThat(anonymous.requestId()).hasToString(
        unauthorized.getResponse().getHeader(RequestIdFilter.HEADER));

    installFailureTrigger("NEGADO");
    mvc.perform(get("/api/atendimentos/" + UUID.randomUUID()).with(doctor))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"));
  }

  @Test
  void successAuditFailureRollsBackMutationAndPreventsClinicalResponse() throws Exception {
    Fixture fixture = fixture("writer-failure");
    var scheduled = appointments.criar(fixture.patient(), fixture.ruleId(), offset(11));
    var waiting = reception.checkIn(fixture.receptionist(), scheduled.id(), scheduled.version());
    var started = care.start(fixture.doctor(), waiting.id(), waiting.version());
    String marker = "SEGREDO-NAO-ENTREGAR-" + IDS.incrementAndGet();
    care.saveDraft(fixture.doctor(), started.atendimento().id(), 0,
        marker, "Resumo", "Conduta", "Observações");
    clearAudit();
    installFailureTrigger("SUCESSO");

    String unitName = "Unidade rollback audit " + IDS.incrementAndGet();
    mvc.perform(post("/api/unidades").with(principal("admin-writer-failure", "ADMINISTRATOR"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nome\":\"%s\",\"endereco\":\"Endereço\",\"ativo\":true}"
                .formatted(unitName)))
        .andExpect(status().isInternalServerError());
    assertThat(jdbc.queryForObject("select count(*) from unidade where nome = ?", Long.class, unitName))
        .isZero();

    mvc.perform(get("/api/atendimentos/" + started.atendimento().id())
            .with(principal(fixture.doctor().subject(), "DOCTOR")))
        .andExpect(status().isInternalServerError())
        .andExpect(content().string(not(containsString(marker))));
    assertThat(auditEvents.count()).isZero();
  }

  @Test
  void administrativeQueryIsScopedPagedBoundedAndAuditsItselfOnce() throws Exception {
    UUID clinicId = clinic.clinica().id();
    UUID fakeClinicId = UUID.randomUUID();
    insertAudit(clinicId, Instant.parse("2026-09-16T11:00:00Z"), AuditAction.AGENDAR);
    insertAudit(clinicId, Instant.parse("2026-09-16T10:00:00Z"), AuditAction.CANCELAR);
    insertAudit(clinicId, Instant.parse("2026-09-15T10:00:00Z"), AuditAction.REAGENDAR);
    insertAudit(fakeClinicId, Instant.parse("2026-09-16T11:30:00Z"), AuditAction.AGENDAR);
    var admin = principal("admin-audit-query", "ADMINISTRATOR");

    MvcResult page = mvc.perform(get("/api/auditoria?dataDe=2026-09-15&dataAte=2026-09-16&page=0&size=2")
            .with(admin))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.page").value(0))
        .andExpect(jsonPath("$.size").value(2))
        .andExpect(jsonPath("$.totalElements").value(3))
        .andExpect(jsonPath("$.items[0].action").value("AGENDAR"))
        .andExpect(jsonPath("$.items[1].action").value("CANCELAR"))
        .andExpect(jsonPath("$.items[0].roles").doesNotExist())
        .andExpect(jsonPath("$.items[0].uri").doesNotExist())
        .andReturn();
    List<AuditEvent> queryEvents = events(
        AuditAction.CONSULTAR_AUDITORIA, AuditResult.SUCESSO);
    assertThat(queryEvents).hasSize(1);
    assertThat(queryEvents.getFirst().requestId()).hasToString(
        page.getResponse().getHeader(RequestIdFilter.HEADER));

    mvc.perform(get("/api/auditoria?dataDe=2026-09-01&dataAte=2026-10-01&page=0&size=100")
            .with(admin))
        .andExpect(status().isOk());
    mvc.perform(get("/api/auditoria?dataDe=2026-09-01&dataAte=2026-10-02")
            .with(admin))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/auditoria?dataDe=2026-09-15&dataAte=2026-09-16&size=101")
            .with(admin))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/auditoria?dataDe=2026-09-15&dataAte=2026-09-16")
            .with(principal("doctor-no-audit-query", "DOCTOR")))
        .andExpect(status().isForbidden());

    assertThat(events(AuditAction.CONSULTAR_AUDITORIA, AuditResult.SUCESSO)).hasSize(2);
    assertThat(events(AuditAction.CONSULTAR_AUDITORIA, AuditResult.NEGADO)).hasSize(1);
    assertThat(auditEvents.findAll()).filteredOn(event -> fakeClinicId.equals(event.clinicaId()))
        .hasSize(1);
  }

  @Test
  void bearerFailuresAreSanitizedDeduplicatedAndNativeActuatorEndpointIsDisabled()
      throws Exception {
    UUID malformedId = UUID.randomUUID();
    UUID invalidSignatureId = UUID.randomUUID();
    UUID expiredId = UUID.randomUUID();
    UUID wrongRoleId = UUID.randomUUID();
    String malformedMarker = "MALFORMED-SECRET-" + IDS.incrementAndGet();
    String signatureMarker = "SIGNATURE-SECRET-" + IDS.incrementAndGet();
    String expiredMarker = "EXPIRED-SECRET-" + IDS.incrementAndGet();
    given(jwtDecoder.decode("malformed-token"))
        .willThrow(new BadJwtException(malformedMarker));
    given(jwtDecoder.decode("invalid-signature-token"))
        .willThrow(new BadJwtException(signatureMarker));
    given(jwtDecoder.decode("expired-token")).willThrow(new JwtValidationException(
        expiredMarker, List.of(new OAuth2Error("invalid_token", expiredMarker, null))));
    given(jwtDecoder.decode("wrong-role-token"))
        .willReturn(token("bearer-admin-denied", "ADMINISTRATOR"));

    mvc.perform(get("/api/atendimentos/" + malformedId)
            .header("Authorization", "Bearer malformed-token"))
        .andExpect(status().isUnauthorized())
        .andExpect(content().string(not(containsString(malformedMarker))));
    mvc.perform(get("/api/atendimentos/" + invalidSignatureId)
            .header("Authorization", "Bearer invalid-signature-token"))
        .andExpect(status().isUnauthorized())
        .andExpect(content().string(not(containsString(signatureMarker))));
    mvc.perform(get("/api/atendimentos/" + expiredId)
            .header("Authorization", "Bearer expired-token"))
        .andExpect(status().isUnauthorized())
        .andExpect(content().string(not(containsString(expiredMarker))));
    mvc.perform(get("/api/atendimentos/" + wrongRoleId)
            .header("Authorization", "Bearer wrong-role-token"))
        .andExpect(status().isForbidden());

    assertThat(auditEvents.findAll()).filteredOn(event ->
        event.result() == AuditResult.NEGADO && malformedId.equals(event.resourceId()))
        .hasSize(1);
    assertThat(auditEvents.findAll()).filteredOn(event ->
        event.result() == AuditResult.NEGADO && invalidSignatureId.equals(event.resourceId()))
        .hasSize(1);
    assertThat(auditEvents.findAll()).filteredOn(event ->
        event.result() == AuditResult.NEGADO && expiredId.equals(event.resourceId()))
        .hasSize(1);
    assertThat(auditEvents.findAll()).filteredOn(event ->
        event.result() == AuditResult.NEGADO && wrongRoleId.equals(event.resourceId()))
        .singleElement().satisfies(event -> {
          assertThat(event.actorKind()).isEqualTo(AuditActorKind.AUTENTICADO);
          assertThat(event.actorSubject()).isEqualTo("bearer-admin-denied");
        });
    assertThat(auditRowsAsText()).noneMatch(row -> row.contains(malformedMarker)
        || row.contains(signatureMarker)
        || row.contains(expiredMarker) || row.contains("invalid-signature-token")
        || row.contains("malformed-token") || row.contains("expired-token")
        || row.contains("wrong-role-token"));
    assertThat(applicationContext.getBeansOfType(AuthenticationAuditListener.class)).isEmpty();
    assertThat(applicationContext.getBeansOfType(AuthorizationAuditListener.class)).isEmpty();
    assertThat(applicationContext.getBeansOfType(AuditEventsEndpoint.class)).isEmpty();
  }

  @Test
  void actuatorRepositoryPersistsOnlyAllowlistedMetadata() {
    UUID requestId = UUID.randomUUID();
    String sensitive = "AUTHORIZATION-DETAIL-" + IDS.incrementAndGet();
    springAuditEvents.add(new org.springframework.boot.actuate.audit.AuditEvent(
        FixedSchedulingClockConfiguration.NOW, "framework-principal", "AUTHENTICATION_FAILURE",
        Map.of("details", sensitive, "message", sensitive)));
    assertThat(auditEvents.count()).isZero();

    springAuditEvents.add(new org.springframework.boot.actuate.audit.AuditEvent(
        FixedSchedulingClockConfiguration.NOW, "safe-subject", AuditAction.CANCELAR.name(),
        Map.of("actorKind", "AUTENTICADO", "clinicId", clinic.clinica().id().toString(),
            "result", "CONFLITO", "resourceType", "AGENDAMENTO",
            "resourceId", UUID.randomUUID().toString(), "requestId", requestId.toString(),
            "details", sensitive, "message", sensitive)));

    assertThat(auditEvents.findAll()).singleElement().satisfies(event -> {
      assertThat(event.action()).isEqualTo(AuditAction.CANCELAR);
      assertThat(event.result()).isEqualTo(AuditResult.CONFLITO);
      assertThat(event.requestId()).isEqualTo(requestId);
    });
    assertThat(auditRowsAsText()).noneMatch(row -> row.contains(sensitive));
  }

  private Fixture fixture(String name) {
    String suffix = name + "-" + IDS.incrementAndGet();
    var specialty = clinic.criarEspecialidade("Especialidade " + suffix, true);
    var unit = clinic.criarUnidade("Unidade " + suffix, "Endereço", true);
    var room = clinic.criarConsultorio(unit.id(), "Sala " + suffix, true);
    String crm = Integer.toString(600000 + IDS.incrementAndGet());
    var doctorEntity = clinic.criarMedico("Médico " + suffix, crm, "PA",
        List.of(specialty.id()), true);
    String doctorSubject = "doctor-" + suffix;
    doctorEntity = clinic.provisionarSubjectMedico(doctorEntity.id(), doctorSubject);
    var rule = scheduling.criarRegra(new SchedulingConfigurationService.RegraCommand(
        doctorEntity.id(), specialty.id(), room.id(), DayOfWeek.WEDNESDAY,
        LocalTime.of(10, 0), LocalTime.of(14, 0), 30, TODAY, TODAY, true, 0));
    String patientSubject = "patient-" + suffix;
    var patientEntity = provisioning.provisionar(patientSubject, "Paciente " + suffix);
    var singleton = clinic.clinica();
    var patient = new AuthenticatedActor(patientSubject, Set.of("PATIENT"), patientEntity.id(),
        null, singleton.id(), singleton.timeZone());
    var doctor = new AuthenticatedActor(doctorSubject, Set.of("DOCTOR"), null,
        doctorEntity.id(), singleton.id(), singleton.timeZone());
    var receptionist = new AuthenticatedActor("reception-" + suffix, Set.of("RECEPTIONIST"),
        null, null, singleton.id(), singleton.timeZone());
    return new Fixture(rule.id(), specialty.id(), unit.id(), room.id(), crm,
        patient, doctor, receptionist);
  }

  private String ruleJson(Fixture fixture, boolean active, Long version) {
    String expected = version == null ? "" : ",\"expectedVersion\":" + version;
    return "{\"medicoId\":\"%s\",\"especialidadeId\":\"%s\",\"consultorioId\":\"%s\","
        .formatted(fixture.doctor().medicoId(), fixture.specialtyId(), fixture.roomId())
        + "\"diaSemana\":3,\"horaInicio\":\"10:00:00\",\"horaFim\":\"14:00:00\","
        + "\"duracaoMinutos\":30,\"vigenteDe\":\"2026-09-16\",\"vigenteAte\":\"2026-09-16\","
        + "\"ativo\":" + active + expected + "}";
  }

  private String blockJson(UUID doctorId, boolean active, Long version) {
    String expected = version == null ? "" : ",\"expectedVersion\":" + version;
    return "{\"medicoId\":\"%s\",\"inicio\":\"2026-09-16T15:00:00\","
        .formatted(doctorId)
        + "\"fim\":\"2026-09-16T16:00:00\",\"ativo\":" + active + expected + "}";
  }

  private static String createJson(UUID ruleId, int hour, int minute) {
    return "{\"regraAgendaId\":\"%s\",\"inicio\":\"%s\"}"
        .formatted(ruleId, local(hour, minute));
  }

  private static String rescheduleJson(UUID ruleId, int hour, int minute, long version) {
    return "{\"regraAgendaId\":\"%s\",\"inicio\":\"%s\",\"expectedVersion\":%d}"
        .formatted(ruleId, local(hour, minute), version);
  }

  private static String local(int hour, int minute) {
    return TODAY.atTime(hour, minute).atZone(BELEM).toOffsetDateTime().toString();
  }

  private static OffsetDateTime offset(int hour) {
    return TODAY.atTime(hour, 0).atZone(BELEM).toOffsetDateTime();
  }

  private static UUID idFromLocation(MvcResult result) {
    String location = result.getResponse().getHeader("Location");
    return UUID.fromString(location.substring(location.lastIndexOf('/') + 1));
  }

  private List<AuditEvent> events(AuditAction action, AuditResult result) {
    return auditEvents.findAll().stream()
        .filter(event -> event.action() == action && event.result() == result).toList();
  }

  private AuditEvent only(AuditAction action, AuditResult result, UUID resourceId) {
    List<AuditEvent> matching = auditEvents.findAll().stream()
        .filter(event -> event.action() == action && event.result() == result)
        .filter(event -> resourceId.equals(event.resourceId()))
        .toList();
    assertThat(matching).hasSize(1);
    return matching.getFirst();
  }

  private List<String> auditRowsAsText() {
    return jdbc.query("select row_to_json(a)::text from audit_event a",
        (resultSet, row) -> resultSet.getString(1));
  }

  private void installFailureTrigger(String result) {
    jdbc.execute("""
        create function audit_test_failure() returns trigger language plpgsql as $$
        begin
          if new.result = '%s' then
            raise exception 'audit unavailable';
          end if;
          return new;
        end
        $$
        """.formatted(result));
    jdbc.execute("""
        create trigger audit_test_failure before insert on audit_event
        for each row execute function audit_test_failure()
        """);
  }

  private void insertAudit(UUID clinicId, Instant occurredAt, AuditAction action) {
    jdbc.update("""
        insert into audit_event
          (id, clinica_id, actor_kind, actor_subject, action, result,
           resource_type, resource_id, occurred_at, request_id)
        values (?, ?, 'AUTENTICADO', 'seed-subject', ?, 'SUCESSO',
                'AGENDAMENTO', ?, ?, ?)
        """, UUID.randomUUID(), clinicId, action.name(), UUID.randomUUID(),
        Timestamp.from(occurredAt), UUID.randomUUID());
  }

  private static RequestPostProcessor principal(String subject, String... roles) {
    List<GrantedAuthority> authorities = Arrays.stream(roles)
        .map(role -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + role)).toList();
    return jwt().jwt(token(subject, roles)).authorities(authorities);
  }

  private static Jwt token(String subject, String... roles) {
    return Jwt.withTokenValue("synthetic").header("alg", "none").subject(subject)
        .issuer("http://issuer.test/realms/medflow").audience(List.of("medflow-api"))
        .issuedAt(Instant.parse("2026-09-16T11:00:00Z"))
        .expiresAt(Instant.parse("2026-09-16T13:00:00Z"))
        .claim("resource_access", Map.of("medflow-api", Map.of("roles", List.of(roles))))
        .build();
  }

  private record Fixture(UUID ruleId, UUID specialtyId, UUID unitId, UUID roomId,
      String crm, AuthenticatedActor patient, AuthenticatedActor doctor,
      AuthenticatedActor receptionist) { }
}
