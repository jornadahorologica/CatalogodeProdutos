/**
 * Histórico e auditoria (seções 21 e 32). Toda operação crítica sobre um
 * produto grava uma linha aqui: produto, campo, valor anterior, valor novo,
 * usuário e data/hora.
 */

function registrarHistorico_(produtoId, campo, valorAnterior, valorNovo, operacao) {
  var usuario = getUsuarioAtual_();
  criarRegistroComId_(SHEET_NAMES.HISTORICO, 'HIST', 6, {
    produto_id: produtoId,
    campo: campo,
    valor_anterior: (valorAnterior === undefined || valorAnterior === null) ? '' : String(valorAnterior),
    valor_novo: (valorNovo === undefined || valorNovo === null) ? '' : String(valorNovo),
    usuario: usuario.email,
    data_hora: new Date(),
    operacao: operacao
  });
}

// Seção 22: visualizar histórico é uma capacidade exclusiva do ADMINISTRADOR.
function listarHistoricoProduto(produtoId) {
  requirePerfil_([PERFIS.ADMINISTRADOR]);
  return getAllRecords_(SHEET_NAMES.HISTORICO)
    .filter(function (h) { return String(h.produto_id) === String(produtoId); })
    .sort(function (a, b) { return new Date(b.data_hora) - new Date(a.data_hora); });
}
