/**
 * Iniciativas do PDTI e o relacionamento N:N com produtos (seção 13).
 * Iniciativa PDTI nunca é tratada como produto (seção 2 / diretriz 13).
 */

function listarIniciativas() {
  return getAllRecords_(SHEET_NAMES.INICIATIVAS_PDTI)
    .filter(function (i) { return i.ativo !== false; })
    .sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
}

function salvarIniciativa(item) {
  requirePerfil_([PERFIS.ADMINISTRADOR]);
  item = item || {};
  if (!item.nome) throw new Error('Nome da iniciativa é obrigatório.');

  if (item.id) {
    var resultado = updateRecordById_(SHEET_NAMES.INICIATIVAS_PDTI, item.id, {
      nome: item.nome,
      grupo_tematico: item.grupo_tematico || '',
      descricao: item.descricao || '',
      ativo: item.ativo !== false
    });
    return resultado.atual;
  }

  return criarRegistroComId_(SHEET_NAMES.INICIATIVAS_PDTI, 'INIC', 3, {
    nome: item.nome,
    grupo_tematico: item.grupo_tematico || '',
    descricao: item.descricao || '',
    ativo: true
  });
}

function vincularIniciativa(produtoId, iniciativaId) {
  requirePerfil_([PERFIS.EDITOR, PERFIS.ADMINISTRADOR]);
  var produto = getRecordById_(SHEET_NAMES.PRODUTOS, produtoId);
  if (!produto) throw new Error('Produto não encontrado.');
  var iniciativa = getRecordById_(SHEET_NAMES.INICIATIVAS_PDTI, iniciativaId);
  if (!iniciativa) throw new Error('Iniciativa não encontrada.');

  var jaExiste = getAllRecords_(SHEET_NAMES.PRODUTO_INICIATIVA).some(function (v) {
    return String(v.produto_id) === String(produtoId) && String(v.iniciativa_id) === String(iniciativaId);
  });
  if (jaExiste) throw new Error('Este produto já está vinculado a essa iniciativa.');

  var novo = criarRegistroComId_(SHEET_NAMES.PRODUTO_INICIATIVA, 'VINC', 4, {
    produto_id: produtoId,
    iniciativa_id: iniciativaId,
    data_vinculo: new Date()
  });
  registrarHistorico_(produtoId, 'iniciativa_pdti', '', iniciativa.nome, 'alteração');
  return novo;
}

function desvincularIniciativa(vinculoId) {
  requirePerfil_([PERFIS.EDITOR, PERFIS.ADMINISTRADOR]);
  var vinculo = getRecordById_(SHEET_NAMES.PRODUTO_INICIATIVA, vinculoId);
  if (!vinculo) throw new Error('Vínculo não encontrado.');
  var iniciativa = getRecordById_(SHEET_NAMES.INICIATIVAS_PDTI, vinculo.iniciativa_id);
  deleteRecordById_(SHEET_NAMES.PRODUTO_INICIATIVA, vinculoId);
  registrarHistorico_(vinculo.produto_id, 'iniciativa_pdti', iniciativa ? iniciativa.nome : vinculo.iniciativa_id, '', 'alteração');
  return true;
}
