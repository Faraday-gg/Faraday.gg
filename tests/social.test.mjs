import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileSocial,supabaseSocial} from '../lib/social-store.mjs';
import {createSocial,lookOf,sameLook} from '../lib/social.mjs';

const dir=mkdtempSync(join(tmpdir(),'faraday-social-'));
const file=join(dir,'social.json');
const users=['ana','beto','clara'];
const accounts=Object.fromEntries(users.map(name=>[name,{player:randomUUID(),email:name+'@example.test'}]));
const auth={async current(request,readCookie){
  const account=accounts[readCookie(request,'test-user')];
  return account?{account,cookies:['test-renewed=1; HttpOnly']}:null;
}};
let now=Date.parse('2026-11-19T12:00:00Z');
const makeApi=scope=>createApi({store:{social:fileSocial(file)},auth,now:()=>now,trendScope:scope,log:()=>{}});
let api=makeApi('preview');
async function call(user,action,extra={},options={}){
  const headers={origin:options.origin||'https://faraday.test'};
  if(user)headers.cookie='test-user='+user;
  const response=await (options.api||api).handle(new Request('https://faraday.test/api/social',{
    method:'POST',headers,body:JSON.stringify({action,...extra})
  }));
  return {status:response.status,body:await response.json(),cookies:response.headers.getSetCookie()};
}
const expect=async(status,...args)=>{
  const result=await call(...args);
  assert.equal(result.status,status,JSON.stringify(result.body));
  return result.body;
};

try{
  await expect(401,null,'estado',{player:accounts.ana.player});
  await expect(403,'ana','estado',{}, {origin:'https://otra.test'});
  assert.deepEqual((await call('ana','estado')).cookies,['test-renewed=1; HttpOnly']);
  assert.equal((await expect(200,'ana','estado')).enabled,false);
  await expect(409,'ana','amigos');
  await expect(400,'ana','activar',{name:'  '});
  for(const user of users)await expect(200,user,'activar',{name:user});
  const published=makeApi('publico');
  assert.equal((await expect(200,'ana','estado',{}, {api:published})).enabled,false);
  const {invite}=await expect(200,'ana','amigos');
  assert.match(invite,/^[a-f\d]{32}$/);
  await expect(404,'ana','agregar',{code:invite});
  const accepted=await Promise.all([expect(200,'beto','agregar',{code:invite}),expect(200,'beto','agregar',{code:invite})]);
  const id=accepted[0].friend.id;
  assert.equal(accepted[1].friend.id,id);
  assert.deepEqual((await expect(200,'ana','amigos')).friends,[{id,name:'beto',look:null,online:true,played:null,activity:true}],'sin aspecto enviado, look es null');

  // Amigos con avatar: el pulso guarda el aspecto saneado y la lista lo devuelve.
  await expect(200,'beto','pulso',{look:{top:'camiseta-azul',hat:'<b>',_raw:{x:1},Bad:'x',n:7}});
  assert.deepEqual((await expect(200,'ana','amigos')).friends[0].look,{top:'camiseta-azul'});
  await expect(200,'beto','pulso',{look:'no-vale'});
  await expect(200,'beto','pulso',{look:{}});
  await expect(200,'beto','pulso',{});
  assert.deepEqual((await expect(200,'ana','amigos')).friends[0].look,{top:'camiseta-azul'},'un aspecto vacío o no válido no borra el guardado');
  await expect(200,'beto','pulso',{look:{top:'camiseta-roja',hair:'corto'}});
  assert.deepEqual((await expect(200,'ana','amigos')).friends[0].look,{hair:'corto',top:'camiseta-roja'});
  assert.equal(Object.keys(lookOf(Object.fromEntries(Array.from({length:40},(_,i)=>['k'+String.fromCharCode(97+i%26)+(i<26?'':'x'),'v'])))).length,24);
  assert.ok(sameLook({a:'x',b:'y'},{b:'y',a:'x'}));assert.ok(!sameLook({a:'x'},{a:'z'}));assert.ok(sameLook(null,{}));

  now+=180_000;
  assert.equal((await expect(200,'ana','amigos')).friends[0].online,false);
  await expect(200,'beto','pulso',{played:true});
  const look={hair:'corto',top:'camiseta-roja'};
  assert.deepEqual((await expect(200,'ana','amigos')).friends,[{id,name:'beto',look,online:true,played:new Date(now).toISOString(),activity:true}]);
  await expect(200,'beto','privacidad',{activity:false});
  // Quien oculta su actividad sigue teniendo avatar, y puede cambiarlo.
  await expect(200,'beto','pulso',{look:{top:'camiseta-verde'}});
  assert.deepEqual((await expect(200,'ana','amigos')).friends,[{id,name:'beto',look:{top:'camiseta-verde'},online:false,played:null,activity:false}]);
  await expect(200,'ana','renovar');
  await expect(404,'clara','agregar',{code:invite});
  await expect(404,'clara','chat',{id});
  await expect(404,'clara','enviar',{id,message:randomUUID(),text:'ajeno'});

  const outgoing={id,message:randomUUID(),text:'  Hola  <b>amiga</b>  '};
  const sent=await Promise.all([expect(200,'ana','enviar',outgoing),expect(200,'ana','enviar',outgoing)]);
  assert.deepEqual(sent[0],sent[1]);
  await expect(429,'ana','enviar',{...outgoing,message:randomUUID()});
  await expect(200,'beto','enviar',{id,message:randomUUID(),text:'¡Hola!'});
  const conversation=await expect(200,'beto','chat',{id});
  assert.deepEqual(conversation.messages.map(({text,mine})=>[text,mine]),[['Hola <b>amiga</b>',false],['¡Hola!',true]]);
  api=makeApi('preview');
  assert.deepEqual(await expect(200,'beto','chat',{id}),conversation);

  now+=2000;
  const [block,late]=await Promise.all([call('ana','bloquear',{id}),call('beto','enviar',{id,message:randomUUID(),text:'mensaje en carrera'})]);
  assert.equal(block.status,200);
  assert.ok([200,404].includes(late.status));
  await expect(404,'ana','chat',{id});
  await expect(404,'beto','chat',{id});
  await expect(404,'beto','agregar',{code:(await expect(200,'ana','amigos')).invite});
  assert.deepEqual((await expect(200,'beto','amigos')).friends,[]);

  // Supabase sin la columna social_profiles.look (migración 20261126120100 aún sin aplicar): la lista de amigos y el
  // pulso siguen funcionando sin aspecto, sin insistir en cada petición. Con la columna, el aspecto se guarda y sale.
  {
    const A='a'.repeat(64),B='b'.repeat(64),stamp=new Date(now).toISOString(),calls=[];
    const profiles=[A,B].map((player_hash,index)=>({scope:'preview',player_hash,name:['ana','beto'][index],invite:String(index).repeat(32),seen_at:stamp,played_at:null,show_activity:true}));
    let migrated=false,broken=false;
    const reject=(code,message)=>{throw Error('Supabase respondió 400: '+JSON.stringify({code,details:null,hint:null,message}))};
    const fake=async(raw,init={})=>{
      const url=new URL(raw),query=url.searchParams,table=url.pathname.split('/').pop(),wanted=query.get('player_hash')||'';
      if(broken)throw Error('Supabase respondió 500: caída');
      if(table==='social_contacts')return Response.json([{id:'6a1f0c9e-0000-4000-8000-000000000001',first_player:A,second_player:B}]);
      assert.equal(table,'social_profiles');
      if(init.method==='PATCH'){
        const patch=JSON.parse(init.body);calls.push({method:'PATCH',look:'look' in patch});
        if('look' in patch&&!migrated)reject('PGRST204',"Could not find the 'look' column of 'social_profiles' in the schema cache");
        Object.assign(profiles.find(row=>wanted==='eq.'+row.player_hash),patch);return new Response(null,{status:204});
      }
      const select=query.get('select')||'';calls.push({method:'GET',look:select.includes('look')});
      if(select.includes('look')&&!migrated)reject('42703','column social_profiles.look does not exist');
      return Response.json(profiles.filter(row=>wanted.includes(row.player_hash)).map(row=>migrated?{look:null,...row}:row));
    };
    const remote=createSocial({store:supabaseSocial({call:fake,endpoint:name=>'https://supabase.test/rest/v1/'+name}),scope:'preview',now:()=>now});
    const tries=()=>calls.filter(entry=>entry.look).length;
    let listed=await remote(A,{action:'amigos'});
    assert.equal(listed.status,200);assert.deepEqual(listed.body.friends.map(friend=>[friend.name,friend.look,friend.online]),[['beto',null,true]]);
    assert.equal(tries(),1);
    assert.equal((await remote(B,{action:'pulso',look:{top:'camiseta-azul'}})).status,200);
    assert.equal((await remote(A,{action:'amigos'})).status,200);
    assert.equal(tries(),1,'no se vuelve a pedir la columna que falta en cada petición');
    // Con la migración aplicada, a los cinco minutos se vuelve a probar y ya funciona.
    migrated=true;
    const realNow=Date.now;Date.now=()=>realNow()+301_000;
    try{
      assert.equal((await remote(B,{action:'pulso',look:{top:'camiseta-azul'}})).status,200);
      listed=await remote(A,{action:'amigos'});
      assert.deepEqual(listed.body.friends.map(friend=>[friend.name,friend.look]),[['beto',{top:'camiseta-azul'}]]);
      const before=tries();
      await remote(B,{action:'pulso',look:{top:'camiseta-azul'}});
      assert.equal(calls.slice(-3).filter(entry=>entry.method==='PATCH'&&entry.look).length,0,'el mismo aspecto no se vuelve a escribir');
      assert.equal(tries(),before);
    }finally{Date.now=realNow}
    // Cualquier otro fallo de Supabase no se disimula.
    broken=true;
    await assert.rejects(remote(A,{action:'amigos'}),/500/);
  }
  console.log('Panel social: sesión, invitaciones, avatar de los amigos, privacidad, chat, concurrencia, persistencia y columna look opcional correctos.');
}finally{
  rmSync(dir,{recursive:true,force:true});
}
