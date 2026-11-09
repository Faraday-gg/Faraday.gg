import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {calendar,getDay,madridDate} from './content-engine.mjs';

const root = path.resolve('dist');
const storePath=path.resolve(process.env.ANSWERS_FILE||'runtime/answers.json');
const questions=new Map(JSON.parse(fs.readFileSync(path.join(root,'questions.json'),'utf8')).flatMap(d=>d.questions).map(q=>[q.id,q]));
function loadCalendar(){const data=calendar();for(const day of data.days)for(const q of day.questions)questions.set(q.id,q);return data}
loadCalendar();
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif'};
let records={};
try{records=JSON.parse(fs.readFileSync(storePath,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
function distribution(rows,player,answer,guess){
  const others=Object.entries(rows).filter(([id])=>id!==player).map(([,value])=>value);
  const logs=others.map(value=>Math.log10(value/answer)),own=Math.log10(guess/answer);
  const low=Math.min(-1,own-.15,...logs.map(x=>x-.1)),high=Math.max(1,own+.15,...logs.map(x=>x+.1));
  const bins=Array(32).fill(0);for(const value of logs)bins[Math.min(31,Math.max(0,Math.floor((value-low)/(high-low)*32)))]++;
  const factor=Math.max(guess/answer,answer/guess),farther=others.filter(value=>Math.max(value/answer,answer/value)>factor).length;
  return {count:others.length,bins,low,high,closerPercent:others.length?Math.round(farther/others.length*100):null};
}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/calendar')return json(res,200,loadCalendar());
    if(url.pathname==='/daily-content.js'){const data=loadCalendar();res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end('window.DAILY_CALENDAR = '+JSON.stringify(data)+'; window.PILOT_DAYS = window.DAILY_CALENDAR.days;');return}
    if(url.pathname==='/api/day'){const date=url.searchParams.get('date')||madridDate(),day=getDay(date);if(!day)return json(res,404,{error:'No hay una edición verificada para esta fecha'});for(const q of day.questions)questions.set(q.id,q);return json(res,200,day)}
    if(url.pathname==='/api/daily-scores'){
      if(req.method!=='POST')return json(res,405,{error:'Usa POST'});
      if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'Origen no permitido'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)return json(res,413,{error:'Solicitud demasiado grande'})}
      let data;try{data=JSON.parse(body)}catch{return json(res,400,{error:'JSON no válido'})}
      const day=getDay(data.date||'');if(!day||typeof data.player!=='string'||!/^[a-f0-9-]{36}$/i.test(data.player))return json(res,400,{error:'Edición o participante no válido'});
      const player=createHash('sha256').update(data.player).digest('hex'),rows=day.questions.map(q=>records[q.id]||{});
      if(!rows.every(row=>Number.isFinite(row[player])))return json(res,409,{error:'Completa las tres preguntas para comparar tu puntuación'});
      const total=id=>day.questions.reduce((sum,q,i)=>sum+Math.max(rows[i][id]/q.answer,q.answer/rows[i][id]),0)/3;
      const own=total(player),others=Object.keys(rows[0]).filter(id=>id!==player&&rows.every(row=>Number.isFinite(row[id]))).map(total);
      const low=0,high=Math.max(1,Math.log10(own)+.15,...others.map(n=>Math.log10(n)+.1)),bins=Array(32).fill(0);
      for(const value of others)bins[Math.min(31,Math.floor(Math.log10(value)/high*32))]++;
      return json(res,200,{count:others.length,own,bins,low,high,closerPercent:others.length?Math.round(others.filter(n=>n>own).length/others.length*100):null});
    }
    if(url.pathname==='/api/answers'){
      if(req.method!=='POST')return json(res,405,{error:'Usa POST'});
      if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'Origen no permitido'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)return json(res,413,{error:'Solicitud demasiado grande'})}
      let data;try{data=JSON.parse(body)}catch{return json(res,400,{error:'JSON no válido'})}
      const q=questions.get(data.question);
      if(!q||typeof data.player!=='string'||!/^[a-f0-9-]{36}$/i.test(data.player)||!Number.isFinite(data.guess)||data.guess<=0||data.guess>1e30)return json(res,400,{error:'Respuesta no válida'});
      const player=createHash('sha256').update(data.player).digest('hex'),rows=records[q.id]||{};
      if(rows[player]!==undefined&&rows[player]!==data.guess)return json(res,409,{error:'Ya has respondido esta pregunta'});
      if(rows[player]===undefined){const updated={...records,[q.id]:{...rows,[player]:data.guess}};fs.mkdirSync(path.dirname(storePath),{recursive:true});fs.writeFileSync(storePath+'.tmp',JSON.stringify(updated));fs.renameSync(storePath+'.tmp',storePath);records=updated}
      return json(res,200,distribution(records[q.id],player,q.answer,data.guess));
    }
    if(url.pathname.startsWith('/api/'))return json(res,404,{error:'Ruta no disponible'});
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
    const target=path.resolve(root,`.${decodeURIComponent(url.pathname)}`);
    if(!target.startsWith(root+path.sep)&&target!==root){res.writeHead(403);res.end();return}
    const file=target===root?path.join(root,'index.html'):target;
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('No encontrado');return}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
  }catch{json(res,500,{error:'No se pudo procesar la solicitud'})}
});
const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
server.listen(port,host,()=>console.log(`Local: http://${host}:${port}`));
