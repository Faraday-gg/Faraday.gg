import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createApi} from './lib/api.mjs';
import {fileStore,supabaseStore} from './lib/stores.mjs';
import {createAuth} from './lib/auth.mjs';

// Con SUPABASE_URL y SUPABASE_SECRET_KEY usa Supabase; si no, el archivo local de siempre.
const store=process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY
  ?supabaseStore({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY})
  :fileStore(process.env.ANSWERS_FILE||'runtime/answers.json');
// El inicio de sesión solo funciona con Supabase configurado (crea usuarios reales: solo hay producción).
// El cobro de la suscripción con Stripe (decisión 0077): solo si están sus variables en .env (claves de prueba).
const {createStripe}=await import('./lib/stripe.mjs');
const stripe=createStripe({secret:process.env.STRIPE_SECRET_KEY,webhookSecret:process.env.STRIPE_WEBHOOK_SECRET,price:process.env.STRIPE_PRICE_ID});
const api=createApi({store,stripe,trendScope:'preview',auth:createAuth({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY})});
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(url.pathname==='/daily-content.js'||url.pathname==='/api'||url.pathname.startsWith('/api/')){
      let body;
      if(req.method!=='GET'&&req.method!=='HEAD'){
        // /api/progreso guarda el progreso entero del jugador con cuenta (decisión 0052): admite más tamaño.
        // /api/duelo lleva la voz (hasta 16 KB) y /api/lobby el aspecto del avatar (4 KB): los mismos topes que lib/api.mjs.
        const chunks=[],max={'/api/progreso':65536,'/api/duelo':16384,'/api/lobby':4096}[url.pathname]||2048;let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>max){res.writeHead(413,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Solicitud demasiado grande'}));return}chunks.push(chunk)}
        body=Buffer.concat(chunks);
      }
      const response=await api.handle(new Request(url,{method:req.method,headers:Object.entries(req.headers).filter(([,value])=>typeof value==='string'),body}));
      // Set-Cookie puede repetirse: se copia aparte para no juntar varias cookies en una sola cabecera.
      const headers=Object.fromEntries([...response.headers].filter(([name])=>name!=='set-cookie'));const cookies=response.headers.getSetCookie();if(cookies.length)headers['Set-Cookie']=cookies;
      res.writeHead(response.status,headers);res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
    const target=path.resolve(root,`.${decodeURIComponent(url.pathname)}`);
    if(!target.startsWith(root+path.sep)&&target!==root){res.writeHead(403);res.end();return}
    const file=target===root?path.join(root,'index.html'):target;
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('No encontrado');return}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
  }catch{if(!res.headersSent){res.writeHead(500,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:'No se pudo procesar la solicitud'}))}}
});
const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
server.listen(port,host,()=>console.log(`Local: http://${host}:${port} · respuestas en ${store.kind}`));
