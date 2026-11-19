import {randomBytes,randomUUID} from 'node:crypto';

const HEARTBEAT=60_000,ONLINE=150_000,RECENT=7*86_400_000,CHAT_LIMIT=60;
const CODE=/^[a-f0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const ok=body=>({status:200,body});
const fail=(status,error)=>({status,body:{error}});
const makeCode=()=>randomBytes(16).toString('hex');
const clean=(value,max)=>typeof value==='string'
  ?Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim()).slice(0,max).join('')
  :'';
const exposes=(entry,player)=>({id:entry.id,text:entry.text,at:entry.at,mine:entry.by===player});

export function createSocial({store,scope,now=Date.now}){
  return async function social(player,data){
    const time=now(),stamp=new Date(time).toISOString();
    const profile=await store.profile(scope,player);
    const status=()=>ok({enabled:!!profile});
    switch(data.action){
      case 'estado': return status();
      case 'activar': {
        if(profile)return status();
        const name=clean(data.name,24);
        if(!name)return fail(400,'Escribe un apodo para que tus amigos te reconozcan.');
        await store.createProfile({scope,player_hash:player,name,invite:makeCode(),seen_at:stamp,played_at:null,show_activity:true});
        return ok({enabled:true});
      }
      case 'pulso': {
        if(!profile?.show_activity)return status();
        const fresh=Date.parse(profile.seen_at)>time-HEARTBEAT;
        const seenBefore=new Date(time-HEARTBEAT).toISOString();
        if(data.played===true){
          await store.updateProfile(scope,player,{played_at:stamp});
        }
        if(!fresh)await store.updateProfile(scope,player,{seen_at:stamp},{seenBefore});
        return status();
      }
    }
    if(!profile)return fail(409,'Activa tu perfil para usar el panel de amigos.');

    if(data.action==='amigos'){
      const rows=await store.friends(scope,player);
      const other=row=>row.first_player===player?row.second_player:row.first_player;
      const profiles=new Map((await store.profiles(scope,rows.map(other))).map(row=>[row.player_hash,row]));
      const friends=[];
      for(const row of rows){
        const peer=profiles.get(other(row));
        if(!peer)continue;
        friends.push({id:row.id,name:peer.name,online:peer.show_activity&&Date.parse(peer.seen_at)>time-ONLINE,
          played:peer.show_activity&&Date.parse(peer.played_at)>time-RECENT?peer.played_at:null,activity:peer.show_activity});
      }
      friends.sort((a,b)=>Number(b.online)-Number(a.online)||a.name.localeCompare(b.name,'es'));
      return ok({friends,invite:profile.invite,activity:profile.show_activity});
    }
    if(data.action==='privacidad'){
      if(typeof data.activity!=='boolean')return fail(400,'Preferencia no válida.');
      await store.updateProfile(scope,player,{show_activity:data.activity});
      return ok({activity:data.activity});
    }
    if(data.action==='renovar'){
      const invite=makeCode();await store.updateProfile(scope,player,{invite});
      return ok({invite});
    }
    if(data.action==='agregar'){
      const invite=typeof data.code==='string'&&CODE.test(data.code)?await store.invite(scope,data.code):null;
      if(!invite||invite.player_hash===player)return fail(404,'Este enlace de amistad no está disponible.');
      const [first_player,second_player]=[player,invite.player_hash].sort();
      let row=await store.pair(scope,first_player,second_player);
      if(!row){
        await store.createContact({scope,id:randomUUID(),first_player,second_player,blocked_by:null,messages:[],version:1});
        row=await store.pair(scope,first_player,second_player);
      }
      if(!row||row.blocked_by)return fail(404,'Este enlace de amistad no está disponible.');
      return ok({friend:{id:row.id,name:invite.name}});
    }

    if(!['chat','enviar','bloquear'].includes(data.action))return fail(400,'Acción no válida.');
    if(typeof data.id!=='string'||!UUID.test(data.id))return fail(404,'Conversación no disponible.');
    for(let attempt=0;attempt<5;attempt++){
      const row=await store.contact(scope,data.id,player);
      if(!row||row.blocked_by)return fail(404,'Conversación no disponible.');
      if(data.action==='chat')return ok({messages:row.messages.map(entry=>exposes(entry,player))});
      if(data.action==='bloquear'){
        if(await store.updateContact(row,{blocked_by:player,messages:[]}))return ok({blocked:true});
        continue;
      }
      const text=clean(data.text,300);
      if(!text||typeof data.message!=='string'||!UUID.test(data.message))return fail(400,'Escribe un mensaje válido.');
      const previous=row.messages.find(entry=>entry.id===data.message&&entry.by===player);
      if(previous)return ok({message:exposes(previous,player)});
      const latest=row.messages.findLast(entry=>entry.by===player);
      if(latest&&Date.parse(latest.at)>time-1500)return fail(429,'Espera un momento antes de enviar otro mensaje.');
      const entry={id:data.message,by:player,at:stamp,text};
      if(await store.updateContact(row,{messages:[...row.messages,entry].slice(-CHAT_LIMIT)}))return ok({message:exposes(entry,player)});
    }
    return fail(409,'La conversación se está actualizando. Inténtalo de nuevo.');
  };
}
