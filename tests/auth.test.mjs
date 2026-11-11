// Prueba el inicio de sesión (lib/auth.mjs y las rutas /api/auth/ de lib/api.mjs) contra un Supabase Auth simulado.
// No usa red ni credenciales reales.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {createAuth} from '../lib/auth.mjs';
import {fileStore} from '../lib/stores.mjs';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const SUPABASE='https://proyecto.supabase.test',KEY='sb_secret_prueba',SITE='https://casi.test';
const base64url=b=>b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

// GoTrue mínimo: /settings, /otp, /verify, /user, /token (pkce y refresh_token), /admin/users/:id, /logout.
function fakeAuth({google=true}={}){
  const users=new Map(),codes=new Map(),tokens=new Map(),refresh=new Map(),pkce=new Map(),calls=[];
  const session=user=>{const access='acc-'+randomUUID(),ref='ref-'+randomUUID();tokens.set(access,user.id);refresh.set(ref,user.id);return {access_token:access,refresh_token:ref,expires_in:3600,user}};
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  async function fetch(url,init={}){
    const target=new URL(url),route=target.pathname.replace('/auth/v1',''),body=init.body?JSON.parse(init.body):{};
    calls.push(route+target.search);
    assert.equal(init.headers.apikey,KEY,'Todas las llamadas llevan la clave');
    const bearer=(init.headers.Authorization||'').replace('Bearer ','');
    if(route==='/settings')return reply(200,{external:{email:true,google}});
    if(route==='/otp'){
      if(body.email==='limite@correo.test')return reply(429,{msg:'rate limit'});
      let user=[...users.values()].find(u=>u.email===body.email);
      if(!user){user={id:randomUUID(),email:body.email,app_metadata:{provider:'email'},user_metadata:{}};users.set(user.id,user)}
      codes.set(body.email,'123456');return reply(200,{});
    }
    if(route==='/verify'){
      if(codes.get(body.email)!==body.token)return reply(403,{msg:'Token has expired or is invalid'});
      codes.delete(body.email);return reply(200,session([...users.values()].find(u=>u.email===body.email)));
    }
    if(route==='/user'){const id=tokens.get(bearer);return id?reply(200,users.get(id)):reply(401,{msg:'invalid JWT'})}
    if(route==='/token'&&target.searchParams.get('grant_type')==='refresh_token'){
      const id=refresh.get(body.refresh_token);if(!id)return reply(400,{msg:'Invalid Refresh Token'});
      refresh.delete(body.refresh_token);return reply(200,session(users.get(id)));
    }
    if(route==='/token'&&target.searchParams.get('grant_type')==='pkce'){
      const entry=pkce.get(body.auth_code);
      if(!entry||base64url(createHash('sha256').update(body.code_verifier).digest())!==entry.challenge)return reply(400,{msg:'invalid flow state'});
      pkce.delete(body.auth_code);return reply(200,session(entry.user));
    }
    if(route.startsWith('/admin/users/')){
      assert.equal(bearer,KEY,'La administración usa la clave secreta');
      const user=users.get(route.slice(13));user.app_metadata=body.app_metadata;return reply(200,user);
    }
    if(route.startsWith('/logout')){for(const [token,id] of tokens)if(token===bearer)tokens.delete(token);return new Response(null,{status:204})}
    return reply(404,{msg:'no existe'});
  }
  // Simula el regreso desde Google: Supabase crea el usuario y entrega un código para el challenge recibido.
  function googleReturns(authorizeUrl,email){
    const params=new URL(authorizeUrl).searchParams,code='code-'+randomUUID();
    const user={id:randomUUID(),email,app_metadata:{provider:'google'},user_metadata:{full_name:'Ana Prueba'}};users.set(user.id,user);
    pkce.set(code,{challenge:params.get('code_challenge'),user});
    return new URL(params.get('redirect_to')+'?code='+code);
  }
  return {fetch,users,calls,googleReturns,expire:()=>tokens.clear()};
}

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-auth-'));
try{
  const supabase=fakeAuth(),logs=[];
  const api=createApi({store:fileStore(path.join(directory,'answers.json')),auth:createAuth({url:SUPABASE,key:KEY,fetch:supabase.fetch,log:()=>{}}),log:(...a)=>logs.push(a.join(' '))});
  // Navegador mínimo: guarda las cookies que pone el servidor y las devuelve.
  function browser(){
    const jar=new Map();
    async function call(route,{method='GET',body,origin}={}){
      const headers={host:'casi.test','x-forwarded-proto':'https'};
      if(jar.size)headers.cookie=[...jar].map(([k,v])=>`${k}=${v}`).join('; ');
      if(origin)headers.origin=origin;
      if(body!==undefined)headers['content-type']='application/json';
      const response=await api.handle(new Request(new URL(route,SITE),{method,headers,body:body===undefined?undefined:JSON.stringify(body)}));
      for(const line of response.headers.getSetCookie()){const [pair,...attrs]=line.split('; ');const [k,...v]=pair.split('=');if(attrs.includes('Max-Age=0'))jar.delete(k);else jar.set(k,v.join('='))}
      const text=await response.text();let data=null;try{data=JSON.parse(text)}catch{}
      return {status:response.status,data,headers:response.headers};
    }
    return {call,jar};
  }
  const answer=async(b,player,guess,question)=>b.call('/api/answers',{method:'POST',body:{player,guess,question}});

  // Estado y validaciones.
  const a=browser();
  let r=await a.call('/api/auth/estado',{method:'POST',body:{}});assert.deepEqual(r.data,{providers:{email:true,google:true}});
  assert.equal((await a.call('/api/auth/codigo',{method:'POST',body:{email:'no-es-correo'}})).status,400);
  assert.equal((await a.call('/api/auth/codigo',{method:'POST',body:{email:'limite@correo.test'}})).status,429);
  assert.equal((await a.call('/api/auth/codigo',{method:'POST',body:{email:'ana@correo.test'},origin:'https://otro.test'})).status,403);
  assert.equal((await a.call('/api/auth/codigo')).status,405);

  // Dispositivo A: juega sin cuenta y después entra con su correo.
  r=await a.call('/api/jugador',{method:'POST',body:{}});const playerA=r.data.player;assert.equal(r.data.account,null,'Sin sesión no hay cuenta');
  assert.equal((await answer(a,playerA,100000,'piloto-v3-2026-11-09-1')).status,200);
  assert.equal((await a.call('/api/auth/codigo',{method:'POST',body:{email:' Ana@Correo.test '}})).status,200);
  assert.equal((await a.call('/api/auth/verificar',{method:'POST',body:{email:'ana@correo.test',code:'000000',player:playerA}})).status,401);
  r=await a.call('/api/auth/verificar',{method:'POST',body:{email:'ana@correo.test',code:'123456',player:playerA}});
  assert.equal(r.status,200);assert.deepEqual(r.data.account,{email:'ana@correo.test',name:null,provider:'email'});
  assert(a.jar.has('faraday_sesion')&&a.jar.has('faraday_refresco'),'La sesión queda en cookies');
  assert.match(r.headers.getSetCookie().join('\n'),/faraday_sesion=[^;]+; Path=\/; Max-Age=3600; HttpOnly; SameSite=Lax; Secure/);
  assert.equal(JSON.stringify(r.data).includes('acc-'),false,'Los tokens no llegan al JavaScript del navegador');
  const ana=[...supabase.users.values()].find(u=>u.email==='ana@correo.test');assert.equal(ana.app_metadata.jugador,playerA,'La cuenta se enlaza con el jugador del dispositivo');
  r=await a.call('/api/jugador',{method:'POST',body:{player:playerA}});
  assert.equal(r.data.player,playerA);assert.equal(r.data.recovered,false);assert.equal(r.data.account.email,'ana@correo.test');

  // Dispositivo B: otro jugador anónimo; al entrar con la misma cuenta recupera el jugador y el progreso de A.
  const b=browser();
  r=await b.call('/api/jugador',{method:'POST',body:{}});const playerB=r.data.player;assert.notEqual(playerB,playerA);
  await b.call('/api/auth/codigo',{method:'POST',body:{email:'ana@correo.test'}});
  r=await b.call('/api/auth/verificar',{method:'POST',body:{email:'ana@correo.test',code:'123456',player:playerB}});assert.equal(r.status,200);
  assert.equal(ana.app_metadata.jugador,playerA,'Una cuenta ya enlazada conserva su jugador');
  r=await b.call('/api/jugador',{method:'POST',body:{player:playerB}});
  assert.equal(r.data.player,playerA);assert.equal(r.data.recovered,true);assert.deepEqual(r.data.progress,{'2026-11-09':[100000]});
  assert.equal(b.jar.get('faraday_jugador'),playerA);

  // El token caduca: se renueva con el de refresco sin que el jugador lo note.
  const oldRefresh=b.jar.get('faraday_refresco');supabase.expire();
  r=await b.call('/api/jugador',{method:'POST',body:{player:playerA}});assert.equal(r.data.account.email,'ana@correo.test');assert.notEqual(b.jar.get('faraday_refresco'),oldRefresh);
  // Una sesión que ya no vale se borra y se sigue jugando sin cuenta.
  supabase.expire();b.jar.set('faraday_refresco','ref-falso');
  r=await b.call('/api/jugador',{method:'POST',body:{player:playerA}});assert.equal(r.data.account,null);assert.equal(b.jar.has('faraday_sesion')||b.jar.has('faraday_refresco'),false);

  // Salir: se borran las cookies de sesión y el dispositivo recibe un jugador anónimo nuevo.
  r=await a.call('/api/auth/salir',{method:'POST',body:{}});assert.equal(r.status,200);assert.match(r.data.player,/^[0-9a-f-]{36}$/);assert.notEqual(r.data.player,playerA);
  assert.equal(a.jar.has('faraday_sesion'),false);assert.equal(a.jar.get('faraday_jugador'),r.data.player);

  // Google con PKCE.
  const c=browser();await c.call('/api/jugador',{method:'POST',body:{}});const playerC=c.jar.get('faraday_jugador');
  r=await c.call('/api/auth/google');assert.equal(r.status,302);
  const location=r.headers.get('location');assert(location.startsWith(SUPABASE+'/auth/v1/authorize?'));
  const params=new URL(location).searchParams;assert.equal(params.get('provider'),'google');assert.equal(params.get('redirect_to'),SITE+'/api/auth/callback');assert.equal(params.get('code_challenge_method'),'s256');
  assert(c.jar.has('faraday_pkce'),'El verificador PKCE queda en una cookie HttpOnly');
  const back=supabase.googleReturns(location,'luis@gmail.test');
  r=await c.call(back.pathname+back.search);assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/?sesion=ok');
  assert.equal(c.jar.has('faraday_pkce'),false);assert(c.jar.has('faraday_sesion'));
  r=await c.call('/api/jugador',{method:'POST',body:{player:playerC}});assert.deepEqual(r.data.account,{email:'luis@gmail.test',name:'Ana Prueba',provider:'google'});assert.equal(r.data.player,playerC);
  // Un código robado sin el verificador de ese navegador no sirve.
  const d=browser();const stolen=supabase.googleReturns(location,'otra@gmail.test');
  r=await d.call(stolen.pathname+stolen.search);assert.equal(r.headers.get('location'),'/?sesion=error');assert.equal(d.jar.has('faraday_sesion'),false);

  // Sin Google activo en Supabase, el botón no lleva a ninguna parte.
  const noGoogle=createApi({store:fileStore(path.join(directory,'b.json')),auth:createAuth({url:SUPABASE,key:KEY,fetch:fakeAuth({google:false}).fetch})});
  const res=await noGoogle.handle(new Request(SITE+'/api/auth/google',{headers:{host:'casi.test'}}));assert.equal(res.headers.get('location'),'/?sesion=error');
  // Sin configurar, las rutas responden 503 y /api/jugador no incluye cuenta.
  const plain=createApi({store:fileStore(path.join(directory,'c.json'))});
  assert.equal((await plain.handle(new Request(SITE+'/api/auth/estado',{method:'POST',body:'{}'}))).status,503);
  assert.equal('account' in await(await plain.handle(new Request(SITE+'/api/jugador',{method:'POST',body:'{}'}))).json(),false);
  console.log('OK: inicio de sesión con código por correo y con Google (PKCE), enlace con el jugador, recuperación en otro dispositivo, renovación, salida y validaciones.');
}finally{if(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep))fs.rmSync(directory,{recursive:true,force:true})}
