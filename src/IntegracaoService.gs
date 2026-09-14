/**
 * Integrações de um produto com outros produtos/sistemas externos (seção 16).
 * Um produto pode ter várias integrações; não são "produtos" (RN-007 não se
 * aplica), então podem ser removidas fisicamente.
 */

function listarIntegracoes(produtoId) {
  return getAllRecords_(SHEET_NAMES.INTEGRACOES)
    .filter(function (i) { return String(i.produto_id) === String(produtoId); });
}

function salvarIntegracao(item) {
  requirePerfil_([PERFIS.EDITOR, PERFIS.ADMINISTRADOR]);
  item = item || {};
  if (!item.produto_id || !item.nome_integracao) {
    throw new Error('Produto e nome da integração são obrigatórios.');
  }

  if (item.id) {
    var resultado = updateRecordById_(SHEET_NAMES.INTEGRACOES, item.id, item);
    return resultado.atual;
  }

  var novo = criarRegistroComId_(SHEET_NAMES.INTEGRACOES, 'INT', 4, {
    produto_id: item.produto_id,
    produto_relacionado_id: item.produto_relacionado_id || '',
    nome_integracao: item.nome_integracao,
    tipo: item.tipo || '',
    descricao: item.descricao || ''
  });
  registrarHistorico_(item.produto_id, 'integracao', '', item.nome_integracao, 'alteração');
  return novo;
}

function removerIntegracao(id) {
  requirePerfil_([PERFIS.EDITOR, PERFIS.ADMINISTRADOR]);
  var item = getRecordById_(SHEET_NAMES.INTEGRACOES, id);
  if (!item) throw new Error('Integração não encontrada.');
  deleteRecordById_(SHEET_NAMES.INTEGRACOES, id);
  registrarHistorico_(item.produto_id, 'integracao', item.nome_integracao, '', 'alteração');
  return true;
}
