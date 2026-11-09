import fs from 'node:fs';
import vm from 'node:vm';
const html=await(await fetch('https://fermi.gg/')).text();
const modules=[...html.matchAll(/href="([^\"]+\.js)"/g)].map(match=>new URL(match[1],'https://fermi.gg/'));
let code='';
for(const url of modules){const body=await(await fetch(url)).text();if(body.includes('const as=[')&&body.includes('h0={')){code=body;break}}
if(!code)throw Error('El formato público ha cambiado; revisar el scraper antes de continuar.');
function literal(marker){const start=code.indexOf(marker)+marker.length;let depth=0,quote=null,escape=false;for(let i=start;i<code.length;i++){const c=code[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue}if(c==='"'||c==="'"||c==='`'){quote=c;continue}if(c==='['||c==='{')depth++;if(c===']'||c==='}')depth--;if(depth===0)return vm.runInNewContext('('+code.slice(start,i+1)+')',{}, {timeout:1000})}throw Error(marker)}
const questions=literal('const as='),schedule=literal('h0=');
const selected=[];
for(const [date,day] of Object.entries(schedule).filter(([d])=>d<='2026-11-09').sort(([a],[b])=>b.localeCompare(a))){for(const id of day.questions){const q=questions.find(q=>q.id===id);if(q&&!selected.some(x=>x.id===id))selected.push({date,...q});if(selected.length===100)break}if(selected.length===100)break}
fs.writeFileSync(new URL('./published-100.json',import.meta.url),JSON.stringify(selected.map(({date,id,prompt,tags,source,confidence})=>({date,id,prompt,tags,source,confidence})),null,2));
console.log(JSON.stringify(selected.map(q=>({date:q.date,id:q.id,prompt:q.prompt,shape:q.tags?.shape,confidence:q.confidence})),null,2));
