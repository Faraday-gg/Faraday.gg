// node research/auditar-preguntas.mjs [--json] [--snapshot archivo.json]
// Lee el banco editorial sin red, archivos de jugadores ni escrituras en Supabase.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {buildContent} from '../lib/publicar.mjs';
import {evaluate} from '../lib/generar.mjs';

const exponent = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-'};
export function evaluateEditorial(expression){
  // En el archivo se mezclan puntos de miles y comas decimales. Un punto fuera
  // de un grupo de tres cifras se deja como separador decimal.
  const normalized=String(expression)
    .replace(/\d{1,3}(?:\.\d{3})+(?:,\d+)?(?![\d.])/g,n=>n.replace(/\./g,''))
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g,n=>'^'+Array.from(n,c=>exponent[c]).join(''));
  return evaluate(normalized);
}

export function auditQuestions(questions){
  return questions.map(({id,day_id,content:q})=>{
    const value=evaluateEditorial(q.referenceExpression);
    const error=Number.isFinite(value)&&q.answer>0?Math.abs(value/q.answer-1):null;
    const issues=[];
    if(error===null)issues.push('operación no interpretable');
    else if(error>.0005)issues.push('operación y respuesta difieren más del 0,05 %');
    if(!q.calc?.rows?.length)issues.push('sin cálculo por pasos');
    else if(!q.calc.rows.some(r=>r.source))issues.push('sin cita en las filas');
    if(!q.sources?.length||q.sources.some(s=>!s.title||!s.fact||!/^https:\/\/[^\s]+$/.test(s.url)))issues.push('referencias incompletas');
    if(q.sources?.some(s=>/wikipedia\.org\//.test(s.url)))issues.push('cita Wikipedia; buscar fuente primaria');
    if(q.reasoning?.steps?.length!==3||q.reasoning.steps.some(s=>!s.trim()))issues.push('razonamiento incompleto');
    return {id,date:day_id,title:q.title,answer:q.answer,expression:q.referenceExpression,calculated:Number.isFinite(value)?value:null,relativeError:error,sources:q.sources?.map(({title,url,fact})=>({title,url,fact}))||[],issues};
  });
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),snapshot=args.indexOf('--snapshot');
  if(snapshot>=0&&!args[snapshot+1])throw Error('Indica un archivo JSON de jornadas de la API pública');
  const {questions,days}=snapshot<0?buildContent('https://local.invalid'):(()=>{
    const days=Object.values(JSON.parse(fs.readFileSync(args[snapshot+1],'utf8')));
    const questions=days.flatMap(day=>(day.questions||[]).map(content=>({id:content.id,day_id:day.id,content})));
    return {days,questions};
  })();
  const report=auditQuestions(questions);
  if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
  else {
    console.log(`${report.length} preguntas en ${days.length} jornadas. Las alertas de fuentes no comprueban su contenido.`);
    const counts=Object.groupBy(report.flatMap(q=>q.issues),s=>s);
    for(const [issue,rows] of Object.entries(counts))console.log(`${rows.length} · ${issue}`);
    for(const q of report.filter(q=>q.calculated===null||q.relativeError>.0005))console.log(`${q.id} · ${q.expression} = ${q.calculated}; respuesta ${q.answer}`);
  }
}
