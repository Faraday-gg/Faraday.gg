import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileSocial} from '../lib/social-store.mjs';

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
  assert.deepEqual((await expect(200,'ana','amigos')).friends,[{id,name:'beto',online:true,played:null,activity:true}]);

  now+=180_000;
  assert.equal((await expect(200,'ana','amigos')).friends[0].online,false);
  await expect(200,'beto','pulso',{played:true});
  assert.deepEqual((await expect(200,'ana','amigos')).friends,[{id,name:'beto',online:true,played:new Date(now).toISOString(),activity:true}]);
  await expect(200,'beto','privacidad',{activity:false});
  assert.deepEqual((await expect(200,'ana','amigos')).friends,[{id,name:'beto',online:false,played:null,activity:false}]);
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
  console.log('Panel social: sesión, invitaciones, privacidad, chat, concurrencia y persistencia correctos.');
}finally{
  rmSync(dir,{recursive:true,force:true});
}
