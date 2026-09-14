/**
 * Ponto de entrada do Web App (interface do catálogo).
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Catálogo de Produtos - COTIC/SEFAZ-CE')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(nomeArquivo) {
  return HtmlService.createHtmlOutputFromFile(nomeArquivo).getContent();
}

/**
 * Carregado uma vez ao abrir a aplicação: identifica o usuário (seção 23) e
 * traz todas as listas paramétricas para popular filtros e formulários.
 */
function obterContextoInicial() {
  var usuario = getUsuarioAtual_();
  return {
    usuario: { email: usuario.email, nome: usuario.nome, perfil: usuario.perfil },
    listas: {
      categorias: listarListaSimples('CATEGORIAS'),
      tipos: listarListaSimples('TIPOS'),
      areas: listarListaSimples('AREAS'),
      celulas: listarListaSimples('CELULAS'),
      fontes: listarListaSimples('FONTES'),
      iniciativas: listarIniciativas(),
      status: Object.keys(STATUS_PRODUTO).map(function (k) { return STATUS_PRODUTO[k]; }),
      impactos: IMPACTO_REFORMA_VALORES,
      tiposDocumento: TIPOS_DOCUMENTO_VALORES,
      perfis: Object.keys(PERFIS).map(function (k) { return PERFIS[k]; })
    }
  };
}
