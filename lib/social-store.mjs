// Perfiles sociales y amistades. Cada conversación se actualiza con control de versión.
import fs from 'node:fs';
import path from 'node:path';

const membership=(row,player)=>row.first_player===player||row.second_player===player;
const copy=value=>structuredClone(value??null);

export function fileSocial(file=null){
  let rows={profiles:{},contacts:{}};
  if(file){try{rows=JSON.parse(fs.readFileSync(file,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}}
  const profileKey=(scope,player)=>scope+':'+player;
  function save(table,key,row){
    const next={...rows,[table]:{...rows[table],[key]:copy(row)}};
    if(file){
      fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.writeFileSync(file+'.tmp',JSON.stringify(next));
      fs.renameSync(file+'.tmp',file);
    }
    rows=next;
  }
  return {
    async profile(scope,player){return copy(rows.profiles[profileKey(scope,player)])},
    async profiles(scope,players){return players.map(player=>copy(rows.profiles[profileKey(scope,player)])).filter(Boolean)},
    async invite(scope,code){return copy(Object.values(rows.profiles).find(row=>row.scope===scope&&row.invite===code))},
    async createProfile(row){
      const key=profileKey(row.scope,row.player_hash);
      if(!rows.profiles[key])save('profiles',key,row);
    },
    async updateProfile(scope,player,patch,condition={}){
      const key=profileKey(scope,player),row=rows.profiles[key];
      if(!row||condition.seenBefore&&row.seen_at>=condition.seenBefore)return;
      save('profiles',key,{...row,...patch});
    },
    async setLook(scope,player,look){
      const key=profileKey(scope,player),row=rows.profiles[key];
      if(!row)return false;
      save('profiles',key,{...row,look});return true;
    },
    async friends(scope,player){return Object.values(rows.contacts).filter(row=>row.scope===scope&&!row.blocked_by&&membership(row,player)).map(({id,first_player,second_player})=>({id,first_player,second_player}))},
    async pair(scope,first,second){return copy(Object.values(rows.contacts).find(row=>row.scope===scope&&row.first_player===first&&row.second_player===second))},
    async contact(scope,id,player){
      const row=rows.contacts[id];
      return copy(row?.scope===scope&&membership(row,player)?row:null);
    },
    async createContact(row){
      if(Object.values(rows.contacts).some(other=>other.scope===row.scope&&other.first_player===row.first_player&&other.second_player===row.second_player))return;
      save('contacts',row.id,row);
    },
    async updateContact(row,patch){
      const current=rows.contacts[row.id];
      if(current?.version!==row.version)return false;
      save('contacts',row.id,{...current,...patch,version:row.version+1});
      return true;
    }
  };
}

export function supabaseSocial({call,endpoint,pageSize=1000}){
  const url=(table,params={})=>endpoint(table)+'?'+new URLSearchParams(params);
  const get=async(table,params)=>(await call(url(table,params))).json();
  const one=async(table,params)=>(await get(table,{...params,limit:'1'}))[0]||null;
  const write=(table,params,method,body,prefer)=>call(url(table,params),{method,headers:{'Content-Type':'application/json',Prefer:prefer},body:JSON.stringify(body)});
  const profile='social_profiles',contact='social_contacts';
  const scopeOf=scope=>({scope:'eq.'+scope});
  const playerOf=(scope,player)=>({...scopeOf(scope),player_hash:'eq.'+player});
  const member=player=>({or:`(first_player.eq.${player},second_player.eq.${player})`});
  const fields='id,first_player,second_player';
  // social_profiles.look llega con la migración 20261126120100_amigos_aspecto. Mientras no esté aplicada, PostgREST
  // rechaza esa columna (42703 al leerla, PGRST204 al escribirla): se sigue sin aspecto y se vuelve a probar a los 5 minutos.
  const LOOK_RETRY=300_000,base='player_hash,name,seen_at,played_at,show_activity';
  let lookless=0;
  const noLook=error=>{if(!/PGRST204|42703/.test(String(error?.message)))throw error;lookless=Date.now()+LOOK_RETRY};
  return {
    profile:(scope,player)=>one(profile,playerOf(scope,player)),
    invite:(scope,invite)=>one(profile,{...scopeOf(scope),invite:'eq.'+invite}),
    async profiles(scope,players){
      const rows=[];
      const batchSize=Math.min(pageSize,45);
      for(let i=0;i<players.length;i+=batchSize){
        const batch=players.slice(i,i+batchSize);
        const read=select=>get(profile,{...scopeOf(scope),player_hash:`in.(${batch.join(',')})`,select});
        if(Date.now()>=lookless){
          try{rows.push(...await read(base+',look'));continue}catch(error){noLook(error)}
        }
        rows.push(...await read(base));
      }
      return rows;
    },
    async setLook(scope,player,look){
      if(Date.now()<lookless)return false;
      try{await write(profile,playerOf(scope,player),'PATCH',{look},'return=minimal');return true}
      catch(error){noLook(error);return false}
    },
    createProfile:row=>write(profile,{on_conflict:'scope,player_hash'},'POST',row,'resolution=ignore-duplicates,return=minimal'),
    updateProfile:(scope,player,patch,{seenBefore}={})=>write(profile,{...playerOf(scope,player),...(seenBefore?{seen_at:'lt.'+seenBefore}:{})},'PATCH',patch,'return=minimal'),
    async friends(scope,player){
      const rows=[];
      for(let offset=0;;offset+=pageSize){
        const page=await get(contact,{...scopeOf(scope),...member(player),blocked_by:'is.null',select:fields,order:'id.asc',offset:String(offset),limit:String(pageSize)});
        rows.push(...page);
        if(page.length<pageSize)return rows;
      }
    },
    pair:(scope,first,second)=>one(contact,{...scopeOf(scope),first_player:'eq.'+first,second_player:'eq.'+second,select:fields+',blocked_by'}),
    contact:(scope,id,player)=>one(contact,{...scopeOf(scope),...member(player),id:'eq.'+id}),
    createContact:row=>write(contact,{on_conflict:'scope,first_player,second_player'},'POST',row,'resolution=ignore-duplicates,return=minimal'),
    async updateContact(row,patch){
      const response=await write(contact,{...scopeOf(row.scope),id:'eq.'+row.id,version:'eq.'+row.version},'PATCH',{...patch,version:row.version+1},'return=representation');
      return (await response.json()).length===1;
    }
  };
}
