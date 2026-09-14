/**
 * Camada de acesso a dados sobre o Google Sheets. Nenhum service de negócio
 * deve chamar SpreadsheetApp diretamente — tudo passa por aqui, para manter
 * a lógica de banco isolada da lógica de regras de negócio.
 */

function getSpreadsheet_() {
  var ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    ss = null;
  }
  if (ss) return ss;

  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    return SpreadsheetApp.openById(id);
  }

  ss = SpreadsheetApp.create('Catálogo de Produtos - COTIC-SEFAZ-CE');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function getSheet_(sheetName) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = SHEET_HEADERS[sheetName];
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * google.script.run não consegue devolver objetos Date ao cliente (a chamada
 * inteira retorna null quando isso acontece). Por isso todo valor de data
 * lido/gravado na planilha é convertido para string ISO antes de sair desta
 * camada — nenhuma função pública deve devolver um Date "cru".
 */
function serializarRegistro_(obj) {
  var resultado = {};
  Object.keys(obj).forEach(function (chave) {
    var valor = obj[chave];
    resultado[chave] = (valor instanceof Date) ? valor.toISOString() : valor;
  });
  return resultado;
}

function sheetToObjects_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.join('') === '') continue;
    var obj = { _row: i + 1 };
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    out.push(serializarRegistro_(obj));
  }
  return out;
}

function getAllRecords_(sheetName) {
  return sheetToObjects_(getSheet_(sheetName));
}

function getRecordById_(sheetName, id) {
  var records = getAllRecords_(sheetName);
  for (var i = 0; i < records.length; i++) {
    if (String(records[i].id) === String(id)) return records[i];
  }
  return null;
}

function updateRecordById_(sheetName, id, changes) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSheet_(sheetName);
    var headers = SHEET_HEADERS[sheetName];
    var values = sheet.getDataRange().getValues();
    var idCol = headers.indexOf('id');
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][idCol]) === String(id)) {
        var atual = {};
        headers.forEach(function (h, c) { atual[h] = values[i][c]; });
        var novo = Object.assign({}, atual, changes);
        var novaLinha = headers.map(function (h) { return novo[h] !== undefined ? novo[h] : ''; });
        sheet.getRange(i + 1, 1, 1, headers.length).setValues([novaLinha]);
        return { anterior: serializarRegistro_(atual), atual: serializarRegistro_(novo) };
      }
    }
    throw new Error('Registro não encontrado em ' + sheetName + ' (id ' + id + ').');
  } finally {
    lock.releaseLock();
  }
}

// Uso restrito: registros de PRODUTOS nunca são removidos fisicamente (RN-007).
// Só usado para itens auxiliares (integrações, documentos, vínculos N:N).
function deleteRecordById_(sheetName, id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSheet_(sheetName);
    var headers = SHEET_HEADERS[sheetName];
    var values = sheet.getDataRange().getValues();
    var idCol = headers.indexOf('id');
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][idCol]) === String(id)) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Gera o próximo ID e insere o registro em uma única seção crítica (um só
 * lock), evitando que duas criações concorrentes recebam o mesmo ID
 * (RN-002: o ID nunca pode ser reaproveitado/duplicado).
 */
function criarRegistroComId_(sheetName, prefix, padding, dadosSemId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var records = getAllRecords_(sheetName);
    var max = 0;
    records.forEach(function (r) {
      var m = String(r.id || '').match(/(\d+)$/);
      if (m) {
        var n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    });
    var numero = String(max + 1);
    while (numero.length < padding) numero = '0' + numero;
    var id = prefix + '-' + numero;

    var registro = Object.assign({ id: id }, dadosSemId);
    var sheet = getSheet_(sheetName);
    var headers = SHEET_HEADERS[sheetName];
    var row = headers.map(function (h) { return registro[h] !== undefined ? registro[h] : ''; });
    sheet.appendRow(row);
    return serializarRegistro_(registro);
  } finally {
    lock.releaseLock();
  }
}
