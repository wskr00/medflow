# Administração — refinamento da #60

Branch `codex/60-admin-ux`, baseada na `main` após a #59. Revisão de 04/11/2026,
com a stack Angular 22 / Spring / PostgreSQL / Keycloak e dados sintéticos.

## Direção e composição

A Administração usa a identidade MedFlow: IBM Plex auto-hospedada, fundo quente,
petróleo, linhas discretas, estados semânticos e primitives Spartan. O espaço é de
configuração, sem indicadores decorativos ou conteúdo clínico. Os seis editores
continuam próprios: clínica, estrutura com consultórios, profissionais,
especialidades, horários e bloqueios. O feedback e o CSS comum não constituem um
CRUD universal.

No desktop, a navegação lateral ocupa toda a altura; sua região central pode
rolar sem esconder a sessão e a saída. Listas e editores ficam lado a lado. No
tablet, as seis rotas permanecem visíveis e a lista antecede o formulário. A
seleção possui borda e `aria-pressed`, além de cor. Selecionar ou criar leva o foco
ao editor; voltar à lista preserva o formulário. A troca de rota restaura foco no
conteúdo e topo da página. Entradas e feedback usam 180 ms; movimento reduzido é
respeitado. A janela 1024×500 e a largura 320 também foram verificadas.

## Comportamento verificado

- Salvamento indica pendência/envio/sucesso e bloqueia campos durante a requisição.
  As telas não exibem sucesso antes da resposta do servidor. Clínica usa o texto
  normalizado retornado como base; unidade e consultório mantêm rascunhos separados.
- Trocar de cadastro ou iniciar outro confirma o descarte de alterações. Desativar
  um cadastro ativo exige confirmação ao salvar. A checagem de reservas permanece
  no backend; recusa mantém os dados digitados e não sugere cancelamento de reservas.
- Versão desatualizada mantém o formulário e bloqueia reenvio. Carregar a versão
  atual pede confirmação explícita antes de substituir texto. Falha nessa leitura
  preserva texto e bloqueio; outra tentativa continua disponível. Não há mesclagem
  automática nem persistência do formulário no navegador.
- Erros locais e `fieldErrors` aparecem por campo, com `forceShow` para erros
  manuais Spartan, `aria-invalid` e descrição ligada ao controle. O select Helm
  recebeu uma entrada opcional de descrição para associar erros ao elemento nativo.
- Especialidades usam toggle group com teclado e marca de seleção. Especialidade
  inativa não pode receber associação nova, mas um vínculo existente é mostrado e
  pode ser removido. Falhas nos catálogos têm ações de recuperação.
- Horários apresentam profissional, especialidade e local. A edição preserva
  estado e fim de vigência, inclusive sábado/domingo; novo horário limpa escolhas.
  Os vínculos que o contrato proíbe trocar ficam identificados e desabilitados ao
  editar. Especialidades novas são filtradas pelo médico escolhido.
- Bloqueios preservam estado e mostram os horários locais recebidos da clínica,
  sem convertê-los para o fuso do navegador. Validação de intervalo recebe erro
  por campo. Nenhum contrato, guard ou permissão clínica foi ampliado.

Os códigos de conflito foram conferidos nos serviços reais:
`CONFIGURACAO_COM_RESERVAS`, `CONFIGURACAO_CONFLITANTE` e `VERSAO_DESATUALIZADA`.

## Antes e depois

Capturas das seis rotas usam a mesma massa demo, com o primeiro cadastro
selecionado quando existente. Os nomes são sintéticos. São capturas de página
inteira; as dimensões abaixo indicam o viewport.

| Rota | Antes 1366×768 | Depois 1366×768 | Antes 768×1024 | Depois 768×1024 |
| --- | --- | --- | --- | --- |
| Clínica | [Antes](clinica-before-1366.png) | [Depois](clinica-after-1366.png) | [Antes](clinica-before-768.png) | [Depois](clinica-after-768.png) |
| Estrutura | [Antes](estrutura-before-1366.png) | [Depois](estrutura-after-1366.png) | [Antes](estrutura-before-768.png) | [Depois](estrutura-after-768.png) |
| Profissionais | [Antes](profissionais-before-1366.png) | [Depois](profissionais-after-1366.png) | [Antes](profissionais-before-768.png) | [Depois](profissionais-after-768.png) |
| Especialidades | [Antes](especialidades-before-1366.png) | [Depois](especialidades-after-1366.png) | [Antes](especialidades-before-768.png) | [Depois](especialidades-after-768.png) |
| Horários | [Antes](agenda-before-1366.png) | [Depois](agenda-after-1366.png) | [Antes](agenda-before-768.png) | [Depois](agenda-after-768.png) |
| Bloqueios | [Antes](bloqueios-before-1366.png) | [Depois](bloqueios-after-1366.png) | [Antes](bloqueios-before-768.png) | [Depois](bloqueios-after-768.png) |

Casos da stack real:

- [Versão desatualizada com texto preservado](real-version-conflict.png).
- [Recusa por reserva futura no tablet](real-reservation-conflict-tablet.png).
- [Bloqueio corrigido, salvo e recuperado após reload](real-block-saved-tablet.png).

## Validação

- `npm run build`: aprovado.
- `npm test -- --watch=false`: 45 testes / 17 arquivos aprovados.
- `npm run test:e2e`: 27 cenários aprovados, incluindo os cenários existentes das
  demais jornadas e a negação de acesso clínico para Administrador.
- Nove cenários em `e2e/admin-refinement.spec.ts`: seis rotas com API real nos dois
  viewports, seleção e foco, composição empilhada/lado a lado, zero overflow,
  console/rede sem erros e zero violações Axe sérias/críticas. Respostas controladas
  cobrem validação, teclado no toggle group, descarte, envio em curso, conflitos,
  recarga cancelada/falha/sucesso, desativação cancelada, vigência e estado mantidos,
  intervalo inválido, campos do servidor, loading, vazio e recuperação regional.
- O cenário adicional verifica a sessão visível em 1024×500, erros visíveis,
  ausência de overflow a 320 px, nome da animação e duração reduzida. A inspeção
  visual complementa os testes; não representa pesquisa de usabilidade com a clínica.
- `node scripts/qa-admin-ui.cjs`: cadastro real de unidade, consultório,
  especialidade, médico, regra e bloqueio; salvamento da clínica sem mudar nome,
  estado ou fuso; conflito de versão real e recuperação; recusa real por reserva
  futura e novo período aceito; persistência após reload.
- `git diff --check`: aprovado.

O smoke requer a massa demo e serviços em 4200/8080/8085. A versão do médico é
incrementada por SQL para reproduzir concorrência, e uma reserva sintética futura
é inserida em transação para provocar o bloqueio real. O `finally` remove somente
os IDs criados pelo smoke; a clínica mantém seus dados e sua versão avança pelas
operações autorizadas. Eventos de auditoria sintéticos permanecem. Nenhuma captura
contém token, senha ou texto clínico de pessoas reais.

As listas e catálogos mantêm o contrato existente de até 100 itens por consulta.
Esta revisão não adiciona busca global, paginação desses catálogos ou dashboard.
