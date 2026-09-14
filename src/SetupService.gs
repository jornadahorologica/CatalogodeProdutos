/**
 * Configuração inicial do ambiente. Execute a função configurarAmbiente()
 * manualmente uma única vez pelo editor do Apps Script (ou pelo menu
 * "Catálogo COTIC" da planilha, se este script estiver vinculado a ela)
 * antes do primeiro uso do sistema.
 *
 * O que ela faz:
 *  - cria todas as abas exigidas pela seção 25/36 com seus cabeçalhos;
 *  - popula as listas paramétricas (categorias, tipos, fontes) com os
 *    valores de partida sugeridos no documento de regras (seções 7, 8 e 12).
 * Não sobrescreve dados existentes: se uma lista já tiver itens, ela é
 * mantida como está.
 */
function configurarAmbiente() {
  Object.keys(SHEET_HEADERS).forEach(function (nomeAba) {
    getSheet_(nomeAba);
  });

  seedListaSimples_('TIPOS', TIPOS_PRODUTO_INICIAIS);
  seedListaSimples_('CATEGORIAS', CATEGORIAS_INICIAIS);
  seedListaSimples_('FONTES', FONTES_INICIAIS);

  try {
    SpreadsheetApp.getUi().alert('Ambiente do Catálogo de Produtos configurado com sucesso.');
  } catch (e) {
    Logger.log('Ambiente configurado com sucesso. Planilha: ' + getSpreadsheet_().getUrl());
  }
}

function seedListaSimples_(nomeLista, valores) {
  var sheetName = SHEET_NAMES[nomeLista];
  var existentes = getAllRecords_(sheetName);
  if (existentes.length > 0) return;

  valores.forEach(function (nome, indice) {
    criarRegistroComId_(sheetName, nomeLista.substring(0, 3), 3, { nome: nome, ordem: indice + 1, ativo: true });
  });
}

// Opcional: se o script for vinculado à planilha, cria um menu de atalho.
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Catálogo COTIC')
      .addItem('Configurar ambiente', 'configurarAmbiente')
      .addToUi();
  } catch (e) {
    // Sem UI de planilha disponível (ex.: execução fora do contexto de Sheets) — ignora.
  }
}
