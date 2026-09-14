# Catálogo de Produtos — COTIC/SEFAZ-CE

MVP em Google Apps Script + Google Sheets para centralizar, padronizar,
consultar e manter as informações dos produtos do negócio gerenciados pela
COTIC, conforme o *Documento de Regras de Negócio v1.0*.

Este projeto implementa exclusivamente as regras de negócio do documento
(seções 1–40). Decisões técnicas necessárias para viabilizar o MVP (formato de
ID, campos internos como `nome_normalizado`, layout de telas, etc.) foram
tomadas dentro do espaço deixado em aberto pela seção 39 ("Fora do escopo
deste documento") e pela diretriz 40, sem inventar regra de negócio nova.

## Arquitetura

```
src/
├── appsscript.json        Manifesto do Web App (executeAs=USER_ACCESSING, access=DOMAIN)
├── Code.gs                doGet() e obterContextoInicial() — ponto de entrada
├── Config.gs              Nomes de abas, cabeçalhos, enums de status/perfil/impacto
├── DatabaseService.gs     CRUD genérico sobre o Google Sheets (única camada que fala com SpreadsheetApp)
├── AuthService.gs         Identificação via Workspace + perfis (CONSULTA/EDITOR/ADMINISTRADOR)
├── ValidacaoService.gs    Normalização de texto, duplicidade (RN-003), completude, regras de qualidade
├── HistoricoService.gs    Log de auditoria/histórico (seções 21 e 32)
├── ProdutoService.gs      Regras da entidade PRODUTO: cadastro, edição, validação, descontinuação
├── IniciativaService.gs   Iniciativas PDTI e vínculo N:N produto↔iniciativa (seção 13)
├── IntegracaoService.gs   Integrações do produto (seção 16)
├── DocumentoService.gs    Links de documentação do produto (seção 17)
├── ParametroService.gs    Administração das listas paramétricas e usuários (seção 24)
├── DashboardService.gs    Indicadores do dashboard mínimo (seção 29)
├── SetupService.gs        configurarAmbiente() — cria abas e semeia listas iniciais
├── Index.html             Shell da SPA
├── CSS.html               Estilos
└── JS_App.html            Toda a lógica de cliente (busca, cadastro, detalhe, dashboard, admin)
```

### Banco de dados (Google Sheets)

Abas criadas automaticamente por `configurarAmbiente()`, conforme a seção 36:
`PRODUTOS`, `CATEGORIAS`, `TIPOS`, `AREAS`, `CELULAS`, `FONTES`, `USUARIOS`,
`INICIATIVAS_PDTI`, `PRODUTO_INICIATIVA`, `INTEGRACOES`, `DOCUMENTOS`,
`HISTORICO`, `CONFIG`.

`PRODUTOS` segue os campos da seção 37, acrescido apenas de
`nome_normalizado` (detalhe técnico interno para a verificação de
duplicidade da RN-003 — nunca exibido ao usuário).

Categorias, tipos, áreas, células, fontes e iniciativas PDTI são
totalmente parametrizáveis (seção 24): administradas pela tela de
Administração ou diretamente na planilha, sem qualquer valor "hard-coded"
no código-fonte. Já `STATUS` e `PERFIS` permanecem como constantes porque o
próprio documento amarra comportamento de sistema a cada valor específico
(RN-004, RN-005, seção 22) — não são simples rótulos de exibição.

## Regras de negócio implementadas

| Regra | Onde |
|---|---|
| RN-001 (Produto ≠ projeto/iniciativa) | `IniciativaService.gs` mantém iniciativas PDTI em entidade e relação N:N separadas |
| RN-002 (ID único, nunca reaproveitado) | `DatabaseService.generateNextId_` + RN-007 (nunca há exclusão física) |
| RN-003 (nome único / duplicidade) | `ValidacaoService.verificarDuplicidade_`, usado em `criarProduto`/`atualizarProduto` |
| RN-004 (status "Ativo" = operacional) | `Config.STATUS_OPERACIONAIS`, usado em listagens e regras de qualidade |
| RN-005 (fluxo de validação) | `ProdutoService.avancarParaValidacao` / `validarProduto` |
| RN-006 (fonte obrigatória p/ info oficial) | `ValidacaoService.validarRegrasQualidade_` |
| RN-007 (sem exclusão física) | Produtos só mudam de `status` para `Descontinuado`; nunca há `deleteRow` sobre `PRODUTOS` |
| Seção 10/22 (responsáveis e perfis) | `AuthService.gs`, checagens `requirePerfil_` em cada service |
| Seção 13 (N:N produto↔iniciativa) | `PRODUTO_INICIATIVA` + `IniciativaService.vincularIniciativa/desvincularIniciativa` |
| Seção 14 (impacto Reforma Tributária editável só por autorizado) | `ProdutoService.atualizarProduto` exige `ADMINISTRADOR` para esse campo |
| Seção 18/19 (busca global + filtros combináveis) | `ProdutoService.listarProdutos` |
| Seção 21/32 (histórico e auditoria) | `HistoricoService.gs`, chamado em toda operação crítica |
| Seção 29/30 (dashboard e completude) | `DashboardService.gs`, `ValidacaoService.calcularCompletude_` |
| Seção 31 (regras de qualidade) | `ValidacaoService.validarRegrasQualidade_` |

## Como configurar

1. **Criar o projeto Apps Script**
   - Opção A (recomendada): use o [`clasp`](https://github.com/google/clasp).
     ```bash
     npm install -g @google/clasp
     clasp login
     clasp create --type webapp --title "Catálogo de Produtos COTIC" --rootDir src
     ```
     Copie o `scriptId` gerado para um arquivo `.clasp.json` na raiz do
     projeto (use `.clasp.json.example` como modelo) e rode `clasp push`.
   - Opção B: crie manualmente um projeto em script.google.com e cole o
     conteúdo de cada arquivo de `src/`.

2. **Rodar a configuração inicial**
   No editor do Apps Script, execute a função `configurarAmbiente` (arquivo
   `SetupService.gs`) uma única vez. Ela cria a planilha (se o script não
   estiver vinculado a uma existente), todas as abas e os valores de partida
   das listas paramétricas.
   - Se preferir vincular a uma planilha Google Sheets já existente, crie o
     script a partir de **Extensões → Apps Script** dentro dela antes deste
     passo.

3. **Publicar como Web App**
   Implantar → Nova implantação → tipo "Aplicativo da Web":
   - Executar como: **Usuário que acessa o app**
   - Quem tem acesso: **Qualquer pessoa em [seu domínio Google Workspace]**

   Essa combinação é o que permite ao sistema identificar o usuário pelo
   e-mail do Workspace, sem senha própria (seção 23).

4. **Primeiro administrador**
   A primeira pessoa a abrir o Web App é automaticamente registrada como
   `ADMINISTRADOR` na aba `USUARIOS` (é a única forma de existir alguém apto
   a cadastrar os demais usuários). A partir daí, use a tela
   **Administração → Usuários e perfis** para conceder `EDITOR` ou
   `ADMINISTRADOR` a outras pessoas; quem não estiver cadastrado permanece
   com acesso `CONSULTA` (somente leitura).

## Fora do escopo (conforme seção 34)

Não implementados neste MVP, por definição do próprio documento de regras:
gestão de projetos/financeira/contratos/SLA/incidentes/backlog, integração
automática com Azure DevOps ou outros sistemas da SEFAZ, gestão documental
completa, autenticação própria, workflow multinível e inteligência
artificial.
