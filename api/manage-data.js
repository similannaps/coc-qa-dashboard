const crypto = require('crypto');
const eq=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)};
const safe=v=>{let s=String(v==null?'':v).trim().slice(0,300);return /^[=+@]|^-(?!\d)/.test(s)?"'"+s:s};
const cleanRow=r=>{
  const y=Number(r&&r.Year),m=r.Month===''||r.Month==null?0:Number(r.Month);
  if(!Number.isInteger(y)||y<1990||y>2100||!Number.isInteger(m)||m<0||m>12||!String(r['Staff name']||'').trim())throw Error('Invalid row: year, month or staff');
  return {Year:y,Month:m||'','Staff name':safe(r['Staff name']),Indexing:safe(r.Indexing),Type:safe(r.Type),Program:safe(r.Program)};
};
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const {ADMIN_KEY,SHEET_WRITE_URL,SHEET_WRITE_TOKEN}=process.env;
  if(!ADMIN_KEY||!SHEET_WRITE_URL||!SHEET_WRITE_TOKEN)return res.status(501).json({error:'Write is not configured'});
  let b=req.body;try{if(typeof b==='string')b=JSON.parse(b);if(!b||!eq(b.key||'',ADMIN_KEY))return res.status(401).json({error:'Unauthorized'});}catch(_){return res.status(400).json({error:'Invalid JSON'});}
  const action=b.action;
  if(!['add','list','update','delete','deleteAll'].includes(action))return res.status(400).json({error:'Invalid action'});
  const payload={token:SHEET_WRITE_TOKEN,action};
  try{
    if(action==='add'){
      if(!Array.isArray(b.rows)||!b.rows.length||b.rows.length>500)return res.status(400).json({error:'1-500 rows required'});
      payload.rows=b.rows.map(cleanRow);
    }
    if(action==='deleteAll'){if(b.confirmation!=='DELETE ALL'||!Number.isInteger(b.expectedCount)||b.expectedCount<1)return res.status(400).json({error:'Deletion confirmation and count required'});payload.confirmation=b.confirmation;payload.expectedCount=b.expectedCount;}
    if(action==='update'||action==='delete'){
      if(!Number.isInteger(b.rowNumber)||b.rowNumber<2||typeof b.fingerprint!=='string')return res.status(400).json({error:'Invalid record reference'});
      payload.rowNumber=b.rowNumber;payload.fingerprint=b.fingerprint;
      if(action==='update')payload.row=cleanRow(b.row);
    }
  }catch(e){return res.status(400).json({error:e.message});}
  try{
    const upstream=await fetch(SHEET_WRITE_URL,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
    const result=await upstream.json();if(!upstream.ok||!result.ok)return res.status(502).json({error:result.error||'Sheet operation failed'});
    return res.status(200).json(result);
  }catch(e){console.error('manage-data failed');return res.status(502).json({error:'Cannot reach Google Sheets'});}
};
