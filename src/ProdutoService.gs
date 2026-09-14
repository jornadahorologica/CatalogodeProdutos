/**
 * Regras de negócio da entidade central do sistema: PRODUTO.
 * Implementa os fluxos das seções 26 (cadastro), 27 (atualização) e
 * 28 (descontinuação), respeitando RN-001 a RN-007.
 */

/**
 * Seção 18/19: busca global + filtros combináveis. Por padrão, produtos
 * Descontinuados não aparecem (seção 9 / RN-007 é exclusão lógica).
 */
function listarProdutos(filtros) {
  filtros = filtros || {};
  var produtos = getAllRecords_(SHEET_NAMES.PRODUTOS);

  if (!filtros.incluirDescontinuados) {
    produtos = produtos.filter(function (p) { return p.status !== STATUS_PRODUTO.DESCONTINUADO; });
  }

  ['categoria', 'tipo', 'status', 'area_negocio', 'celula_cotic', 'impacto_reforma_tributaria'].forEach(function (campo) {
    if (filtros[campo]) {
      produtos = produtos.filter(function (p) { return p[campo] === filtros[campo]; });
    }
  });

  if (filtros.responsavel) {
    var r = filtros.responsavel.toLowerCase();
    produtos = produtos.filter(function (p) {
      return String(p.responsavel_negocio).toLowerCase().indexOf(r) !== -1 ||
        String(p.responsavel_cotic).toLowerCase().indexOf(r) !== -1 ||
        String(p.responsavel_tecnico).toLowerCase().indexOf(r) !== -1;
    });
  }

  if (filtros.iniciativaPdti) {
    var idsComVinculo = getAllRecords_(SHEET_NAMES.PRODUTO_INICIATIVA)
      .filter(function (v) { return String(v.iniciativa_id) === String(filtros.iniciativaPdti); })
      .map(function (v) { return String(v.produto_id); });
    produtos = produtos.filter(function (p) { return idsComVinculo.indexOf(String(p.id)) !== -1; });
  }

  if (filtros.busca) {
    var termos = normalizarTexto_(filtros.busca).split(' ').filter(Boolean);
    produtos = produtos.filter(function (p) {
      var textoBusca = normalizarTexto_([
        p.nome, p.sigla, p.descricao, p.categoria, p.area_negocio,
        p.responsavel_negocio, p.responsavel_cotic, p.status, p.tipo
      ].join(' '));
      return termos.every(function (t) { return textoBusca.indexOf(t) !== -1; });
    });
  }

  return produtos
    .map(function (p) {
      var completude = calcularCompletude_(p);
      return {
        id: p.id,
        nome: p.nome,
        sigla: p.sigla,
        tipo: p.tipo,
        categoria: p.categoria,
        status: p.status,
        area_negocio: p.area_negocio,
        celula_cotic: p.celula_cotic,
        responsavel_negocio: p.responsavel_negocio,
        responsavel_cotic: p.responsavel_cotic,
        impacto_reforma_tributaria: p.impacto_reforma_tributaria,
        data_atualizacao: p.data_atualizacao,
        completude: completude.percentual,
        operacional: STATUS_OPERACIONAIS.indexOf(p.status) !== -1,
        legado: p.status === STATUS_PRODUTO.LEGADO
      };
    })
    .sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
}

function obterProduto(id) {
  var produto = getRecordById_(SHEET_NAMES.PRODUTOS, id);
  if (!produto) throw new Error('Produto não encontrado: ' + id);

  var completude = calcularCompletude_(produto);

  var iniciativas = getAllRecords_(SHEET_NAMES.INICIATIVAS_PDTI);
  var iniciativasVinculadas = getAllRecords_(SHEET_NAMES.PRODUTO_INICIATIVA)
    .filter(function (v) { return String(v.produto_id) === String(id); })
    .map(function (v) {
      var ini = iniciativas.filter(function (i) { return String(i.id) === String(v.iniciativa_id); })[0];
      return { vinculoId: v.id, iniciativaId: v.iniciativa_id, nome: ini ? ini.nome : '(iniciativa removida)' };
    });

  return {
    produto: produto,
    completude: completude,
    iniciativas: iniciativasVinculadas,
    integracoes: listarIntegracoes(id),
    documentos: listarDocumentos(id)
  };
}

/**
 * Seção 26: novo produto sempre nasce como "Em levantamento" — o status
 * enviado pelo cliente, se houver, é ignorado. Antes de salvar, verifica
 * duplicidade (RN-003); duplicidade "possível" exige confirmação explícita.
 */
function criarProduto(dados, confirmarDuplicidade) {
  requirePerfil_([PERFIS.EDITOR, PERFIS.ADMINISTRADOR]);

  dados = dados || {};
  if (!dados.nome || !dados.tipo) {
    throw new Error('Nome e Tipo de produto são obrigatórios para iniciar o cadastro.');
  }

  var duplicidade = verificarDuplicidade_(dados.nome, dados.sigla, null);
  if (duplicidade.exatos.length > 0) {
    throw new Error(
      'Já existe um produto ativo com nome igual ou equivalente: ' +
      duplicidade.exatos.map(function (p) { return p.nome; }).join(', ')
    );
  }
  if (duplicidade.possiveis.length > 0 && !confirmarDuplicidade) {
    return {
      avisoDuplicidade: duplicidade.possiveis.map(function (p) {
        return { id: p.id, nome: p.nome, sigla: p.sigla };
      })
    };
  }

  var agora = new Date();

  var dadosProduto = {
    nome: dados.nome,
    nome_normalizado: normalizarTexto_(dados.nome),
    sigla: dados.sigla || '',
    descricao: dados.descricao || '',
    tipo: dados.tipo,
    categoria: dados.categoria || '',
    area_negocio: dados.area_negocio || '',
    processo_negocio: dados.processo_negocio || '',
    publico_alvo: dados.publico_alvo || '',
    finalidade: dados.finalidade || '',
    responsavel_negocio: dados.responsavel_negocio || '',
    responsavel_cotic: dados.responsavel_cotic || '',
    responsavel_tecnico: dados.responsavel_tecnico || '',
    celula_cotic: dados.celula_cotic || '',
    status: STATUS_PRODUTO.EM_LEVANTAMENTO,
    impacto_reforma_tributaria: 'Não identificado',
    fonte: dados.fonte || '',
    data_cadastro: agora,
    data_atualizacao: agora,
    data_validacao: '',
    usuario_validacao: '',
    motivo_descontinuacao: '',
    observacoes: dados.observacoes || ''
  };

  var produto = criarRegistroComId_(SHEET_NAMES.PRODUTOS, 'PROD', 4, dadosProduto);
  registrarHistorico_(produto.id, 'PRODUTO', '', 'Produto cadastrado (Em levantamento)', 'criação');
  return { produto: produto };
}

/**
 * Seção 27: edição de campos do produto. Mudança de status para "Ativo" ou
 * "Descontinuado" tem fluxo próprio (validarProduto / descontinuarProduto) e
 * não pode ser feita por aqui. Alteração de impacto da Reforma Tributária
 * exige perfil ADMINISTRADOR (seção 14).
 */
function atualizarProduto(id, alteracoesOriginais) {
  requirePerfil_([PERFIS.EDITOR, PERFIS.ADMINISTRADOR]);

  var atual = getRecordById_(SHEET_NAMES.PRODUTOS, id);
  if (!atual) throw new Error('Produto não encontrado: ' + id);

  var alteracoes = Object.assign({}, alteracoesOriginais || {});
  delete alteracoes.id;
  delete alteracoes.data_cadastro;
  delete alteracoes.data_validacao;
  delete alteracoes.usuario_validacao;

  if (alteracoes.status && alteracoes.status !== atual.status && STATUS_COM_FLUXO_PROPRIO.indexOf(alteracoes.status) !== -1) {
    throw new Error('Use as ações específicas de validação/descontinuação para mudar o status para "' + alteracoes.status + '".');
  }

  if (alteracoes.impacto_reforma_tributaria && alteracoes.impacto_reforma_tributaria !== atual.impacto_reforma_tributaria) {
    requirePerfil_([PERFIS.ADMINISTRADOR]);
  }

  if (alteracoes.nome && alteracoes.nome !== atual.nome) {
    var duplicidade = verificarDuplicidade_(alteracoes.nome, alteracoes.sigla || atual.sigla, id);
    if (duplicidade.exatos.length > 0) {
      throw new Error(
        'Já existe um produto ativo com nome igual ou equivalente: ' +
        duplicidade.exatos.map(function (p) { return p.nome; }).join(', ')
      );
    }
    alteracoes.nome_normalizado = normalizarTexto_(alteracoes.nome);
  }

  var simulado = Object.assign({}, atual, alteracoes);
  validarRegrasQualidade_(simulado);

  alteracoes.data_atualizacao = new Date();
  var resultado = updateRecordById_(SHEET_NAMES.PRODUTOS, id, alteracoes);

  Object.keys(alteracoes).forEach(function (campo) {
    if (campo === 'data_atualizacao' || campo === 'nome_normalizado') return;
    if (String(resultado.anterior[campo] || '') !== String(alteracoes[campo] || '')) {
      registrarHistorico_(id, campo, resultado.anterior[campo], alteracoes[campo], 'alteração');
    }
  });

  return { produto: resultado.atual };
}

// Seção 26: "Em levantamento" -> "Em validação".
function avancarParaValidacao(id) {
  requirePerfil_([PERFIS.EDITOR, PERFIS.ADMINISTRADOR]);
  var produto = getRecordById_(SHEET_NAMES.PRODUTOS, id);
  if (!produto) throw new Error('Produto não encontrado: ' + id);
  if (produto.status !== STATUS_PRODUTO.EM_LEVANTAMENTO) {
    throw new Error('Somente produtos "Em levantamento" podem avançar para "Em validação".');
  }
  var resultado = updateRecordById_(SHEET_NAMES.PRODUTOS, id, {
    status: STATUS_PRODUTO.EM_VALIDACAO,
    data_atualizacao: new Date()
  });
  registrarHistorico_(id, 'status', produto.status, STATUS_PRODUTO.EM_VALIDACAO, 'mudança de status');
  return { produto: resultado.atual };
}

/**
 * RN-005: só o ADMINISTRADOR (representando a confirmação do responsável)
 * pode validar um produto, e só se ele estiver 100% completo (seção 6/30) e
 * respeitar as regras de qualidade (seção 31, inclusive fonte via RN-006).
 * Registra usuário e data da validação.
 */
function validarProduto(id) {
  var usuario = requirePerfil_([PERFIS.ADMINISTRADOR]);
  var produto = getRecordById_(SHEET_NAMES.PRODUTOS, id);
  if (!produto) throw new Error('Produto não encontrado: ' + id);
  if (produto.status !== STATUS_PRODUTO.EM_VALIDACAO) {
    throw new Error('Somente produtos "Em validação" podem ser validados.');
  }

  var completude = calcularCompletude_(produto);
  if (completude.percentual < 100) {
    throw new Error('Produto incompleto. Campos pendentes: ' + completude.faltantes.join(', '));
  }

  var simulado = Object.assign({}, produto, { status: STATUS_PRODUTO.ATIVO });
  validarRegrasQualidade_(simulado);

  var agora = new Date();
  var resultado = updateRecordById_(SHEET_NAMES.PRODUTOS, id, {
    status: STATUS_PRODUTO.ATIVO,
    data_validacao: agora,
    data_atualizacao: agora,
    usuario_validacao: usuario.email
  });
  registrarHistorico_(id, 'status', produto.status, STATUS_PRODUTO.ATIVO, 'validação');
  return { produto: resultado.atual };
}

// Seção 28 / RN-007: exclusão lógica apenas, produto permanece no histórico.
function descontinuarProduto(id, motivo) {
  requirePerfil_([PERFIS.ADMINISTRADOR]);
  var produto = getRecordById_(SHEET_NAMES.PRODUTOS, id);
  if (!produto) throw new Error('Produto não encontrado: ' + id);
  if (produto.status === STATUS_PRODUTO.DESCONTINUADO) {
    throw new Error('Produto já está descontinuado.');
  }
  if (!motivo) {
    throw new Error('Informe o motivo da descontinuação.');
  }

  var agora = new Date();
  var resultado = updateRecordById_(SHEET_NAMES.PRODUTOS, id, {
    status: STATUS_PRODUTO.DESCONTINUADO,
    motivo_descontinuacao: motivo,
    data_atualizacao: agora
  });
  registrarHistorico_(id, 'status', produto.status, STATUS_PRODUTO.DESCONTINUADO, 'descontinuação');
  return { produto: resultado.atual };
}
