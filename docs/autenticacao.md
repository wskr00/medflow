# Autenticação do MedFlow

Esta entrega implementa a base de autenticação da Issue #9. Ela não implementa
as regras contextuais de propriedade de recursos, que pertencem à Issue #11.

## Componentes e responsabilidades

- O Keycloak autentica usuários e emite tokens para os quatro perfis do MVP.
- O Angular usa `provideKeycloak` do `keycloak-angular`; a própria biblioteca
  inicializa o adapter, renova tokens e inclui o Bearer nas chamadas da API.
- O Spring Security Resource Server valida assinatura, emissor, expiração e
  audiência a partir das propriedades nativas `issuer-uri` e `audiences`.
- O converter do MedFlow lê apenas os client roles de `medflow-api` e aceita
  `PATIENT`, `RECEPTIONIST`, `DOCTOR` e `ADMINISTRATOR`.
- `GET /api/me` devolve subject, perfis e vínculos locais. Os vínculos são
  `null` até o modelo da clínica ser implementado; e-mail não é usado como chave.

Não existe filtro JWT próprio. A `SecurityFilterChain` apenas declara API
stateless, desabilita CSRF e request cache para o Resource Server, libera
`/actuator/health` e exige autenticação no restante. Os handlers próprios de
401/403 existem somente para preservar o envelope `ApiError`. A configuração é
segura por padrão e não depende de ativar um profile. O
`RequestIdFilter` é correlação HTTP e não participa da autenticação.

## Realm local

O Compose importa `docker/keycloak/medflow-realm.json` no Keycloak 26.7.3. O
client público `medflow-web` usa Authorization Code com PKCE S256 e não possui
segredo. `medflow-api` representa a audiência protegida. Usuários e senhas do
realm são exclusivamente sintéticos:

| Usuário | Senha local | Perfil |
|---|---|---|
| `paciente` | `paciente` | `PATIENT` |
| `paciente.helena` | `paciente` | `PATIENT` |
| `paciente.caio` | `paciente` | `PATIENT` |
| `paciente.beatriz` | `paciente` | `PATIENT` |
| `paciente.daniel` | `paciente` | `PATIENT` |
| `paciente.elisa` | `paciente` | `PATIENT` |
| `paciente.felipe` | `paciente` | `PATIENT` |
| `recepcionista` | `recepcionista` | `RECEPTIONIST` |
| `recepcionista.julia` | `recepcionista` | `RECEPTIONIST` |
| `recepcionista.pedro` | `recepcionista` | `RECEPTIONIST` |
| `medico` | `medico` | `DOCTOR` |
| `medico.ana` | `medico` | `DOCTOR` |
| `medico.luiz` | `medico` | `DOCTOR` |
| `medico.sofia` | `medico` | `DOCTOR` |
| `medico.rafael` | `medico` | `DOCTOR` |
| `administrador` | `administrador` | `ADMINISTRATOR` |
| `administrador.marina` | `administrador` | `ADMINISTRATOR` |

O client confidencial `medflow-test` e seu segredo versionado servem somente ao
smoke local automatizável. Ele habilita password grant para obter tokens sem
navegador; não deve ser usado pelo frontend nem promovido como configuração de
produção. Nenhuma credencial real deve ser colocada no realm.

### Massa rica de demonstração

Para validar as quatro jornadas com listas, estados e histórico preenchidos,
habilite a localização Flyway exclusiva de demonstração ao iniciar o backend:

```bash
export MEDFLOW_FLYWAY_LOCATIONS=classpath:db/migration,classpath:db/demo
```

`db/demo/R__synthetic_demo_data.sql` cria somente pessoas, estrutura, agenda,
consultas e registros inequivocamente fictícios. A massa inclui quatro unidades,
dez consultórios, oito especialidades, seis médicos, dezesseis pacientes,
regras semanais, bloqueios e consultas distribuídas por todos os estados do
ciclo de vida. A localização não faz parte do valor padrão da aplicação e não
deve ser habilitada fora de desenvolvimento, demonstração ou QA local. Os
`subject` dos pacientes e dos médicos autenticáveis concordam com o realm
versionado; recepção e administração não dependem de vínculo local.

O smoke criptográfico versionado pode ser executado somente contra a stack local
sintética, depois que Keycloak e backend estiverem prontos:

```bash
./scripts/smoke-autenticacao.sh
```

O script valida o health, 401 sem token, challenge Bearer, token válido, emissor
incorreto, audiência incorreta e expiração real como casos separados. Para esses
negativos ele usa um client sintético sem mapper de audiência e altera
temporariamente o Frontend URL e o lifespan do realm local, restaurando ambos ao
terminar, inclusive em falha. Por segurança, recusa URLs que não sejam
`localhost` ou `127.0.0.1`.

Inicialização local com portas alternativas:

```bash
MEDFLOW_POSTGRES_PORT=55439 MEDFLOW_KEYCLOAK_PORT=58085 \
docker compose -p medflow-issue9 up -d
```

Para o uso padrão, omitir as variáveis e acessar o Keycloak em `8085`. O backend
deve iniciar com datasource, emissor e JWK Set coerentes:

```bash
export MEDFLOW_OIDC_ISSUER_URI=http://localhost:8085/realms/medflow
export MEDFLOW_OIDC_JWK_SET_URI=http://localhost:8085/realms/medflow/protocol/openid-connect/certs
export MEDFLOW_DB_URL=jdbc:postgresql://localhost:5432/medflow
export MEDFLOW_DB_USERNAME=medflow
export MEDFLOW_DB_PASSWORD=medflow
./gradlew bootRun
```

As URLs do frontend podem ser sobrescritas antes do bundle por
`globalThis.__MEDFLOW_CONFIG__`; por padrão são Keycloak `localhost:8085`, realm
`medflow`, client `medflow-web` e API relativa `/api`. O interceptor oficial só
envia o token para a origem e o caminho exatos da API configurada. Durante
`npm start`, `proxy.conf.json` encaminha `/api` ao backend em `localhost:8080`,
evitando liberar CORS ou enviar tokens a uma origem ampla apenas para desenvolvimento.

## Validação executada

Em ambiente isolado com dados sintéticos foram observados:

- import real do realm no Keycloak 26.7.3;
- token de paciente com `iss`, `aud`, `exp` e role `PATIENT` esperados;
- `/actuator/health` anônimo retornando 200;
- `/api/me` sem token retornando 401 no envelope comum e com `X-Request-Id`;
- token válido assinado pelo Keycloak retornando somente `PATIENT` e os vínculos
  locais nulos;
- token emitido por outro realm/audiência retornando 401;
- token real já expirado retornando 401;
- build backend com 19 testes sem falhas, incluindo 403 para JWT sem perfil MVP
  e preservação do challenge `WWW-Authenticate` em 401;
- frontend com 2 testes e build de produção sem falhas;
- proxy de desenvolvimento encaminhando `/api/me` ao backend e preservando
  status 401, envelope, challenge Bearer e `X-Request-Id`;
- login real da SPA no navegador por Authorization Code + PKCE S256, seguido da
  exibição do contexto retornado por `/api/me` para o perfil `PATIENT`.

Os testes com JWT injetado no MockMvc verificam contrato e conversão de roles;
a validação criptográfica acima foi um smoke contra o Keycloak real. Ainda não
há fluxo E2E completo do frontend.

## Eventos de autenticação no Keycloak

Login, logout e falhas de autenticação pertencem ao Keycloak e não são copiados
para a tabela de auditoria funcional da aplicação. No realm `medflow`, a
Administração do Keycloak deve habilitar em **Realm settings → Events** o
armazenamento de eventos de usuário e selecionar, no mínimo, `LOGIN`, `LOGOUT`
e `LOGIN_ERROR`. A consulta é feita em **Events → User events**, com período e
tipos delimitados; ela deve ser restrita a operadores autorizados do ambiente.

O backend registra apenas tentativas contra operações críticas da API (por
exemplo, uma requisição sem credencial a uma mutação auditável), identificando
o ator como `ANONIMO` e sem armazenar token, senha, cabeçalhos ou detalhes da
falha de autenticação. Assim, o evento HTTP funcional não substitui nem duplica
o evento de login do provedor de identidade.

O realm sintético versionado serve à demonstração local. Esta entrega não
define retenção, exportação ou garantia de imutabilidade dos eventos do
Keycloak em ambiente de produção.
