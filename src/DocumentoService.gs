/**
 * Documentação de um produto (seção 17): apenas links são armazenados,
 * nunca arquivos.
 */

function listarDocumentos(produtoId) {
  return getAllRecords_(SHEET_NAMES.DOCUMENTOS)
    .filter(function (d) { return String(d.produto_id) === String(produtoId); });
}

function salvarDocumento(item) {
  requirePerfil_([PERFIS.EDITOR, PERFIS.ADMINISTRADOR]);
  item = item || {};
  if (!item.produto_id || !item.titulo || !item.url) {
    throw new Error('Produto, título e URL do documento são obrigatórios.');
  }

  if (item.id) {
    var resultado = updateRecordById_(SHEET_NAMES.DOCUMENTOS, item.id, item);
    return resultado.atual;
  }

  var novo = criarRegistroComId_(SHEET_NAMES.DOCUMENTOS, 'DOC', 4, {
    produto_id: item.produto_id,
    tipo: item.tipo || 'Outro',
    titulo: item.titulo,
    url: item.url
  });
  registrarHistorico_(item.produto_id, 'documento', '', item.titulo, 'alteração');
  return novo;
}

function removerDocumento(id) {
  requirePerfil_([PERFIS.EDITOR, PERFIS.ADMINISTRADOR]);
  var item = getRecordById_(SHEET_NAMES.DOCUMENTOS, id);
  if (!item) throw new Error('Documento não encontrado.');
  deleteRecordById_(SHEET_NAMES.DOCUMENTOS, id);
  registrarHistorico_(item.produto_id, 'documento', item.titulo, '', 'alteração');
  return true;
}
