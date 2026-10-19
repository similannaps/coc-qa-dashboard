// วางใน Google Apps Script ของชีต แล้ว Deploy เป็น Web app (Execute as: Me, Who has access: Anyone)
// ตั้งค่าที่ Project Settings -> Script Properties: TOKEN (สุ่มเอง ยาวๆ) และ SHEET_ID (ID ของ Google Sheet)
function doPost(e) {
  const p = PropertiesService.getScriptProperties();
  const d = JSON.parse(e.postData.contents);
  if (d.token !== p.getProperty('TOKEN')) return out({ ok: false, error: 'unauthorized' });
  const sh = SpreadsheetApp.openById(p.getProperty('SHEET_ID')).getSheets()[0];
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String).map(s => s.trim());
  const rows = d.rows.map(r => head.map(h => (r[h] !== undefined ? r[h] : '')));
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, head.length).setValues(rows);
  return out({ ok: true, added: rows.length });
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
