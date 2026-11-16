// Deploy as Web app: Execute as Me; access Anyone. Script properties TOKEN and SHEET_ID.
const FIELDS = ['Year','Month','Staff name','Indexing','Type','Program'];
function output_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function norm_(v) { return String(v == null ? '' : v).trim().replace(/\s+/g,' ').toLocaleLowerCase(); }
function year_(v) { let y = Number(v); return y > 2400 ? y-543 : y; }
function month_(v) { return v === '' || v == null || Number(v) === 0 ? '' : Number(v); }
function key_(r) { return [year_(r.Year),month_(r.Month),r['Staff name'],r.Program,r.Type,r.Indexing].map(norm_).join('\u001f'); }
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const d = JSON.parse(e.postData.contents || '{}');
    const p = PropertiesService.getScriptProperties();
    if (!p.getProperty('TOKEN') || d.token !== p.getProperty('TOKEN')) return output_({ok:false,error:'unauthorized'});
    lock.waitLock(25000);
    const sh = SpreadsheetApp.openById(p.getProperty('SHEET_ID')).getSheets()[0];
    const heads = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(x=>String(x).trim());
    if (FIELDS.some(f=>!heads.includes(f))) return output_({ok:false,error:'Missing required columns'});
    const values = sh.getLastRow()>1 ? sh.getRange(2,1,sh.getLastRow()-1,heads.length).getValues() : [];
    const objects = values.map(v=>Object.fromEntries(heads.map((h,i)=>[h,v[i]])));
    const existing = new Set(objects.map(key_));
    const action = d.action || 'add';
    if (action === 'list') return output_({ok:true,rows:objects.map((r,i)=>({rowNumber:i+2,record:Object.fromEntries(FIELDS.map(f=>[f,r[f] == null ? '' : r[f]])),fingerprint:key_(r)}))});
    if (action === 'deleteAll') {
      if(d.confirmation!=='DELETE ALL'||!Number.isInteger(d.expectedCount)||d.expectedCount!==values.length||values.length<1)return output_({ok:false,error:'Record count changed or confirmation invalid; refresh and retry'});
      sh.deleteRows(2,values.length);SpreadsheetApp.flush();return output_({ok:true,deleted:values.length});
    }
    if (action === 'add') {
      if (!Array.isArray(d.rows) || d.rows.length<1 || d.rows.length>500) return output_({ok:false,error:'Invalid batch'});
      const pending=[]; let skipped=0;
      d.rows.forEach(r=>{const k=key_(r);if(existing.has(k)){skipped++;return;}existing.add(k);pending.push(heads.map(h=>r[h]===undefined?'':r[h]));});
      if(pending.length) sh.getRange(sh.getLastRow()+1,1,pending.length,heads.length).setValues(pending);
      SpreadsheetApp.flush();return output_({ok:true,added:pending.length,skipped});
    }
    const rowNumber = Number(d.rowNumber);
    if(!Number.isInteger(rowNumber)||rowNumber<2||rowNumber>sh.getLastRow())return output_({ok:false,error:'Record no longer exists'});
    const idx=rowNumber-2;
    if(key_(objects[idx])!==d.fingerprint)return output_({ok:false,error:'Record changed; refresh list'});
    if(action==='delete'){sh.deleteRow(rowNumber);return output_({ok:true,deleted:1});}
    if(action==='update'){
      const r=d.row;if(!r)return output_({ok:false,error:'Missing row'});
      const k=key_(r);
      if(objects.some((other,i)=>i!==idx&&key_(other)===k))return output_({ok:true,updated:0,duplicate:true});
      const updated=heads.map((h,i)=>FIELDS.includes(h)?(r[h]===undefined?'':r[h]):values[idx][i]);
      sh.getRange(rowNumber,1,1,heads.length).setValues([updated]);return output_({ok:true,updated:1});
    }
    return output_({ok:false,error:'Unknown action'});
  } catch(err){return output_({ok:false,error:'Operation failed: '+String(err.message).slice(0,120)});}
  finally {try{lock.releaseLock();}catch(_) {}}
}
