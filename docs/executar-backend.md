# Executar e verificar a base HTTP do backend

Esta base técnica atende à Issue #27, em apoio a RNF001, RNF008 e RNF009.
Não implementa regras de negócio, migrations de domínio nem integração com
Keycloak. Autenticação, autorização e respostas 401/403 dos filtros são
integradas pela Issue #9.

## Pré-requisitos e datasource

Usar JDK 25 e o Gradle Wrapper do repositório. O Java padrão do terminal pode
ser diferente: conferir `java -version` e configurar `JAVA_HOME` para seu JDK 25.
PostgreSQL 18 deve estar disponível antes dos testes que sobem o contexto completo.

O datasource exige estas variáveis, sem senha ou endereço de banco real no código:

| Variável | Finalidade |
|---|---|
| `MEDFLOW_DB_URL` | URL JDBC, por exemplo `jdbc:postgresql://localhost:55427/medflow` |
| `MEDFLOW_DB_USERNAME` | Usuário do PostgreSQL |
| `MEDFLOW_DB_PASSWORD` | Senha do PostgreSQL |

Exemplo local isolado, com credencial exclusivamente sintética e porta de
loopback. Não reutilizar este container para dados reais. Se o nome ou a porta
já estiverem ocupados, identificar o ambiente existente antes de iniciar outro.

```bash
docker run --detach --name medflow-issue27-postgres \
  --publish 127.0.0.1:55427:5432 \
  --env POSTGRES_DB=medflow --env POSTGRES_USER=medflow \
  --env POSTGRES_PASSWORD=medflow-local-test postgres:18
docker exec medflow-issue27-postgres pg_isready -U medflow -d medflow
```

Após o banco indicar que aceita conexões:

```bash
export JAVA_HOME=/usr/lib/jvm/java-25-openjdk # adaptar ao caminho local
export MEDFLOW_DB_URL=jdbc:postgresql://localhost:55427/medflow
export MEDFLOW_DB_USERNAME=medflow
export MEDFLOW_DB_PASSWORD=medflow-local-test
export SPRING_DOCKER_COMPOSE_ENABLED=false
./gradlew clean build
./gradlew bootRun --args='--spring.profiles.active=dev'
```

O profile `dev` aplica, além do esquema, os vínculos locais sintéticos e idempotentes
dos subjects fixos do realm: paciente `20000000-0000-0000-0000-000000000001` e médico
`20000000-0000-0000-0000-000000000003`. Eles não são email, username ou credenciais e
não são expostos pelo CRUD administrativo. Os IDs locais correspondentes começam em
`30000000-...`; o script fica em `db/devdata` e não é aplicado sem o profile.

Desabilitar a integração automática com Compose nesse procedimento evita que
ela inicie outros serviços ou substitua a conexão JDBC explícita por service
connections. O Compose compartilhado e o realm pertencem ao procedimento da
Issue #9. Nenhum segredo real deve ser versionado. Para parar apenas este banco
sintético, usar `docker stop medflow-issue27-postgres`; `docker start` o retoma.

## Contrato HTTP

`GET /actuator/health` usa o endpoint nativo do Spring Boot Actuator, já presente
no projeto, sem controller próprio. A resposta pública deve manter apenas o
estado agregado, sem detalhes de componentes. O acesso anônimo ao health é
coordenado em #9; não desabilitar filtros para acessar o endpoint.

Todo request recebe um UUID próprio do servidor em `X-Request-Id`. O cabeçalho
recebido do cliente é ignorado. A correlação fica no atributo interno
`RequestIdFilter.ATTRIBUTE` e no MDC `requestId` enquanto a cadeia executa;
o contexto anterior é restaurado ao final, inclusive em falhas. Handlers de
segurança podem usar `RequestIdFilter.requestId(request)` e o record `ApiError`
de `br.com.medflow.common.http`.

Erros MVC seguem o contrato:

```json
{
  "status": 400,
  "code": "ENTRADA_INVALIDA",
  "message": "Verifique os dados enviados.",
  "requestId": "UUID gerado pelo servidor",
  "fieldErrors": [{"field": "nome", "code": "CAMPO_INVALIDO", "message": "Valor inválido."}]
}
```

Campos inválidos nunca incluem valores rejeitados nem mensagens de validação
que possam interpolar conteúdo sensível. JSON malformado e conversão inválida
resultam em 400. Rotas inexistentes permanecem 404, método inadequado 405
(preservando `Allow`), mídia inadequada 415. Esses erros de protocolo acrescentam
os códigos `METODO_NAO_PERMITIDO`, `RESPOSTA_NAO_ACEITAVEL` e
`TIPO_DE_CONTEUDO_NAO_SUPORTADO` ao envelope comum. Falhas inesperadas retornam
500 `ERRO_INTERNO`; logs próprios registram somente correlação e tipo da falha,
sem mensagem da exceção, SQL, stacktrace ou corpo HTTP. Exceções de autenticação
e acesso são preservadas para os handlers de segurança, não convertidas em 500.

## Verificações reproduzíveis

Sem banco ou servidor externo, executa-se a verificação HTTP/MVC isolada:

```bash
./gradlew test --tests 'br.com.medflow.common.http.*'
```

O teste `beanValidationReturnsSafe400WithMatchingRequestId` envia JSON inválido
a um controller presente **somente em `src/test`**. Exercita desserialização,
Bean Validation, advice e filtro de correlação reais do Spring MVC. Não cria
endpoint de demonstração no produto. A configuração standalone não carrega
filtros de autenticação; por isso esses testes não são evidência de IAM.

Com as variáveis e PostgreSQL acima, `./gradlew clean build` executa também
`contextLoads` e `HealthHttpIntegrationTests`. Este último usa o contexto real,
cadeia de filtros registrada e usuário simulado autenticado (`WithMockUser`),
sem substituir a configuração de segurança. Não comprova login ou JWT real.

Relatórios locais: `build/reports/tests/test/index.html` e XML em
`build/test-results/test/`. Nenhum resultado de desempenho, autorização
contextual ou fluxo clínico é declarado por estas verificações.
