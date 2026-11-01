import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=process.cwd(),port=Number(process.env.PORT||4173);
const mimes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.csv':'text/csv; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8'};
createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname.startsWith('/api/')) {res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'The optional AI endpoint requires a Vercel deployment and OPENAI_API_KEY. Deterministic briefing works offline.'}));return;}
    const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!path.startsWith(root+sep) && path!==root) throw Error('not permitted');
    if(/(^|\/)\./.test(path.slice(root.length)))throw Error('hidden');
    const s=await stat(path);if(!s.isFile())throw Error('not file');
    res.writeHead(200,{'Content-Type':mimes[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(path));
  }catch(e){res.writeHead(404);res.end('Not found');}
}).listen(port,()=>console.log('EV CostCheck: http://localhost:'+port));
