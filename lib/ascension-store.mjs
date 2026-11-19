// Persistencia de Ascensión. Versionado optimista para dos pestañas o instancias de Vercel.
import fs from 'node:fs';
import path from 'node:path';

const clone=value=>value==null?value:structuredClone(value);
const key=(scope,day,player,game)=>[scope,day,player,game].join(':');
export function fileAscension(file=null){
  let rows={};
  if(file){try{rows=JSON.parse(fs.readFileSync(file,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}}
  function save(next){
    if(file){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(next));fs.renameSync(file+'.tmp',file)}
    rows=next;
  }
  return {
    async get(scope,day,player,game){return clone(rows[key(scope,day,player,game)]||null)},
    async put(row,expectedVersion){
      const id=key(row.scope,row.day,row.player_hash,row.game),previous=rows[id];
      if(expectedVersion===null?!!previous:!previous||previous.version!==expectedVersion)return false;
      save({...rows,[id]:clone(row)});return true;
    },
    async latest(scope,day,player){return Math.max(-1,...Object.values(rows).filter(row=>row.scope===scope&&row.day===day&&row.player_hash===player).map(row=>row.game))},
    async scores(scope,day,edition){return Object.values(rows).filter(row=>row.scope===scope&&row.day===day&&row.edition===edition&&row.game===0&&row.finished_at).map(row=>row.score)}
  };
}

export function supabaseAscension({call,endpoint,pageSize=1000}){
  const url=query=>`${endpoint('ascension_runs')}?${new URLSearchParams(query)}`;
  const identity=(scope,day,player,game)=>({scope:`eq.${scope}`,day:`eq.${day}`,player_hash:`eq.${player}`,game:`eq.${game}`});
  return {
    async get(scope,day,player,game){
      const [row]=await(await call(url({...identity(scope,day,player,game),select:'*',limit:'1'}))).json();return row||null;
    },
    async put(row,expectedVersion){
      const headers={'Content-Type':'application/json',Prefer:'return=representation'};
      if(expectedVersion===null){
        headers.Prefer+=',resolution=ignore-duplicates';
        const response=await call(url({on_conflict:'scope,day,player_hash,game'}),{method:'POST',headers,body:JSON.stringify(row)});
        return (await response.json()).length===1;
      }
      const response=await call(url({...identity(row.scope,row.day,row.player_hash,row.game),version:`eq.${expectedVersion}`}),{method:'PATCH',headers,body:JSON.stringify(row)});
      return (await response.json()).length===1;
    },
    async latest(scope,day,player){
      const [row]=await(await call(url({scope:`eq.${scope}`,day:`eq.${day}`,player_hash:`eq.${player}`,select:'game',order:'game.desc',limit:'1'}))).json();return row?.game??-1;
    },
    async scores(scope,day,edition){
      const scores=[];
      for(let offset=0;;offset+=pageSize){
        const page=await(await call(url({scope:`eq.${scope}`,day:`eq.${day}`,edition:`eq.${edition}`,game:'eq.0',finished_at:'not.is.null',select:'score',order:'player_hash',offset:String(offset),limit:String(pageSize)}))).json();
        scores.push(...page.map(row=>row.score));if(page.length<pageSize)return scores;
      }
    }
  };
}
