/**
 * Configurações e parâmetros estruturais do Catálogo de Produtos COTIC/SEFAZ-CE.
 *
 * IMPORTANTE: aqui só ficam nomes de abas, cabeçalhos de tabela e os valores
 * "de partida" das listas paramétricas (usados apenas na primeira configuração,
 * feita por SetupService.gs). Depois de configurado, categorias, tipos, áreas,
 * células, fontes e iniciativas PDTI são administrados pelas próprias abas da
 * planilha / tela de Administração (RN seção 24), não pelo código.
 *
 * STATUS e PERFIS permanecem como constantes de código porque o fluxo de
 * transição de status (RN-004/RN-005) e as permissões por perfil (seção 22)
 * são regras de negócio com comportamento específico amarrado a cada valor,
 * não apenas rótulos de exibição.
 */

var SHEET_NAMES = {
  PRODUTOS: 'PRODUTOS',
  CATEGORIAS: 'CATEGORIAS',
  TIPOS: 'TIPOS',
  AREAS: 'AREAS',
  CELULAS: 'CELULAS',
  FONTES: 'FONTES',
  USUARIOS: 'USUARIOS',
  INICIATIVAS_PDTI: 'INICIATIVAS_PDTI',
  PRODUTO_INICIATIVA: 'PRODUTO_INICIATIVA',
  INTEGRACOES: 'INTEGRACOES',
  DOCUMENTOS: 'DOCUMENTOS',
  HISTORICO: 'HISTORICO',
  CONFIG: 'CONFIG'
};

var SHEET_HEADERS = {
  PRODUTOS: [
    'id', 'nome', 'nome_normalizado', 'sigla', 'descricao', 'tipo', 'categoria',
    'area_negocio', 'processo_negocio', 'publico_alvo', 'finalidade',
    'responsavel_negocio', 'responsavel_cotic', 'responsavel_tecnico', 'celula_cotic',
    'status', 'impacto_reforma_tributaria', 'fonte',
    'data_cadastro', 'data_atualizacao', 'data_validacao', 'usuario_validacao',
    'motivo_descontinuacao', 'observacoes'
  ],
  CATEGORIAS: ['id', 'nome', 'ordem', 'ativo'],
  TIPOS: ['id', 'nome', 'ordem', 'ativo'],
  AREAS: ['id', 'nome', 'ordem', 'ativo'],
  CELULAS: ['id', 'nome', 'ordem', 'ativo'],
  FONTES: ['id', 'nome', 'ordem', 'ativo'],
  USUARIOS: ['id', 'email', 'nome', 'perfil', 'ativo'],
  INICIATIVAS_PDTI: ['id', 'nome', 'grupo_tematico', 'descricao', 'ativo'],
  PRODUTO_INICIATIVA: ['id', 'produto_id', 'iniciativa_id', 'data_vinculo'],
  INTEGRACOES: ['id', 'produto_id', 'produto_relacionado_id', 'nome_integracao', 'tipo', 'descricao'],
  DOCUMENTOS: ['id', 'produto_id', 'tipo', 'titulo', 'url'],
  HISTORICO: ['id', 'produto_id', 'campo', 'valor_anterior', 'valor_novo', 'usuario', 'data_hora', 'operacao'],
  CONFIG: ['chave', 'valor']
};

var PERFIS = {
  CONSULTA: 'CONSULTA',
  EDITOR: 'EDITOR',
  ADMINISTRADOR: 'ADMINISTRADOR'
};

var STATUS_PRODUTO = {
  EM_LEVANTAMENTO: 'Em levantamento',
  EM_VALIDACAO: 'Em validação',
  ATIVO: 'Ativo',
  EM_EVOLUCAO: 'Em evolução',
  EM_MODERNIZACAO: 'Em modernização',
  EM_SUBSTITUICAO: 'Em substituição',
  LEGADO: 'Legado',
  DESCONTINUADO: 'Descontinuado'
};

// RN-004: apenas estes status contam como produto operacional no catálogo principal.
var STATUS_OPERACIONAIS = [
  STATUS_PRODUTO.ATIVO,
  STATUS_PRODUTO.EM_EVOLUCAO,
  STATUS_PRODUTO.EM_MODERNIZACAO
];

// Status que não devem aparecer sob demanda de status jamais alteráveis por atualizarProduto()
// (exigem fluxo específico: validarProduto() e descontinuarProduto()).
var STATUS_COM_FLUXO_PROPRIO = [STATUS_PRODUTO.ATIVO, STATUS_PRODUTO.DESCONTINUADO];

var IMPACTO_REFORMA_VALORES = ['Não identificado', 'Sem impacto', 'Baixo', 'Médio', 'Alto', 'Crítico'];

var TIPOS_DOCUMENTO_VALORES = [
  'Documentação funcional', 'Documentação técnica', 'Manual', 'Repositório',
  'Sistema', 'Wiki', 'Documentação de API', 'Documento institucional', 'Outro'
];

// Valores de partida para as listas paramétricas (seção 24), usados só no
// primeiro carregamento (SetupService.configurarAmbiente). Depois disso a
// administração é feita pela tela de Administração / diretamente na planilha.
var TIPOS_PRODUTO_INICIAIS = [
  'Sistema de Negócio', 'Sistema Corporativo', 'Produto de Dados', 'Plataforma',
  'Serviço de TI', 'Solução de Integração', 'Produto de IA', 'Infraestrutura',
  'Sistema Legado', 'Outro'
];

var CATEGORIAS_INICIAIS = [
  'Arrecadação e Fiscalização', 'Cadastro e Consultas', 'Documentação e Processos',
  'Gestão Interna / RH', 'Relacionamento e Cidadania', 'Inteligência e Auditoria',
  'Dados / BI / Analytics', 'Tecnologia e Segurança', 'Infraestrutura', 'Legados', 'Outros'
];

var FONTES_INICIAIS = [
  'PDTI 2026/2027', 'Catálogo Intranet', 'Célula COTIC', 'Documentação', 'Levantamento', 'Outra fonte'
];

// Campos mínimos obrigatórios do cadastro (seção 6). Usados para: (a) calcular
// o indicador de completude (seção 30) e (b) impedir que um produto seja
// considerado "Validado" sem eles (seção 6 / seção 11 RN-005).
var CAMPOS_OBRIGATORIOS_MINIMOS = [
  { campo: 'nome', label: 'Nome' },
  { campo: 'descricao', label: 'Descrição' },
  { campo: 'tipo', label: 'Tipo de produto' },
  { campo: 'categoria', label: 'Categoria' },
  { campo: 'status', label: 'Status' },
  { campo: 'area_negocio', label: 'Área de negócio' },
  { campo: 'processo_negocio', label: 'Processo de negócio atendido' },
  { campo: 'publico_alvo', label: 'Público-alvo' },
  { campo: 'finalidade', label: 'Finalidade' },
  { campo: 'responsavel_negocio', label: 'Responsável de negócio' },
  { campo: 'responsavel_cotic', label: 'Responsável COTIC' },
  { campo: 'celula_cotic', label: 'Célula/área COTIC responsável' }
];
