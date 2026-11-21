import fs from 'node:fs';
import path from 'node:path';

// Una partida y los cambios de saldo se guardan juntos. La versión evita cobrar dos veces.
export function fileCasino(file){
  let rows={};
  if(file){
    try{rows=JSON.parse(fs.readFileSync(file,'utf8'))}
    catch(error){if(error.code!=='ENOENT')throw error}
  }
  return {
    async get(scope){return structuredClone(rows[scope]??null)},
    async put(row,version){
      if((rows[row.scope]?.version??null)!==version)return false;
      const next={...rows,[row.scope]:structuredClone(row)};
      if(file){
        fs.mkdirSync(path.dirname(file),{recursive:true});
        fs.writeFileSync(file+'.tmp',JSON.stringify(next));
        fs.renameSync(file+'.tmp',file);
      }
      rows=next;
      return true;
    }
  };
}

export function supabaseCasino({call,endpoint}){
  const url=query=>endpoint('casino_rooms')+'?'+new URLSearchParams(query);
  return {
    async get(scope){
      const [row]=await (await call(url({scope:'eq.'+scope,limit:'1'}))).json();
      return row??null;
    },
    async put(row,version){
      const creating=version===null;
      const query=creating?{on_conflict:'scope'}:{scope:'eq.'+row.scope,version:'eq.'+version};
      const response=await call(url(query),{
        method:creating?'POST':'PATCH',
        headers:{'Content-Type':'application/json',Prefer:creating?'resolution=ignore-duplicates,return=representation':'return=representation'},
        body:JSON.stringify(row)
      });
      return (await response.json()).length===1;
    }
  };
}
