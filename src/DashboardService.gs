/**
 * Indicadores do dashboard mínimo (seção 29).
 */

function obterIndicadores() {
  var produtos = getAllRecords_(SHEET_NAMES.PRODUTOS);
  var noCatalogoPrincipal = produtos.filter(function (p) { return p.status !== STATUS_PRODUTO.DESCONTINUADO; });

  var porStatus = {};
  noCatalogoPrincipal.forEach(function (p) {
    porStatus[p.status] = (porStatus[p.status] || 0) + 1;
  });

  var porCategoria = {};
  noCatalogoPrincipal.forEach(function (p) {
    var cat = p.categoria || '(sem categoria)';
    porCategoria[cat] = (porCategoria[cat] || 0) + 1;
  });

  var validacao = {
    emLevantamento: produtos.filter(function (p) { return p.status === STATUS_PRODUTO.EM_LEVANTAMENTO; }).length,
    emValidacao: produtos.filter(function (p) { return p.status === STATUS_PRODUTO.EM_VALIDACAO; }).length,
    validados: produtos.filter(function (p) { return !!p.data_validacao; }).length,
    totalIdentificados: produtos.length
  };

  var completos = 0, incompletos = 0;
  noCatalogoPrincipal.forEach(function (p) {
    if (calcularCompletude_(p).percentual >= 100) completos++; else incompletos++;
  });

  return {
    totalGeral: produtos.length,
    totalNoCatalogoPrincipal: noCatalogoPrincipal.length,
    totalDescontinuados: produtos.length - noCatalogoPrincipal.length,
    porStatus: porStatus,
    porCategoria: porCategoria,
    validacao: validacao,
    completude: { completos: completos, incompletos: incompletos }
  };
}
