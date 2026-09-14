/**
 * Administração das listas paramétricas (seção 24): categorias, tipos,
 * áreas, células e fontes ficam em abas próprias, editáveis apenas por
 * ADMINISTRADOR, sem necessidade de alterar código.
 */

var LISTAS_SIMPLES_PERMITIDAS_ = ['CATEGORIAS', 'TIPOS', 'AREAS', 'CELULAS', 'FONTES'];

function listarListaSimples(nomeLista) {
  if (LISTAS_SIMPLES_PERMITIDAS_.indexOf(nomeLista) === -1) {
    throw new Error('Lista não reconhecida: ' + nomeLista);
  }
  return getAllRecords_(SHEET_NAMES[nomeLista])
    .filter(function (i) { return i.ativo !== false; })
    .sort(function (a, b) { return (Number(a.ordem) || 0) - (Number(b.ordem) || 0); });
}

function salvarItemListaSimples(nomeLista, item) {
  requirePerfil_([PERFIS.ADMINISTRADOR]);
  if (LISTAS_SIMPLES_PERMITIDAS_.indexOf(nomeLista) === -1) {
    throw new Error('Lista não reconhecida: ' + nomeLista);
  }
  item = item || {};
  if (!item.nome) throw new Error('Nome é obrigatório.');

  var sheetName = SHEET_NAMES[nomeLista];
  if (item.id) {
    var resultado = updateRecordById_(sheetName, item.id, {
      nome: item.nome,
      ordem: item.ordem || 0,
      ativo: item.ativo !== false
    });
    return resultado.atual;
  }

  return criarRegistroComId_(sheetName, nomeLista.substring(0, 3), 3, {
    nome: item.nome,
    ordem: item.ordem || 0,
    ativo: true
  });
}

// Seção 22/24: administração de usuários e perfis é exclusiva do ADMINISTRADOR.
function listarUsuarios() {
  requirePerfil_([PERFIS.ADMINISTRADOR]);
  return getAllRecords_(SHEET_NAMES.USUARIOS);
}

function salvarUsuario(item) {
  requirePerfil_([PERFIS.ADMINISTRADOR]);
  item = item || {};
  if (!item.email || !item.perfil) throw new Error('E-mail e perfil são obrigatórios.');
  if (Object.keys(PERFIS).map(function (k) { return PERFIS[k]; }).indexOf(item.perfil) === -1) {
    throw new Error('Perfil inválido: ' + item.perfil);
  }

  var existente = getAllRecords_(SHEET_NAMES.USUARIOS).filter(function (u) {
    return String(u.email).toLowerCase() === String(item.email).toLowerCase();
  })[0];

  if (existente) {
    var resultado = updateRecordById_(SHEET_NAMES.USUARIOS, existente.id, {
      nome: item.nome || existente.nome,
      perfil: item.perfil,
      ativo: item.ativo !== false
    });
    return resultado.atual;
  }

  return criarRegistroComId_(SHEET_NAMES.USUARIOS, 'USR', 4, {
    email: item.email,
    nome: item.nome || item.email.split('@')[0],
    perfil: item.perfil,
    ativo: true
  });
}
