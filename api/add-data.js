// Backwards-compatible add endpoint, now sharing server-side duplicate protection.
const manage=require('./manage-data');
module.exports=(req,res)=>{if(req.method==='POST'){if(typeof req.body==='string'){try{req.body=JSON.parse(req.body);}catch(_){}}if(req.body&&typeof req.body==='object')req.body.action='add';}return manage(req,res);};
