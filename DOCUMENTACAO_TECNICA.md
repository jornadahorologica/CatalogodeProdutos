# Documentação Técnica — Catálogo de Produtos COTIC/SEFAZ-CE

> Este documento tem duas partes. A **Parte 1** explica o negócio: por que o
> sistema existe, o que é um "Produto" e todas as regras que o código
> implementa. A **Parte 2** explica a construção técnica: arquitetura, o que
> cada arquivo faz, modelo de dados, API e como manter/evoluir o sistema.
> Quem for dar manutenção deveria conseguir entender o sistema inteiro lendo
> só este documento, sem precisar abrir o documento de regras de negócio
> original — embora ele continue sendo a fonte oficial em caso de dúvida.

---

# PARTE 1 — Contexto e Regras de Negócio

## 1.1 Por que este sistema existe

A COTIC (área de TI da SEFAZ-CE) não tinha, até este projeto, um lugar único
que respondesse de forma confiável a perguntas como: *quantos sistemas a
COTIC mantém? quem é responsável por cada um? quais estão em produção, quais
estão sendo descontinuados? quais serão afetados pela Reforma Tributária?*

Essas informações existiam espalhadas: um catálogo de aplicações na
Intranet, o PDTI (Plano Diretor de TI), conhecimento informal de cada célula
da COTIC, documentação solta. O sistema nasce para resolver isso, seguindo
um princípio simples, declarado no documento de regras original:

> **"Uma fonte centralizada, informação padronizada e responsabilidade
> definida."**

Ou seja: todo produto de software/dados/serviço mantido pela COTIC deve
estar cadastrado em um único lugar, com um conjunto mínimo de informações
sempre preenchido e sempre um responsável identificável.

## 1.2 O que é um "Produto" (RN-001)

A entidade central do sistema chama-se **Produto**, não "Sistema" — essa é
uma decisão deliberada. Um Produto é qualquer solução que a COTIC entrega
ou gerencia para uma área de negócio, um usuário interno, o cidadão, ou
outra unidade da SEFAZ. Isso inclui, mas não se limita a:

- sistema de negócio (ex.: um sistema de gestão de IPVA);
- sistema corporativo (ex.: um ERP interno);
- produto de dados (ex.: uma base consolidada para BI);
- plataforma;
- serviço de TI;
- solução de integração;
- produto de inteligência artificial;
- infraestrutura;
- sistema legado (ainda em uso, mas tecnologicamente ultrapassado).

**O que NÃO é um Produto:** projetos e iniciativas. Uma **iniciativa do
PDTI** — por exemplo, "Reforma Tributária" — pode *impactar* diversos
produtos, mas ela mesma nunca é cadastrada como produto. Essa distinção é
importante porque o PDTI é um plano que muda ao longo do tempo: tratar uma
iniciativa como se fosse um produto misturaria duas coisas de naturezas
diferentes (uma entrega permanente vs. um esforço temporário). O sistema
modela isso como duas tabelas separadas, relacionadas entre si (ver 1.9).

## 1.3 Identificação única (RN-002)

Todo produto recebe um ID sequencial único no formato `PROD-0001`,
`PROD-0002`, etc. Esse ID **nunca é reaproveitado**, mesmo depois que um
produto é descontinuado — porque descontinuar um produto não o apaga (ver
1.13), ele continua ocupando seu ID para sempre, preservando o histórico do
portfólio.

## 1.4 Nome único e verificação de duplicidade (RN-003)

Dois produtos com o mesmo nome não podem coexistir como ativos no catálogo.
Mas a regra vai além de uma simples comparação exata: o sistema também
precisa desconfiar de nomes *parecidos*. O exemplo dado no documento
original é revelador:

> `IPVA`, `Sistema IPVA`, `Inova IPVA` não devem ser automaticamente
> considerados produtos diferentes sem validação.

Ou seja: o sistema não decide sozinho se são o mesmo produto ou produtos
diferentes — ele **avisa** a pessoa cadastrando e pede confirmação explícita
antes de permitir que dois nomes parecidos coexistam. Nomes idênticos (ou
que só diferem em acentuação/maiúsculas) são bloqueados sem exceção.

## 1.5 Cadastro mínimo obrigatório

Para um produto ser considerado **"Validado"**, ele precisa ter preenchido,
no mínimo, três blocos de informação:

- **Identificação:** nome, descrição, tipo, categoria, status (sigla é
  opcional, só quando existir).
- **Negócio:** área de negócio, processo de negócio atendido, público-alvo,
  finalidade.
- **Responsabilidade:** responsável de negócio, responsável COTIC, célula/
  área COTIC responsável (responsável técnico é opcional).

Um produto pode existir no catálogo sem todas essas informações — mas nesse
caso ele fica marcado como **incompleto** e não pode avançar para o status
"Validado/Ativo" (ver 1.8).

## 1.6 Tipos e categorias (listas controladas)

**Tipo de produto** é uma lista fechada: Sistema de Negócio, Sistema
Corporativo, Produto de Dados, Plataforma, Serviço de TI, Solução de
Integração, Produto de IA, Infraestrutura, Sistema Legado, ou "Outro" (que
só deve ser usado quando nenhuma classificação existente serve).

**Categoria de negócio** também é uma lista controlada (Arrecadação e
Fiscalização, Cadastro e Consultas, Documentação e Processos, Gestão
Interna/RH, Relacionamento e Cidadania, Inteligência e Auditoria, Dados/BI/
Analytics, Tecnologia e Segurança, Infraestrutura, Legados, Outros), mas,
diferente do Tipo, essa lista é **parametrizável** — um ADMINISTRADOR pode
adicionar novas categorias sem precisar alterar código (ver 1.18).

## 1.7 Ciclo de vida do produto e o que significa "operacional" (RN-004)

O status de um produto segue uma lista fixa de valores, porque cada um
dispara comportamento diferente no sistema:

| Status | Significado |
|---|---|
| Em levantamento | Acabou de ser cadastrado, informação ainda incompleta |
| Em validação | Levantamento concluído, aguardando confirmação do responsável |
| **Ativo** | Validado e em operação normal |
| Em evolução | Ativo e recebendo melhorias |
| Em modernização | Ativo e passando por modernização tecnológica |
| Em substituição | Está sendo trocado por outro produto |
| Legado | Ainda funciona, mas tecnologicamente ultrapassado |
| Descontinuado | Não existe mais operacionalmente (exclusão lógica) |

Só os status **Ativo**, **Em evolução** e **Em modernização** contam como
"produto operacional" para fins de indicadores e do catálogo principal.
Produtos **Legados** continuam aparecendo nas consultas, mas precisam de uma
identificação visual específica (um selo "LEGADO"), para avisar quem está
consultando que aquele produto não é mais o caminho recomendado. Produtos
**Descontinuados** ficam fora da consulta padrão (mas nunca são apagados —
ver 1.13).

## 1.8 Responsáveis e o fluxo de validação (RN-005)

Cada produto tem até três responsáveis:

- **Responsável de negócio** — quem representa a necessidade e a visão do
  produto do lado de negócio;
- **Responsável COTIC** — quem acompanha o produto dentro da COTIC;
- **Responsável técnico** (opcional) — quem responde pelas informações
  técnicas.

O fluxo de vida de um cadastro segue três passos obrigatórios, nessa ordem:

```
Em levantamento  →  Em validação  →  Validado (status vira "Ativo")
```

Um produto nasce sempre como "Em levantamento". Só depois que as
informações são complementadas ele pode avançar para "Em validação". E só
**depois da confirmação do responsável** (no sistema, isso é modelado como
uma ação restrita ao perfil ADMINISTRADOR) ele se torna oficialmente
"Ativo". Nesse momento, o sistema registra quem validou e quando — essa
informação nunca pode ser inferida ou alterada manualmente depois.

## 1.9 Relacionamento com o PDTI — N:N (seção 13)

Um produto pode estar relacionado a zero, uma, ou várias iniciativas do
PDTI — e uma iniciativa do PDTI pode afetar vários produtos ao mesmo tempo.
O exemplo motivador é a iniciativa **"Reforma Tributária"**, que, segundo o
PDTI, impacta simultaneamente sistemas internos, sistemas externos, ETL/BI,
bancos de dados e diversos leiautes fiscais — ou seja, dezenas de produtos
diferentes, todos ligados à mesma iniciativa. Por isso a relação entre
Produto e Iniciativa PDTI é **N:N** (muitos para muitos), nunca 1:N.

## 1.10 Impacto da Reforma Tributária

Cada produto tem um campo específico de **Impacto da Reforma Tributária**
(Não identificado, Sem impacto, Baixo, Médio, Alto, Crítico). Duas regras
importantes aqui:

1. O sistema **nunca infere esse valor automaticamente** — ele precisa ser
   informado e validado por uma pessoa da área responsável.
2. Só usuários autorizados (no sistema: perfil `ADMINISTRADOR`) podem
   alterá-lo, justamente porque é uma classificação sensível que não deve
   ser mexida por qualquer editor.

## 1.11 Informações técnicas, integrações e documentação

Informações técnicas (tecnologia, linguagem, banco de dados, infra,
fornecedor etc.) são **opcionais** — um produto pode existir no catálogo
sem elas. Um produto pode ter **várias integrações** com outros produtos ou
sistemas externos (ex.: integração com a RFB). E pode ter **vários links de
documentação** (funcional, técnica, manual, repositório, Wiki, API,
institucional) — o sistema guarda só o link, nunca o arquivo em si.

## 1.12 Busca e filtros (seções 18/19)

A busca precisa funcionar mesmo quando quem procura não sabe o nome exato
do produto — por isso ela varre nome, sigla, descrição, categoria, área de
negócio, responsável, status e tipo ao mesmo tempo. Os filtros (categoria,
tipo, status, área, célula, responsável, impacto da Reforma Tributária,
iniciativa PDTI) podem ser combinados livremente entre si.

## 1.13 Nunca excluir fisicamente (RN-007)

Esta é talvez a regra mais importante do sistema do ponto de vista de
integridade de dados: **nenhum produto é excluído fisicamente**. "Excluir"
um produto, na prática, significa mudar seu `status` para `Descontinuado`,
registrar a data e o motivo. Isso preserva o histórico completo do
portfólio da COTIC ao longo do tempo — inclusive de produtos que já
saíram de operação há anos.

## 1.14 Histórico e auditoria (seções 21/32)

Toda alteração relevante em um produto (criação, mudança de campo, mudança
de status, validação, descontinuação) fica registrada: qual produto, qual
campo mudou, qual era o valor antes, qual é o valor depois, quem fez a
mudança, e quando. Esse histórico nunca é editado nem apagado por nenhuma
função do sistema — é um registro append-only (só cresce).

## 1.15 Perfis de acesso (seção 22)

Existem três perfis:

- **CONSULTA** — só pesquisa, filtra e visualiza. Não altera nada.
- **EDITOR** — além de consultar, cadastra produtos, edita informações e
  gerencia relacionamentos (iniciativas, integrações, documentos).
- **ADMINISTRADOR** — além de tudo que o EDITOR faz, também valida
  produtos, altera parâmetros do sistema, administra usuários, vê o
  histórico de auditoria, e descontinua produtos.

## 1.16 Autenticação (seção 23)

Não existe cadastro de senha neste sistema. A identidade de quem está
usando vem da própria conta Google (do Workspace da organização, no caso
real da SEFAZ-CE) — o e-mail autenticado é a chave que identifica a pessoa
e determina seu perfil de acesso.

## 1.17 Parametrização (seção 24)

Categorias, tipos, áreas de negócio, células da COTIC, fontes de
informação, iniciativas PDTI e usuários **não ficam escritos no código** —
ficam em tabelas (abas da planilha) que um ADMINISTRADOR pode alterar pela
própria tela do sistema, sem precisar de um programador para isso.

## 1.18 Dashboard e completude (seções 29/30)

A tela inicial do sistema mostra indicadores simples: quantidade total de
produtos, quantos por status, quantos por categoria, quantos estão em cada
etapa de validação, e quantos têm cadastro completo vs. pendente. Cada
produto individualmente também mostra seu **percentual de completude**
(ex.: 80%), calculado sobre os campos obrigatórios mínimos (seção 1.5).

## 1.19 Regras de qualidade que nunca podem ser violadas (seção 31)

- um produto **operacional** (Ativo/Em evolução/Em modernização) nunca pode
  ficar sem responsável, sem categoria, ou sem descrição;
- um produto **validado** nunca pode ficar sem fonte da informação (ver
  seção 1.20 abaixo);
- nenhuma duplicidade confirmada pode existir;
- ninguém sem permissão pode alterar um produto.

## 1.20 Fonte da informação (RN-006)

Toda informação "importante" só pode ser considerada oficial se tiver uma
fonte ou responsável identificado. Na prática, isso vira uma trava
concreta: **um produto não pode se tornar "Ativo" (validado) sem ter uma
fonte preenchida** — PDTI 2026/2027, Catálogo Intranet, Célula COTIC,
Documentação, Levantamento, ou Outra fonte.

## 1.21 O que ficou fora do MVP de propósito (seção 34)

Para não inviabilizar a primeira entrega, o sistema **não** faz: gestão de
projetos, gestão financeira, gestão de contratos, gestão de SLA, gestão de
incidentes, gestão de backlog, integração automática com Azure DevOps ou
com outros sistemas da SEFAZ, gestão documental completa (armazenamento de
arquivos), autenticação própria, workflow de aprovação multinível, ou
qualquer forma de inteligência artificial. Tudo isso é evolução futura
possível, não uma lacuna por esquecimento.

---

# PARTE 2 — Documentação Técnica

## 2.1 Stack e por que essas escolhas

| Camada | Tecnologia | Por quê |
|---|---|---|
| Aplicação/lógica | Google Apps Script (runtime V8), JavaScript | Roda nativamente integrado ao Google Workspace, sem servidor próprio para manter |
| Banco de dados | Google Sheets | Zero custo de infraestrutura, editável diretamente por um administrador em emergência, suficiente para o volume de um catálogo interno |
| Interface | SPA servida via `HtmlService` — HTML + CSS + JS puro | Sem build step, sem dependências externas, roda em qualquer navegador que o Apps Script sirva |
| Comunicação cliente↔servidor | `google.script.run` | É o único canal de RPC nativo do Apps Script para uma Web App |
| Autenticação | `Session.getActiveUser()` | Usa a identidade do Google diretamente, dispensando gestão de senhas (seção 1.16) |

Não há build, bundler, ou gerenciador de pacotes — o projeto é "puro":
cada arquivo do repositório corresponde a um arquivo dentro do editor do
Apps Script, 1 para 1.

## 2.2 Arquitetura em camadas

```
┌──────────────────────────────────────────────────────────────┐
│  NAVEGADOR — Index.html + CSS.html + JS_App.html               │
│  Tudo roda dentro da função IIFE de JS_App.html.                │
│  Estado do app vive em memória (objeto `estado`).                │
│  chamarServidor(nome, ...args) embrulha google.script.run        │
│  numa Promise — é o único ponto de saída para o backend.         │
└───────────────────────────┬──────────────────────────────────┘
                             │ google.script.run (RPC)
┌───────────────────────────▼──────────────────────────────────┐
│  Code.gs                                                        │
│  doGet() → serve a SPA. obterContextoInicial() → bootstrap.      │
├────────────────────────────────────────────────────────────────┤
│  SERVICES DE NEGÓCIO (cada um só fala com o nível abaixo,         │
│  nunca com SpreadsheetApp diretamente):                          │
│                                                                   │
│   ProdutoService  IniciativaService  IntegracaoService            │
│   DocumentoService  ParametroService  DashboardService            │
│           │                     │                                │
│           ▼                     ▼                                │
│   ValidacaoService         HistoricoService                      │
│   (normalização, duplicidade,  (grava toda alteração crítica —   │
│    completude, regras de        seções 21/32 do negócio)          │
│    qualidade — seção 1 inteira                                   │
│    deste documento)                                               │
│           │                                                       │
│           ▼                                                       │
│   AuthService (getUsuarioAtual_ / requirePerfil_)                 │
│           │                                                       │
│           ▼                                                       │
│   DatabaseService — ÚNICA camada que chama SpreadsheetApp          │
│   (getSheet_, getAllRecords_, criarRegistroComId_,                 │
│    updateRecordById_, deleteRecordById_, serializarRegistro_)      │
└───────────────────────────┬──────────────────────────────────┘
                             ▼
                    Planilha Google Sheets
              (uma aba por entidade — seção 2.4 abaixo)
```

**Regra de dependência (importante para manutenção):** nenhum arquivo de
service de negócio chama `SpreadsheetApp` diretamente. Se você precisar
mudar como os dados são lidos/gravados fisicamente, a mudança deveria
caber inteira dentro de `DatabaseService.gs`.

## 2.3 Arquivo por arquivo — o que cada um faz

### `appsscript.json` (manifesto)
Configura o runtime (`V8`), fuso horário (`America/Fortaleza`), e como o
Web App é publicado: `executeAs: "USER_ACCESSING"` + `access: "DOMAIN"`.
Essa combinação é o que permite ao sistema saber quem está logado (seção
1.16) — sem ela, `Session.getActiveUser()` não retorna nada.

### `Config.gs` (constantes — nenhuma função)
Fonte única de verdade para:
- `SHEET_NAMES` / `SHEET_HEADERS` — nome de cada aba e ordem exata das
  colunas. **Qualquer mudança de schema começa aqui.**
- `PERFIS`, `STATUS_PRODUTO`, `STATUS_OPERACIONAIS`,
  `STATUS_COM_FLUXO_PROPRIO` — os enums que viram regra de negócio no
  código (seções 1.7, 1.15).
- `IMPACTO_REFORMA_VALORES`, `TIPOS_DOCUMENTO_VALORES` — listas fechadas.
- `TIPOS_PRODUTO_INICIAIS`, `CATEGORIAS_INICIAIS`, `FONTES_INICIAIS` —
  valores de partida usados **só uma vez**, por `SetupService.gs`.
- `CAMPOS_OBRIGATORIOS_MINIMOS` — define o que entra no cálculo de
  completude (seção 1.5/1.18).

### `DatabaseService.gs` (acesso a dados — única camada que toca Sheets)
| Função | O que faz |
|---|---|
| `getSpreadsheet_()` | Resolve qual planilha usar: script vinculado → `SPREADSHEET_ID` salvo em `PropertiesService` → cria uma planilha nova na primeira execução |
| `getSheet_(sheetName)` | Retorna a aba, criando-a com cabeçalho se ainda não existir |
| `serializarRegistro_(obj)` | Converte qualquer valor `Date` do objeto em string ISO — **obrigatório** porque `google.script.run` quebra (retorna `null`) se a resposta contiver um `Date` cru (ver 2.8) |
| `sheetToObjects_(sheet)` | Converte a matriz de valores da aba em array de objetos `{coluna: valor}`, já serializado |
| `getAllRecords_(sheetName)` / `getRecordById_(sheetName, id)` | Leitura |
| `criarRegistroComId_(sheetName, prefix, padding, dados)` | **Único ponto de inserção do sistema**: gera o próximo ID sequencial e grava a linha dentro de um único `LockService.getScriptLock()`, para duas criações simultâneas nunca colidirem no mesmo ID (RN-002) |
| `updateRecordById_(sheetName, id, changes)` | Atualiza campos de uma linha, retorna `{anterior, atual}` (o "anterior" é usado para montar o histórico) |
| `deleteRecordById_(sheetName, id)` | Remoção física — usada **só** para `INTEGRACOES`, `DOCUMENTOS` e `PRODUTO_INICIATIVA`. Nunca para `PRODUTOS` (RN-007) |

### `AuthService.gs` (identidade e permissão)
| Função | O que faz |
|---|---|
| `getUsuarioAtual_()` | Pega o e-mail da sessão ativa; se a aba `USUARIOS` estiver vazia, o usuário atual vira `ADMINISTRADOR` automaticamente (bootstrap — é a única forma de alguém existir para cadastrar os demais); se o e-mail não estiver cadastrado, cai no perfil `CONSULTA` |
| `requirePerfil_(perfisPermitidos)` | Lança erro se o perfil do usuário atual não estiver na lista passada. Chamado no início de toda função pública que precisa restringir acesso |

> **A autorização real está sempre aqui, no servidor.** A interface esconde
> botões por conveniência, mas isso nunca é a barreira de segurança.

### `ValidacaoService.gs` (as regras de negócio "puras")
| Função | O que faz |
|---|---|
| `normalizarTexto_(texto)` | Minúsculo, sem acento, sem pontuação — base da busca e da duplicidade |
| `verificarDuplicidade_(nome, sigla, idExcluir)` | Implementa a RN-003 (seção 1.4): nome igual/normalizado igual = bloqueio; sigla igual ou nome contido um no outro = aviso que exige confirmação |
| `calcularCompletude_(produto)` | Percentual sobre `CAMPOS_OBRIGATORIOS_MINIMOS` (seção 1.5/1.18) |
| `validarRegrasQualidade_(produtoSimulado)` | Implementa a seção 1.19: bloqueia produto operacional sem responsável/categoria/descrição, e produto Ativo sem fonte (RN-006) |

### `HistoricoService.gs` (auditoria)
| Função | O que faz |
|---|---|
| `registrarHistorico_(produtoId, campo, valorAnterior, valorNovo, operacao)` | Grava uma linha de histórico. Chamado por todo service que altera um produto |
| `listarHistoricoProduto(produtoId)` | Exposta ao cliente, só para perfil `ADMINISTRADOR` (seção 1.15) |

### `ProdutoService.gs` (coração do sistema — a entidade Produto)
| Função | O que faz |
|---|---|
| `listarProdutos(filtros)` | Busca global + filtros combináveis (seção 1.12); por padrão exclui `Descontinuado` |
| `obterProduto(id)` | Devolve o produto completo + completude + iniciativas vinculadas + integrações + documentos |
| `criarProduto(dados, confirmarDuplicidade)` | Nasce sempre como `Em levantamento` (seção 1.8), ignorando qualquer status enviado pelo cliente; verifica duplicidade antes de salvar |
| `atualizarProduto(id, alteracoes)` | Edição genérica de campos. Bloqueia mudar `status` diretamente para `Ativo`/`Descontinuado` (isso tem função própria); exige `ADMINISTRADOR` para alterar `impacto_reforma_tributaria` (seção 1.10) |
| `avancarParaValidacao(id)` | `Em levantamento` → `Em validação` |
| `validarProduto(id)` | `Em validação` → `Ativo`, só `ADMINISTRADOR`, só se completude = 100% e regras de qualidade passarem (RN-005 + RN-006) |
| `descontinuarProduto(id, motivo)` | Muda status para `Descontinuado`, exige motivo, nunca apaga a linha (RN-007) |

### `IniciativaService.gs` (PDTI e a relação N:N)
| Função | O que faz |
|---|---|
| `listarIniciativas()` | Lista iniciativas ativas |
| `salvarIniciativa(item)` | Cria/edita uma iniciativa (só `ADMINISTRADOR`) |
| `vincularIniciativa(produtoId, iniciativaId)` | Cria o vínculo N:N (seção 1.9); impede duplicar o mesmo par |
| `desvincularIniciativa(vinculoId)` | Remove o vínculo (remoção física — não é regida pela RN-007, que é só sobre produtos) |

### `IntegracaoService.gs` e `DocumentoService.gs`
CRUD simples (listar/salvar/remover) para as integrações (seção 1.11) e os
links de documentação (seção 1.11) de um produto. Ambos permitem remoção
física — não são "produtos", então a RN-007 não se aplica a eles.

### `ParametroService.gs` (administração — seção 1.17)
| Função | O que faz |
|---|---|
| `listarListaSimples(nomeLista)` | Lê uma das 5 listas parametrizáveis (`CATEGORIAS`, `TIPOS`, `AREAS`, `CELULAS`, `FONTES`) |
| `salvarItemListaSimples(nomeLista, item)` | Cria/edita um item dessas listas — só `ADMINISTRADOR` |
| `listarUsuarios()` / `salvarUsuario(item)` | Administração de usuários e perfis — só `ADMINISTRADOR` |

### `DashboardService.gs`
| Função | O que faz |
|---|---|
| `obterIndicadores()` | Monta os números da seção 1.18: total geral, total no catálogo principal, por status, por categoria, situação de validação, completos vs. incompletos |

### `SetupService.gs` (configuração inicial — rodado manualmente, uma vez)
| Função | O que faz |
|---|---|
| `configurarAmbiente()` | Cria todas as abas com cabeçalho e popula `TIPOS`/`CATEGORIAS`/`FONTES` com os valores de partida — idempotente, não sobrescreve listas já preenchidas |
| `seedListaSimples_(nomeLista, valores)` | Helper interno de `configurarAmbiente` |
| `onOpen()` | Se o script estiver vinculado à planilha, cria um menu "Catálogo COTIC" com atalho para `configurarAmbiente` |

### `Code.gs` (ponto de entrada)
| Função | O que faz |
|---|---|
| `doGet()` | Serve `Index.html` como a Web App |
| `include(nomeArquivo)` | Helper usado dentro dos templates HTML para injetar `CSS.html`/`JS_App.html` dentro de `Index.html` |
| `obterContextoInicial()` | Primeira chamada do cliente ao abrir o app: devolve o usuário autenticado + todas as listas paramétricas (para popular os `<select>` da interface) |

### `Index.html` (shell da SPA)
Estrutura estática: topbar (logo, navegação, botão de tema), um `<main>`
vazio que o JavaScript preenche dinamicamente, e o container de modal.
Também tem um pequeno `<script>` inline no `<head>` que aplica o tema
salvo **antes** da primeira renderização, evitando um "flash" do tema
errado.

### `CSS.html`
Todo o visual do sistema, usando variáveis CSS (`:root { --nome: valor }`)
para permitir dois temas (claro/escuro) sem duplicar regras — só os
*valores* das variáveis mudam entre `:root` (claro) e
`:root[data-theme="dark"]` / `@media (prefers-color-scheme: dark)`. Ver
seção 2.9 para os detalhes do sistema de tema.

### `JS_App.html` (toda a lógica de cliente)
Uma única IIFE para não vazar variáveis globais no `window`. Internamente
se organiza em seções (procure pelos comentários `// ---------- Nome
----------`): infraestrutura de chamada ao servidor, helpers de
formatação, modal genérico, tema, inicialização, busca/listagem, detalhe
do produto, formulário de cadastro/edição, dashboard, administração.

## 2.4 Modelo de dados — uma aba por entidade

| Aba | Campos | Observação de manutenção |
|---|---|---|
| `PRODUTOS` | ver `SHEET_HEADERS.PRODUTOS` em `Config.gs` (24 colunas) | `nome_normalizado` é técnico, nunca exibido — existe só para a RN-003 funcionar sem recalcular normalização toda hora |
| `CATEGORIAS`, `TIPOS`, `AREAS`, `CELULAS`, `FONTES` | `id, nome, ordem, ativo` | Mesmo shape nas 5; `AREAS`/`CELULAS` não têm seed automático (são específicas da SEFAZ-CE) |
| `USUARIOS` | `id, email, nome, perfil, ativo` | Chave de negócio é `email` (case-insensitive) |
| `INICIATIVAS_PDTI` | `id, nome, grupo_tematico, descricao, ativo` | Entidade independente de Produto (seção 1.2) |
| `PRODUTO_INICIATIVA` | `id, produto_id, iniciativa_id, data_vinculo` | Tabela de junção N:N; par não pode repetir |
| `INTEGRACOES` | `id, produto_id, produto_relacionado_id, nome_integracao, tipo, descricao` | Removível fisicamente |
| `DOCUMENTOS` | `id, produto_id, tipo, titulo, url` | Só links, nunca arquivo |
| `HISTORICO` | `id, produto_id, campo, valor_anterior, valor_novo, usuario, data_hora, operacao` | Append-only |
| `CONFIG` | `chave, valor` | Reservada; nenhum service usa hoje |

## 2.5 API do servidor — toda função pública

Convenção do projeto: função pública = sem `_` no final (pode ser chamada
pelo cliente via `google.script.run`); função privada = com `_` no final
(nunca exposta, só chamada por outro arquivo `.gs`).

| Função | Arquivo | Perfil mínimo |
|---|---|---|
| `obterContextoInicial()` | Code.gs | qualquer |
| `listarProdutos(filtros)` | ProdutoService.gs | qualquer |
| `obterProduto(id)` | ProdutoService.gs | qualquer |
| `criarProduto(dados, confirmarDuplicidade)` | ProdutoService.gs | EDITOR+ |
| `atualizarProduto(id, alteracoes)` | ProdutoService.gs | EDITOR+ (ADMIN para `impacto_reforma_tributaria`) |
| `avancarParaValidacao(id)` | ProdutoService.gs | EDITOR+ |
| `validarProduto(id)` | ProdutoService.gs | ADMINISTRADOR |
| `descontinuarProduto(id, motivo)` | ProdutoService.gs | ADMINISTRADOR |
| `listarHistoricoProduto(id)` | HistoricoService.gs | ADMINISTRADOR |
| `listarIniciativas()` | IniciativaService.gs | qualquer |
| `salvarIniciativa(item)` | IniciativaService.gs | ADMINISTRADOR |
| `vincularIniciativa(produtoId, iniciativaId)` | IniciativaService.gs | EDITOR+ |
| `desvincularIniciativa(vinculoId)` | IniciativaService.gs | EDITOR+ |
| `listarIntegracoes(produtoId)` | IntegracaoService.gs | qualquer |
| `salvarIntegracao(item)` | IntegracaoService.gs | EDITOR+ |
| `removerIntegracao(id)` | IntegracaoService.gs | EDITOR+ |
| `listarDocumentos(produtoId)` | DocumentoService.gs | qualquer |
| `salvarDocumento(item)` | DocumentoService.gs | EDITOR+ |
| `removerDocumento(id)` | DocumentoService.gs | EDITOR+ |
| `listarListaSimples(nomeLista)` | ParametroService.gs | qualquer |
| `salvarItemListaSimples(nomeLista, item)` | ParametroService.gs | ADMINISTRADOR |
| `listarUsuarios()` / `salvarUsuario(item)` | ParametroService.gs | ADMINISTRADOR |
| `obterIndicadores()` | DashboardService.gs | qualquer |
| `configurarAmbiente()` | SetupService.gs | executado manualmente pelo editor |

Toda função pública que falha lança `Error(mensagem)` em português, pronta
para ser exibida ao usuário — as mensagens de erro do backend não são
detalhes técnicos, são texto de UI.

## 2.6 Máquina de estados do produto

```
   criarProduto()
        │  status = "Em levantamento" (sempre)
        ▼
 Em levantamento ──avancarParaValidacao()──▶ Em validação
                                                  │
                                    validarProduto() [ADMINISTRADOR]
                                    · completude = 100%
                                    · validarRegrasQualidade_ passa
                                                  ▼
                                               Ativo ◀──┐
                                                 │       │ atualizarProduto()
                          atualizarProduto() ────┤       │ (livre, exceto
                          → Em evolução /         │       │  para Ativo/
                            Em modernização /     │       │  Descontinuado)
                            Em substituição /     │       │
                            Legado ───────────────┘       │
                                                           │
                                    descontinuarProduto() [ADMINISTRADOR]
                                    · exige motivo · nunca deleta (RN-007)
                                                  ▼
                                            Descontinuado
```

`STATUS_COM_FLUXO_PROPRIO = ['Ativo', 'Descontinuado']` (em `Config.gs`) é
o que impede esses dois status de serem setados por uma edição genérica.

## 2.7 Frontend — como o estado e as views funcionam

- **Estado** (`estado`, objeto em memória): `contexto` (usuário + listas,
  carregado uma vez), `view` atual, `produtos` (cache da última busca),
  `filtros`, `produtoAtual`.
- **`chamarServidor(nomeFuncao, ...args)`** — ponto único de chamada RPC,
  retorna uma `Promise`.
- **Views** (`irParaView`): `busca`, `dashboard`, `novo`, `admin`. Cada
  `render*` reconstrói o `innerHTML` de `#conteudo` diretamente — não há
  virtual DOM, framework ou componentes.
- **Modal genérico** (`abrirModal`/`fecharModal`) — usado para
  confirmações, histórico, e formulários pequenos.
- **`escapeHtml`** — usado em toda interpolação de dado do usuário dentro
  de `innerHTML`, para evitar XSS armazenado.
- **Permissão no cliente** (`podeEditar()`/`ehAdmin()`) — controla só o que
  aparece na tela. A autorização de verdade está sempre no servidor (2.3,
  `AuthService.gs`).

## 2.8 Duas armadilhas já encontradas (e corrigidas) — leia antes de mexer

**a) `google.script.run` não serializa `Date`.** Se uma função pública
devolver um objeto contendo um valor `Date` cru, o cliente recebe `null`
no lugar da resposta inteira — sem erro explícito. Foi um bug real deste
projeto (afetava `criarProduto`). A correção: `serializarRegistro_`
(`DatabaseService.gs`) converte todo `Date` para string ISO antes de
qualquer objeto sair de `sheetToObjects_`, `criarRegistroComId_` ou
`updateRecordById_`. **Regra para código novo:** nunca devolva um `new
Date()` cru de uma função pública para o cliente.

**b) Geração de ID sob concorrência (RN-002).** Calcular `max(id) + 1` e
inserir a linha precisam ser atômicos. Por isso existe **só uma** função de
inserção no sistema, `criarRegistroComId_`, que faz as duas coisas dentro
de um único `LockService.getScriptLock()`. Nunca separe "gerar ID" de
"inserir linha" em duas chamadas.

## 2.9 Sistema de tema (claro/escuro)

Implementado inteiramente com variáveis CSS — nenhuma duplicação de regra:

- `:root { --variavel: valor }` define a paleta clara (padrão);
- `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {...} }`
  troca os valores automaticamente se o sistema operacional do usuário
  estiver em modo escuro;
- `:root[data-theme="dark"] {...}` força o escuro mesmo em SO claro (ativado
  pelo botão de tema);
- o fundo da página usa `--fundo-pagina` (um degradê azul-marinho no modo
  escuro, cor sólida no claro) em vez de `--cinza-bg` diretamente, porque
  gradiente e cor sólida são valores incompatíveis de guardar numa única
  variável usada em elementos pequenos (por isso `--input-bg` existe à
  parte, para campos de formulário não herdarem um gradiente fatiado);
- `--azul-cotic` (fundo fixo da topbar) é uma variável **separada** de
  `--azul-medio` (texto de destaque) — são a mesma cor em versões antigas
  do CSS, mas precisaram ser separadas porque uma delas tem que
  permanecer escura em ambos os temas (fundo da topbar) e a outra precisa
  inverter (texto que fica sobre fundos que mudam de claro para escuro).
- a escolha do usuário é persistida em `localStorage` (`catalogo_tema`) e
  reaplicada via um script inline no `<head>` de `Index.html`, antes do
  `CSS.html` ser processado, para não haver flash do tema errado.

## 2.10 Configuração, implantação e operação

Resumo (ver `README.md` para o passo a passo completo):

- **Primeira execução:** rodar `configurarAmbiente()` manualmente no
  editor do Apps Script.
- **Subir código:** `clasp push` (recomendado — sobe tudo de uma vez) ou
  cópia manual arquivo a arquivo. Se for manual: **os 13 arquivos de
  lógica devem ser tipo Script (`.gs`), nunca HTML** — um arquivo de
  lógica criado como HTML nunca entra no escopo global do servidor
  (bug real já visto neste projeto: `getUsuarioAtual_ is not defined`
  porque `AuthService` tinha sido criado como `.html`).
- **`appsscript.json`:** `access: "DOMAIN"` só funciona dentro de um
  domínio Google Workspace real; para testar com conta pessoal, use
  `access: "MYSELF"`.
- **`SPREADSHEET_ID`** fica em `PropertiesService.getScriptProperties()`,
  setado automaticamente na primeira vez que `getSpreadsheet_()` precisa
  criar a planilha.

## 2.11 Decisões técnicas registradas (para não serem "redescobertas")

- `nome_normalizado` é um campo técnico extra em `PRODUTOS`, fora da lista
  oficial de campos do documento de negócio — existe só para a RN-003
  funcionar sem recálculo repetido.
- `STATUS_PRODUTO` e `PERFIS` são constantes de código, não abas
  administráveis, porque o documento de negócio amarra comportamento
  específico a cada valor (RN-004, RN-005, seção 1.15) — diferente de
  `CATEGORIAS`/`TIPOS`/`AREAS`/`CELULAS`/`FONTES`, que são só rótulos.
- `LockService` serializa escritas no nível do **script inteiro**, não por
  aba/linha — suficiente para o volume de um catálogo interno, mas seria
  um gargalo sob volume de escrita muito alto (não é o caso do MVP).
- Toda listagem/filtro lê a aba inteira em memória (`getDataRange().getValues()`),
  sem índice nem paginação no servidor — adequado para dezenas/centenas de
  produtos; passaria a valer a pena otimizar numa base de milhares.
- A aba `CONFIG` (`chave`/`valor`) existe mas nenhum service a usa hoje —
  reservada para parâmetros livres futuros.
- Sem testes automatizados (fora do escopo do MVP). Verificação feita via
  checagem de sintaxe (`node --check`) sobre cada arquivo e um roteiro de
  teste manual (cadastro → duplicidade → completude → validação → vínculo
  PDTI → integrações/documentos → descontinuação → histórico → dashboard →
  perfis), além de validação visual por screenshot headless para mudanças
  de CSS/tema.

## 2.12 Como estender o sistema

**Novo campo em `PRODUTOS`:**
1. Acrescente a coluna em `SHEET_HEADERS.PRODUTOS` (`Config.gs`) — a ordem
   importa, é a ordem física das colunas na planilha.
2. Se for obrigatório para completude, acrescente a
   `CAMPOS_OBRIGATORIOS_MINIMOS`.
3. Inclua o campo em `dadosProduto` (`ProdutoService.criarProduto`) e, se
   editável, no formulário (`renderFormularioProduto`/`coletarDadosFormulario`
   em `JS_App.html`).
4. Abas já existentes **não** ganham a coluna nova sozinhas — adicione o
   cabeçalho manualmente na planilha real.

**Nova lista paramétrica simples:** acrescente o nome em `SHEET_NAMES` e
`SHEET_HEADERS` (shape `['id','nome','ordem','ativo']`), inclua a chave em
`LISTAS_SIMPLES_PERMITIDAS_` (`ParametroService.gs`), e adicione em
`LISTAS_ADMIN` (`JS_App.html`) para aparecer na tela de Administração.

**Nova função pública:** comece com `requirePerfil_([...])` se precisar
restringir acesso, nunca retorne um `Date` cru (2.8), e documente o perfil
mínimo na tabela da seção 2.5.

## 2.13 Problemas conhecidos e como diagnosticar

| Sintoma | Causa provável | Onde olhar |
|---|---|---|
| `ReferenceError: <algumaFuncao_> is not defined` | Arquivo de lógica criado como HTML em vez de Script no editor manual | Lista de arquivos do projeto Apps Script — confira contra a seção 2.3 |
| `Cannot read properties of null (reading '<campo>')` logo após uma ação de escrita | Função pública retornou objeto com `Date` cru | `serializarRegistro_` deveria cobrir qualquer novo ponto de leitura/escrita — seção 2.8 |
| Dropdown de Categoria/Tipo/Fonte vazio | `configurarAmbiente()` nunca foi executado | Rodar a função uma vez pelo editor |
| Dropdown de Área/Célula vazio | Por design — não têm seed automático | Cadastrar em Administração |
| "Permissão negada para o perfil…" | Perfil atual não está na lista exigida pela função | Conferir aba `USUARIOS` e a tabela da seção 2.5 |
| `Session.getActiveUser()` retorna vazio | Web App implantado com `access` incompatível com o tipo de conta | Seção 2.10 — `DOMAIN` exige domínio Workspace; use `MYSELF` para teste individual |
