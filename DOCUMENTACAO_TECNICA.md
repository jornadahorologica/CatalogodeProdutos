# Documentação Técnica — Catálogo de Produtos COTIC/SEFAZ-CE

> Complementa o `README.md` (que cobre instalação/configuração). Este
> documento descreve arquitetura, modelo de dados, API interna, fluxos e
> decisões técnicas para quem for manter ou evoluir o sistema.
>
> Referência de negócio: *Documento de Regras de Negócio v1.0*. Toda regra
> citada aqui como "RN-00X" ou "seção N" remete a esse documento.

## Sumário

1. [Visão geral e stack](#1-visão-geral-e-stack)
2. [Arquitetura](#2-arquitetura)
3. [Modelo de dados](#3-modelo-de-dados)
4. [Camada de banco de dados](#4-camada-de-banco-de-dados)
5. [Autenticação e perfis de acesso](#5-autenticação-e-perfis-de-acesso)
6. [Regras de validação e qualidade](#6-regras-de-validação-e-qualidade)
7. [Fluxo de vida do produto](#7-fluxo-de-vida-do-produto)
8. [API do servidor (funções expostas ao cliente)](#8-api-do-servidor-funções-expostas-ao-cliente)
9. [Frontend (SPA)](#9-frontend-spa)
10. [Concorrência e integridade](#10-concorrência-e-integridade)
11. [Configuração, implantação e operação](#11-configuração-implantação-e-operação)
12. [Decisões técnicas e limitações conhecidas](#12-decisões-técnicas-e-limitações-conhecidas)
13. [Como estender o sistema](#13-como-estender-o-sistema)
14. [Problemas conhecidos e como diagnosticar](#14-problemas-conhecidos-e-como-diagnosticar)

---

## 1. Visão geral e stack

| Camada | Tecnologia |
|---|---|
| Aplicação/lógica de negócio | Google Apps Script (V8 runtime), JavaScript ES2019-ish |
| Banco de dados | Google Sheets (uma planilha, uma aba por entidade) |
| Interface | SPA (Single Page Application) servida via `HtmlService`, HTML + CSS + JavaScript vanilla (sem framework) |
| Comunicação cliente↔servidor | `google.script.run` (chamadas assíncronas RPC do Apps Script) |
| Autenticação | Identidade do Google (Workspace ou conta pessoal), via `Session.getActiveUser()` |
| Controle de versão do código-fonte | Este repositório Git — espelha, mas **não substitui**, o projeto real no Apps Script (ver seção 11) |

O sistema não tem build step, empacotador ou dependências de terceiros: tudo
roda nativamente no runtime do Apps Script.

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│  Navegador (SPA)                                             │
│  Index.html → carrega CSS.html + JS_App.html (via include()) │
│  Estado do cliente vive em `estado` (objeto JS em memória)    │
│  Toda leitura/escrita passa por chamarServidor(nomeFuncao,…)  │
│  que envolve google.script.run em uma Promise                 │
└───────────────────────────┬───────────────────────────────────┘
                             │ google.script.run (RPC)
┌───────────────────────────▼───────────────────────────────────┐
│  Code.gs — doGet() serve Index.html                            │
│           obterContextoInicial() — bootstrap do app             │
├─────────────────────────────────────────────────────────────┤
│  Services (regra de negócio) — cada um só chama o service       │
│  de nível abaixo, nunca SpreadsheetApp diretamente:              │
│                                                                 │
│  ProdutoService · IniciativaService · IntegracaoService ·        │
│  DocumentoService · ParametroService · DashboardService          │
│           │                    │                                │
│           ▼                    ▼                                │
│  ValidacaoService        HistoricoService                       │
│  (normalização,          (grava toda alteração                  │
│   duplicidade,            crítica — seções 21/32)                │
│   completude,                                                   │
│   regras de qualidade)                                          │
│           │                                                     │
│           ▼                                                     │
│  AuthService (getUsuarioAtual_/requirePerfil_)                  │
│           │                                                     │
│           ▼                                                     │
│  DatabaseService — única camada que fala com SpreadsheetApp      │
│  (getSheet_, getAllRecords_, criarRegistroComId_,                │
│   updateRecordById_, deleteRecordById_, serializarRegistro_)     │
└───────────────────────────┬───────────────────────────────────┘
                             ▼
                   Planilha Google Sheets
             (uma aba por entidade — seção 3 abaixo)
```

**Regra de dependência:** nenhum arquivo de service de negócio
(`ProdutoService.gs`, `IniciativaService.gs` etc.) chama `SpreadsheetApp`
diretamente — tudo passa por `DatabaseService.gs`. Isso mantém a lógica de
banco isolada e é o que permitiria, no futuro, trocar Sheets por outro
armazenamento sem reescrever as regras de negócio.

### Arquivos do projeto

| Arquivo | Papel |
|---|---|
| `appsscript.json` | Manifesto: runtime V8, fuso horário, config do Web App |
| `Code.gs` | Ponto de entrada (`doGet`), `include()` para montar a SPA, `obterContextoInicial()` |
| `Config.gs` | Constantes: nomes de abas, cabeçalhos, enums de status/perfil/impacto, listas de partida, campos obrigatórios |
| `DatabaseService.gs` | CRUD genérico sobre Sheets; único ponto que toca `SpreadsheetApp` |
| `AuthService.gs` | Identificação do usuário e checagem de perfil |
| `ValidacaoService.gs` | Normalização de texto, duplicidade, completude, regras de qualidade |
| `HistoricoService.gs` | Registro e consulta de auditoria |
| `ProdutoService.gs` | CRUD e fluxo de vida do Produto (entidade central) |
| `IniciativaService.gs` | Iniciativas PDTI e vínculo N:N com produtos |
| `IntegracaoService.gs` | Integrações do produto |
| `DocumentoService.gs` | Links de documentação do produto |
| `ParametroService.gs` | Administração de listas paramétricas e usuários |
| `DashboardService.gs` | Indicadores agregados |
| `SetupService.gs` | `configurarAmbiente()` — criação/seed inicial das abas |
| `Index.html` | Shell da SPA (topbar, navegação, containers) |
| `CSS.html` | Estilos globais |
| `JS_App.html` | Toda a lógica de cliente: estado, renderização de views, chamadas RPC |

## 3. Modelo de dados

Cada entidade da seção 25/36 do documento de regras é uma aba da planilha,
com cabeçalho na linha 1. `SHEET_HEADERS` em `Config.gs` é a fonte única de
verdade da ordem/nome das colunas — qualquer alteração de schema começa ali.

### PRODUTOS (entidade central — RN-001)

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | string | `PROD-0001`, `PROD-0002`… gerado por `criarRegistroComId_` |
| `nome` | string | Nome de exibição |
| `nome_normalizado` | string | **Campo técnico interno**, nunca exibido — usado só pela detecção de duplicidade (RN-003). Minúsculo, sem acento/pontuação |
| `sigla` | string | Opcional (seção 5) |
| `descricao` | string | Obrigatório para completude |
| `tipo` | string | Um dos valores da aba `TIPOS` |
| `categoria` | string | Um dos valores da aba `CATEGORIAS` |
| `area_negocio` | string | Um dos valores da aba `AREAS` |
| `processo_negocio` | string | Texto livre |
| `publico_alvo` | string | Texto livre |
| `finalidade` | string | Texto livre |
| `responsavel_negocio` | string | Texto livre (nome/e-mail) |
| `responsavel_cotic` | string | Texto livre |
| `responsavel_tecnico` | string | Opcional (seção 10) |
| `celula_cotic` | string | Um dos valores da aba `CELULAS` |
| `status` | string | Um de `STATUS_PRODUTO` (seção 9) — ver máquina de estados na seção 7 |
| `impacto_reforma_tributaria` | string | Um de `IMPACTO_REFORMA_VALORES`; editável só por `ADMINISTRADOR` (seção 14) |
| `fonte` | string | Um dos valores da aba `FONTES`; obrigatório para status `Ativo` (RN-006) |
| `data_cadastro` | Date → ISO string no retorno ao cliente | Setado uma vez, na criação |
| `data_atualizacao` | Date → ISO string | Atualizado em toda edição |
| `data_validacao` | Date → ISO string ou `''` | Setado só por `validarProduto` |
| `usuario_validacao` | string | E-mail de quem validou |
| `motivo_descontinuacao` | string | Obrigatório ao descontinuar |
| `observacoes` | string | Texto livre |

Produtos **nunca são removidos fisicamente** (RN-007): a "exclusão" é
`status = 'Descontinuado'`.

### Listas paramétricas simples — `CATEGORIAS`, `TIPOS`, `AREAS`, `CELULAS`, `FONTES`

Mesmo shape para as cinco: `id`, `nome`, `ordem` (número, define ordem de
exibição), `ativo` (boolean). Administradas via `ParametroService.gs` /
tela de Administração — nenhum valor fica hard-coded no código, exceto os
valores de **partida** (`TIPOS_PRODUTO_INICIAIS`, `CATEGORIAS_INICIAIS`,
`FONTES_INICIAIS` em `Config.gs`), usados uma única vez por
`SetupService.configurarAmbiente()`. `AREAS` e `CELULAS` não têm valores de
partida — são específicos da estrutura da SEFAZ-CE e devem ser cadastrados
manualmente pelo primeiro ADMINISTRADOR.

### USUARIOS

`id`, `email`, `nome`, `perfil` (`CONSULTA` | `EDITOR` | `ADMINISTRADOR`),
`ativo`. Chave de negócio é `email` (comparado case-insensitive), embora o
CRUD genérico opere por `id` internamente.

### INICIATIVAS_PDTI

`id`, `nome`, `grupo_tematico`, `descricao`, `ativo`. Entidade
**independente** de Produto (seção 2 / diretriz 13) — uma iniciativa nunca
vira produto e vice-versa.

### PRODUTO_INICIATIVA (tabela de junção N:N — seção 13)

`id`, `produto_id`, `iniciativa_id`, `data_vinculo`. Um par
(`produto_id`, `iniciativa_id`) não pode se repetir — checado em
`vincularIniciativa`.

### INTEGRACOES (seção 16)

`id`, `produto_id`, `produto_relacionado_id` (opcional, referencia outro
produto), `nome_integracao`, `tipo`, `descricao`. Não é alcançada pela
RN-007 — pode ser removida fisicamente (`removerIntegracao`).

### DOCUMENTOS (seção 17)

`id`, `produto_id`, `tipo` (um de `TIPOS_DOCUMENTO_VALORES`), `titulo`,
`url`. Só armazena links, nunca arquivos. Também removível fisicamente.

### HISTORICO (seções 21/32)

`id`, `produto_id`, `campo`, `valor_anterior`, `valor_novo`, `usuario`,
`data_hora`, `operacao`. Append-only — nunca é editado ou apagado por
código de aplicação.

### CONFIG

`chave`, `valor`. Reservada para parâmetros futuros de configuração livre
(hoje não é usada por nenhum service — ver seção 12).

## 4. Camada de banco de dados

Tudo em `DatabaseService.gs`. Funções (todas privadas, sufixo `_`):

| Função | Uso |
|---|---|
| `getSpreadsheet_()` | Resolve a planilha: `getActiveSpreadsheet()` (script vinculado) → `SPREADSHEET_ID` salvo em `PropertiesService` → cria uma nova planilha na primeira execução |
| `getSheet_(sheetName)` | Retorna a aba, criando-a com cabeçalho se não existir |
| `sheetToObjects_(sheet)` | Converte a matriz de valores da aba em array de objetos `{coluna: valor}` |
| `getAllRecords_(sheetName)` / `getRecordById_(sheetName, id)` | Leitura |
| `criarRegistroComId_(sheetName, prefix, padding, dados)` | **Único** ponto de inserção: gera o próximo ID sequencial e grava a linha, tudo sob um mesmo `LockService` (ver seção 10) |
| `updateRecordById_(sheetName, id, changes)` | Atualiza campos de uma linha por `id`, retorna `{anterior, atual}` |
| `deleteRecordById_(sheetName, id)` | Remoção física — só usada para `INTEGRACOES`, `DOCUMENTOS` e `PRODUTO_INICIATIVA`, nunca para `PRODUTOS` |
| `serializarRegistro_(obj)` | Converte qualquer valor `Date` do objeto para string ISO (ver seção 10) |

Nenhuma outra parte do sistema deve chamar `SpreadsheetApp` diretamente.

## 5. Autenticação e perfis de acesso

`AuthService.gs` implementa a seção 23: identidade vem de
`Session.getActiveUser().getEmail()` (com fallback para
`getEffectiveUser()`), sem senha própria.

```
getUsuarioAtual_()
├── Aba USUARIOS vazia? → bootstrap: usuário atual vira ADMINISTRADOR
│   (é a única forma de existir alguém apto a cadastrar os demais)
├── E-mail encontrado e ativo? → usa o perfil cadastrado
└── E-mail não encontrado (ou inativo)? → perfil CONSULTA (somente leitura)
```

O resultado é cacheado em `USUARIO_ATUAL_CACHE_` durante a execução (cada
chamada RPC do Apps Script roda em uma execução isolada, então o cache não
persiste entre chamadas — ele só evita relookups dentro da mesma função).

`requirePerfil_(perfisPermitidos)` é chamado no início de toda função
pública que precisa restringir acesso; lança `Error` se o perfil atual não
estiver na lista. **A autorização é sempre verificada no servidor** — a UI
esconde botões por conveniência (`podeEditar()`/`ehAdmin()` no
`JS_App.html`), mas isso não é a barreira de segurança real.

| Perfil | Pode |
|---|---|
| `CONSULTA` | Buscar, filtrar, visualizar (nenhuma função de escrita aceita esse perfil) |
| `EDITOR` | + cadastrar/editar produtos, vincular iniciativas, gerenciar integrações/documentos |
| `ADMINISTRADOR` | + validar produto, descontinuar, editar impacto Reforma Tributária, administrar parâmetros/usuários, ver histórico |

## 6. Regras de validação e qualidade

Tudo em `ValidacaoService.gs`:

- **`normalizarTexto_`** — minúsculo, sem acento, sem pontuação, espaços
  colapsados. Base para busca e duplicidade.
- **`verificarDuplicidade_(nome, sigla, idExcluir)`** (RN-003) — compara
  contra produtos não descontinuados:
  - `exatos`: nome igual (exato ou normalizado) → **bloqueia** o
    salvamento.
  - `possiveis`: sigla igual, ou nome normalizado contido um no outro →
    **não bloqueia**, mas exige confirmação explícita do usuário
    (`confirmarDuplicidade = true` em `criarProduto`).
- **`calcularCompletude_(produto)`** (seção 30) — percentual sobre
  `CAMPOS_OBRIGATORIOS_MINIMOS` (12 campos da seção 6, **sem** incluir
  `fonte` — fonte é regra de qualidade separada, não de completude).
- **`validarRegrasQualidade_(produtoSimulado)`** (seção 31) — recebe o
  estado *após* a alteração pretendida e lança erro se:
  - status operacional (`Ativo`/`Em evolução`/`Em modernização`) sem
    responsável de negócio+COTIC, sem categoria ou sem descrição;
  - status `Ativo` sem `fonte` (RN-006).

## 7. Fluxo de vida do produto

```
   criarProduto()
        │  status = "Em levantamento" (sempre, ignora o que vier do cliente)
        ▼
 Em levantamento ──avancarParaValidacao()──▶ Em validação
                                                  │
                                    validarProduto() [só ADMINISTRADOR]
                                    · completude deve ser 100%
                                    · validarRegrasQualidade_ deve passar
                                    · grava data_validacao + usuario_validacao
                                                  ▼
                                               Ativo ◀──┐
                                                 │       │ atualizarProduto()
                          atualizarProduto() ────┤       │ (edição livre de
                          pode mover para        │       │  campos, exceto
                          Em evolução /           │       │  para Ativo/
                          Em modernização /       │       │  Descontinuado)
                          Em substituição /       │       │
                          Legado ─────────────────┘       │
                                                           │
                                    descontinuarProduto() [só ADMINISTRADOR]
                                    · exige motivo
                                    · RN-007: nunca DELETE, só muda status
                                                  ▼
                                            Descontinuado
                                    (some da busca padrão; still visível
                                     com filtro incluirDescontinuados)
```

Toda transição de status passa por `registrarHistorico_` com `operacao`
descrevendo o evento (`criação`, `mudança de status`, `validação`,
`descontinuação`, `alteração`).

**Trava importante em `atualizarProduto`:** o array `STATUS_COM_FLUXO_PROPRIO
= ['Ativo', 'Descontinuado']` impede que esses dois status sejam setados
por uma edição genérica — só pelas funções dedicadas acima. Qualquer outro
valor de `status` (incluindo `Em evolução`, `Em modernização`, `Em
substituição`, `Legado`) pode ser setado livremente por `atualizarProduto`.

## 8. API do servidor (funções expostas ao cliente)

Todas chamadas via `google.script.run.<nomeFuncao>(...)` (nunca use
`fetch`/XHR: Apps Script não expõe REST por padrão nesse modelo). Convenção:
função pública = sem `_` no final; função privada/interna = com `_`
(nunca chamada pelo cliente).

| Função | Arquivo | Perfil mínimo | Retorno |
|---|---|---|---|
| `obterContextoInicial()` | Code.gs | qualquer (define o perfil) | `{usuario, listas}` |
| `listarProdutos(filtros)` | ProdutoService.gs | qualquer | array resumido de produtos |
| `obterProduto(id)` | ProdutoService.gs | qualquer | `{produto, completude, iniciativas, integracoes, documentos}` |
| `criarProduto(dados, confirmarDuplicidade)` | ProdutoService.gs | EDITOR+ | `{produto}` ou `{avisoDuplicidade: [...]}` |
| `atualizarProduto(id, alteracoes)` | ProdutoService.gs | EDITOR+ (ADMIN para `impacto_reforma_tributaria`) | `{produto}` |
| `avancarParaValidacao(id)` | ProdutoService.gs | EDITOR+ | `{produto}` |
| `validarProduto(id)` | ProdutoService.gs | ADMINISTRADOR | `{produto}` |
| `descontinuarProduto(id, motivo)` | ProdutoService.gs | ADMINISTRADOR | `{produto}` |
| `listarHistoricoProduto(id)` | HistoricoService.gs | ADMINISTRADOR | array de registros de histórico |
| `listarIniciativas()` | IniciativaService.gs | qualquer | array de iniciativas ativas |
| `salvarIniciativa(item)` | IniciativaService.gs | ADMINISTRADOR | iniciativa criada/atualizada |
| `vincularIniciativa(produtoId, iniciativaId)` | IniciativaService.gs | EDITOR+ | vínculo criado |
| `desvincularIniciativa(vinculoId)` | IniciativaService.gs | EDITOR+ | `true` |
| `listarIntegracoes(produtoId)` | IntegracaoService.gs | qualquer | array |
| `salvarIntegracao(item)` | IntegracaoService.gs | EDITOR+ | item criado/atualizado |
| `removerIntegracao(id)` | IntegracaoService.gs | EDITOR+ | `true` |
| `listarDocumentos(produtoId)` | DocumentoService.gs | qualquer | array |
| `salvarDocumento(item)` | DocumentoService.gs | EDITOR+ | item criado/atualizado |
| `removerDocumento(id)` | DocumentoService.gs | EDITOR+ | `true` |
| `listarListaSimples(nomeLista)` | ParametroService.gs | qualquer | array (`CATEGORIAS`\|`TIPOS`\|`AREAS`\|`CELULAS`\|`FONTES`) |
| `salvarItemListaSimples(nomeLista, item)` | ParametroService.gs | ADMINISTRADOR | item criado/atualizado |
| `listarUsuarios()` | ParametroService.gs | ADMINISTRADOR | array |
| `salvarUsuario(item)` | ParametroService.gs | ADMINISTRADOR | usuário criado/atualizado |
| `obterIndicadores()` | DashboardService.gs | qualquer | objeto de indicadores agregados |
| `configurarAmbiente()` | SetupService.gs | executado manualmente pelo editor, não pelo cliente | — |

Toda função pública que falha lança `Error(mensagem)`; no cliente,
`chamarServidor` propaga isso via `.catch()` e a mensagem é exibida
diretamente ao usuário (por isso as mensagens de erro no backend são
escritas para leitura humana, em português, e sem detalhes técnicos
sensíveis).

## 9. Frontend (SPA)

Tudo em `JS_App.html`, dentro de uma única IIFE para não vazar globais.

- **Estado** (`estado`): `contexto` (usuário + listas paramétricas,
  carregado uma vez em `init()`), `view` atual, `produtos` (cache da última
  busca), `filtros`, `produtoAtual`.
- **`chamarServidor(nomeFuncao, ...args)`** — único ponto de chamada ao
  backend; envolve `google.script.run` em uma `Promise`.
- **Views** (`irParaView`): `busca` (padrão), `dashboard`, `novo`,
  `admin`. Cada uma tem sua função `render*` que reconstrói o `innerHTML`
  de `#conteudo` — não há virtual DOM nem componentes, é renderização
  imperativa direta.
- **Modal genérico** (`abrirModal`/`fecharModal`) — usado para
  confirmações (descontinuar, duplicidade), histórico, e formulários
  pequenos (vincular iniciativa, nova integração/documento).
- **Helpers de permissão no cliente**: `podeEditar()` (`EDITOR`/
  `ADMINISTRADOR`) e `ehAdmin()` — controlam **apenas** o que é mostrado
  na tela; a autorização real está sempre no servidor (seção 5).
- **`escapeHtml`** — usado em toda interpolação de texto do usuário no
  `innerHTML`, para evitar XSS armazenado (nomes de produto, descrições
  etc. vêm de input livre).

## 10. Concorrência e integridade

Dois cuidados específicos do ambiente Apps Script, ambos resolvidos em
`DatabaseService.gs`:

**a) IDs únicos sob concorrência (RN-002).** Gerar o próximo ID
(`max(id) + 1`) e inserir a linha precisam ser atômicos, senão duas
criações simultâneas podem calcular o mesmo próximo ID antes de qualquer
uma delas gravar. `criarRegistroComId_` faz as duas coisas dentro de um
único `LockService.getScriptLock()` — por isso é a **única** forma de
inserção no sistema (não existe mais uma função separada
"gerar ID" + "inserir").

**b) `google.script.run` não serializa `Date`.** Se uma função pública
retornar um objeto contendo um `Date` (ex.: `data_cadastro: new Date()`),
o cliente recebe `null` no lugar da resposta inteira — não um erro
explícito, o que torna o bug difícil de rastrear (foi encontrado durante os
testes manuais deste projeto). Por isso `serializarRegistro_` converte
todo valor `Date` para string ISO **antes** de qualquer objeto sair de
`sheetToObjects_`, `criarRegistroComId_` ou `updateRecordById_`. A escrita
na planilha em si (`appendRow`/`setValues`) continua usando os objetos
`Date` originais, preservando a formatação nativa de data/hora do Sheets —
só o valor *retornado* é convertido.

> **Regra para qualquer código novo:** nunca monte um objeto com `new
> Date()` e o devolva diretamente de uma função pública (sem `_`) para o
> cliente. Ou passe pelos helpers acima, ou chame `.toISOString()`
> manualmente antes do `return`.

## 11. Configuração, implantação e operação

Ver `README.md` para o passo a passo completo. Pontos técnicos relevantes:

- **`appsscript.json`**: `executeAs: "USER_ACCESSING"` +
  `access: "DOMAIN"` — essa combinação é o que permite
  `Session.getActiveUser()` identificar o usuário real (seção 23). Com
  conta pessoal (fora de um domínio Google Workspace), `DOMAIN` não se
  aplica — use `access: "MYSELF"` para testes individuais.
- **Primeira execução**: rodar `configurarAmbiente()` manualmente
  (menu de funções do editor, ou pelo menu "Catálogo COTIC" se o script
  estiver vinculado à planilha via `onOpen()`). Idempotente: não sobrescreve
  listas já populadas.
- **Duas formas de subir o código**: `clasp push` (recomendado — sobe
  todos os arquivos de uma vez, sem risco de nome/tipo errado) ou cópia
  manual arquivo a arquivo no editor `script.google.com`. Se for manual,
  **atenção ao tipo de arquivo**: os 13 arquivos de lógica devem ser
  criados como **Script** (`.gs`), nunca como HTML — um arquivo de lógica
  criado como HTML nunca entra no escopo global do servidor, e qualquer
  função que ele definisse ficaria "não definida" para o resto do backend
  (bug já visto durante os testes deste projeto).
- **`SPREADSHEET_ID`** fica em `PropertiesService.getScriptProperties()`,
  setado automaticamente na primeira vez que `getSpreadsheet_()` cria a
  planilha (só acontece se o script não estiver vinculado a uma planilha
  existente).

## 12. Decisões técnicas e limitações conhecidas

Decisões tomadas dentro do espaço técnico deixado em aberto pela seção 39
do documento de regras (nenhuma delas é uma regra de negócio nova):

- **`nome_normalizado`** é um campo interno adicional em `PRODUTOS` (não
  previsto na lista de campos da seção 37), necessário para a checagem de
  duplicidade da RN-003 funcionar de forma eficiente sem recalcular a
  normalização de todos os nomes a cada busca. Nunca é exibido na UI.
- **`STATUS_PRODUTO` e `PERFIS`** ficam como constantes de código
  (`Config.gs`), não como abas administráveis — porque o documento amarra
  comportamento de sistema específico a cada valor (RN-004, RN-005, seção
  22), diferente de `CATEGORIAS`/`TIPOS`/`AREAS`/`CELULAS`/`FONTES`, que
  são só rótulos.
- **Concorrência**: o `LockService` do Apps Script serializa escritas no
  nível do *script inteiro* (não por aba/linha). Em uso normal de um
  catálogo interno da COTIC isso é suficiente; sob volume de escrita muito
  alto isso viraria gargalo — não é o caso do MVP.
- **Performance de leitura**: toda listagem/filtro lê a aba inteira via
  `getDataRange().getValues()` e filtra em memória no Apps Script (sem
  índice, sem paginação no servidor). Adequado para um catálogo de
  produtos (dezenas a poucas centenas de linhas); passaria a valer a pena
  otimizar (cache, paginação) numa base de milhares de produtos —
  explicitamente fora do escopo do MVP (seção 39: "otimização de
  performance").
- **Aba `CONFIG`** existe (cabeçalho `chave`/`valor`) mas nenhum service
  a usa hoje — reservada para parâmetros de configuração livre que
  surjam no futuro (ex.: texto de aviso na home, limites de paginação).
- **Sem testes automatizados** — fora do escopo do MVP (seção 39). A
  verificação feita durante o desenvolvimento foi checagem de sintaxe
  (`node --check` sobre cada arquivo) e testes manuais guiados por um
  roteiro de aceitação (cadastro → duplicidade → completude → validação →
  vínculo PDTI → integrações/documentos → descontinuação → histórico →
  dashboard → perfis).

## 13. Como estender o sistema

**Adicionar um novo campo em PRODUTOS:**
1. Acrescente a coluna em `SHEET_HEADERS.PRODUTOS` (`Config.gs`) — a
   ordem importa, é a mesma ordem física das colunas na planilha.
2. Se for obrigatório para completude, acrescente a
   `CAMPOS_OBRIGATORIOS_MINIMOS`.
3. Inclua o campo em `dadosProduto` (`ProdutoService.criarProduto`) e,
   se editável, no formulário (`renderFormularioProduto` /
   `coletarDadosFormulario` em `JS_App.html`).
4. Abas já existentes na planilha **não** ganham a coluna nova
   automaticamente — adicione manualmente o cabeçalho na planilha real (ou
   apague a aba e deixe `configurarAmbiente()` recriá-la, **só se ainda não
   houver dados**).

**Adicionar uma nova lista paramétrica simples** (equivalente a
`CATEGORIAS`/`TIPOS`/etc.): acrescente o nome em `SHEET_NAMES` e
`SHEET_HEADERS` (`Config.gs`) com o shape `['id','nome','ordem','ativo']`,
inclua a chave em `LISTAS_SIMPLES_PERMITIDAS_`
(`ParametroService.gs`), e adicione a aba correspondente em
`LISTAS_ADMIN` (`JS_App.html`) para aparecer na tela de Administração.

**Adicionar uma nova função pública:** siga o padrão de todo o backend —
comece com `requirePerfil_([...])` se precisar restringir acesso, nunca
retorne um `Date` cru (seção 10), e documente o perfil mínimo na tabela da
seção 8 deste documento.

## 14. Problemas conhecidos e como diagnosticar

| Sintoma | Causa provável | Onde olhar |
|---|---|---|
| `ReferenceError: <algumaFuncao_> is not defined` | Arquivo de lógica criado como **HTML** em vez de **Script** no editor manual, ou arquivo simplesmente não copiado | Lista de arquivos do projeto Apps Script — confira contra a tabela da seção 2 |
| `Cannot read properties of null (reading '<campo>')` logo após uma ação de escrita | Uma função pública retornou um objeto contendo `Date` cru | `serializarRegistro_` deveria estar sendo usado em qualquer novo ponto de leitura/escrita — ver seção 10 |
| Dropdown de Categoria/Tipo/Fonte vazio | `configurarAmbiente()` nunca foi executado | Rodar a função uma vez pelo editor |
| Dropdown de Área/Célula vazio | Por design — não têm seed automático | Cadastrar em Administração |
| "Permissão negada para o perfil…" | Perfil do usuário atual não está na lista exigida pela função | Conferir aba `USUARIOS` e a tabela da seção 8 |
| `Session.getActiveUser()` retorna vazio / erro de identificação | Web App implantado com `access` incompatível com o tipo de conta (Workspace vs. pessoal) | Ver seção 11 — `DOMAIN` exige domínio Workspace; use `MYSELF` para teste individual |
