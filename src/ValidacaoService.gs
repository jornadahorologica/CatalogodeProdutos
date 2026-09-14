/**
 * Regras de validação de dados: normalização de texto, detecção de
 * duplicidade (RN-003), completude (seção 30) e regras de qualidade (seção 31).
 */

function normalizarTexto_(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * RN-003: antes de cadastrar/renomear um produto, verifica duplicidade
 * considerando nome exato, nome normalizado e sigla.
 *
 * Retorna:
 *  - exatos: mesmo nome (ou nome normalizado igual) de um produto já ativo —
 *    bloqueia o cadastro/edição.
 *  - possiveis: sigla igual ou nome normalizado "contido" no outro (ex.: IPVA
 *    dentro de "Sistema IPVA") — não bloqueia automaticamente, mas exige
 *    confirmação explícita do usuário antes de salvar.
 */
function verificarDuplicidade_(nome, sigla, idExcluir) {
  var nomeNorm = normalizarTexto_(nome);
  var siglaNorm = normalizarTexto_(sigla);

  var produtos = getAllRecords_(SHEET_NAMES.PRODUTOS).filter(function (p) {
    if (p.status === STATUS_PRODUTO.DESCONTINUADO) return false;
    if (idExcluir && String(p.id) === String(idExcluir)) return false;
    return true;
  });

  var exatos = [];
  var possiveis = [];

  produtos.forEach(function (p) {
    var pNomeNorm = p.nome_normalizado || normalizarTexto_(p.nome);
    var pSiglaNorm = normalizarTexto_(p.sigla);

    var nomeExatoIgual = String(p.nome).trim().toLowerCase() === String(nome).trim().toLowerCase();
    if (nomeExatoIgual || (nomeNorm && pNomeNorm === nomeNorm)) {
      exatos.push(p);
      return;
    }

    var siglaBate = !!(siglaNorm && pSiglaNorm && siglaNorm === pSiglaNorm);
    var nomeContido = nomeNorm.length > 2 && pNomeNorm.length > 2 &&
      (pNomeNorm.indexOf(nomeNorm) !== -1 || nomeNorm.indexOf(pNomeNorm) !== -1);

    if (siglaBate || nomeContido) {
      possiveis.push(p);
    }
  });

  return { exatos: exatos, possiveis: possiveis };
}

/**
 * Seção 30: percentual de preenchimento dos campos mínimos obrigatórios
 * (seção 6). Usado tanto no indicador de completude quanto para impedir a
 * validação de produtos incompletos.
 */
function calcularCompletude_(produto) {
  var faltantes = [];
  CAMPOS_OBRIGATORIOS_MINIMOS.forEach(function (c) {
    var valor = produto[c.campo];
    if (valor === undefined || valor === null || String(valor).trim() === '') {
      faltantes.push(c.label);
    }
  });
  var total = CAMPOS_OBRIGATORIOS_MINIMOS.length;
  var preenchidos = total - faltantes.length;
  return { percentual: Math.round((preenchidos / total) * 100), faltantes: faltantes };
}

/**
 * Seção 31 — regras de qualidade que nunca podem ser violadas:
 *  - produto operacional (Ativo/Em evolução/Em modernização) não pode ficar
 *    sem responsável, sem categoria ou sem descrição;
 *  - produto Ativo (validado) não pode ficar sem fonte (RN-006).
 * Recebe o estado "simulado" do produto após a alteração pretendida.
 */
function validarRegrasQualidade_(produtoSimulado) {
  var operacional = STATUS_OPERACIONAIS.indexOf(produtoSimulado.status) !== -1;

  if (operacional) {
    if (!produtoSimulado.responsavel_negocio || !produtoSimulado.responsavel_cotic) {
      throw new Error('Um produto operacional não pode ficar sem responsável de negócio e responsável COTIC.');
    }
    if (!produtoSimulado.categoria) {
      throw new Error('Um produto operacional não pode ficar sem categoria.');
    }
    if (!produtoSimulado.descricao) {
      throw new Error('Um produto operacional não pode ficar sem descrição.');
    }
  }

  if (produtoSimulado.status === STATUS_PRODUTO.ATIVO && !produtoSimulado.fonte) {
    throw new Error('Um produto Ativo/Validado não pode ficar sem fonte da informação (RN-006).');
  }
}
