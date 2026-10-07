/**
 * KAROLLA PET — Web App do Google Apps Script para receber agendamentos.
 *
 * 1. Crie uma planilha no Google Sheets.
 * 2. Extensões → Apps Script → cole este código.
 * 3. Em "Configurações do projeto" → Propriedades do script, crie SECRET = (mesmo valor de GOOGLE_SHEETS_WEBHOOK_SECRET).
 * 4. Implantar → Nova implantação → Tipo "App da Web" → Executar como: você; Acesso: Qualquer pessoa.
 * 5. Copie a URL /exec para GOOGLE_SHEETS_WEBHOOK no .env do back-end.
 *
 * Cada agendamento é inserido ou atualizado (upsert) pela coluna ID.
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET') || '';
    if (secret && body.secret !== secret) return json({ ok: false, error: 'unauthorized' });
    if (body.action !== 'upsert') return json({ ok: false, error: 'unknown action' });

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Agendamentos') ||
        SpreadsheetApp.getActiveSpreadsheet().insertSheet('Agendamentos');
      var columns = body.columns;
      if (sheet.getLastRow() === 0) sheet.appendRow(columns);
      var values = columns.map(function (c) { return body.row[c] || ''; });
      var ids = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues() : [];
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] === body.row.ID) {
          sheet.getRange(i + 2, 1, 1, values.length).setValues([values]);
          return json({ ok: true, updated: true });
        }
      }
      sheet.appendRow(values);
      return json({ ok: true, created: true });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
