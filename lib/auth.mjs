// Inicio de sesión opcional con Supabase Auth, hecho desde el servidor (decisión 0018).
// El navegador nunca habla con Supabase: la API llama a la API REST de Auth (/auth/v1) con la clave
// secreta y guarda la sesión en cookies HttpOnly. Sin SDK ni dependencias.
//
// - Correo: Supabase envía un código de un solo uso (/otp) que el jugador escribe en la app (/verify).
// - Google: OAuth con PKCE. /api/auth/google redirige a Supabase, que vuelve a /api/auth/callback.
//
// La cuenta guarda en app_metadata.jugador el identificador del jugador (el UUID anónimo de siempre).
// Así las respuestas siguen en answers con el mismo player_hash y el progreso se recupera en cualquier dispositivo.
import {createHash,randomBytes} from 'node:crypto';

export const SESSION_COOKIE='faraday_sesion',REFRESH_COOKIE='faraday_refresco',VERIFIER_COOKIE='faraday_pkce';
const REFRESH_MAX_AGE=60*60*24*60,PLAYER=/^[a-f0-9-]{36}$/i,EMAIL=/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

const base64url=buffer=>buffer.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function cookie(request,name,value,maxAge){
  const secure=new URL(request.url).protocol==='https:'||request.headers.get('x-forwarded-proto')==='https';
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure?'; Secure':''}`;
}
export const clearCookies=request=>[SESSION_COOKIE,REFRESH_COOKIE].map(name=>cookie(request,name,'',0));

export function createAuth({url,key,fetch:request=globalThis.fetch,log=console.error}){
  if(!url||!key)return null;
  const root=url.replace(/\/+$/,'')+'/auth/v1';
  async function call(path,{method='GET',body,token,admin}={}){
    const headers={apikey:key};
    if(body)headers['Content-Type']='application/json';
    if(token||admin)headers.Authorization='Bearer '+(token||key);
    const response=await request(root+path,{method,headers,body:body&&JSON.stringify(body),signal:AbortSignal.timeout(8000)});
    const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
    return {ok:response.ok,status:response.status,data};
  }
  // Proveedores activos en Supabase. Se guarda un minuto para no preguntarlo en cada visita.
  let settings,settingsAt=0;
  async function providers(){
    if(Date.now()-settingsAt>60000){
      const r=await call('/settings').catch(()=>null);
      if(r?.ok){settings=r.data;settingsAt=Date.now()}
    }
    return {email:settings?.external?.email!==false,google:settings?.external?.google===true};
  }
  const account=user=>({id:user.id,meta:user.app_metadata||{},email:user.email||null,name:user.user_metadata?.full_name||user.user_metadata?.name||null,provider:user.app_metadata?.provider||'email',player:PLAYER.test(user.app_metadata?.jugador||'')?user.app_metadata.jugador.toLowerCase():null});
  const sessionCookies=(req,session)=>[cookie(req,SESSION_COOKIE,session.access_token,Math.max(60,Number(session.expires_in)||3600)),cookie(req,REFRESH_COOKIE,session.refresh_token,REFRESH_MAX_AGE)];

  return {
    providers,
    // Pide a Supabase que envíe el código al correo. Crea la cuenta si no existe.
    async sendCode(email){
      if(typeof email!=='string'||!EMAIL.test(email.trim()))return {status:400,error:'Escribe un correo válido'};
      const r=await call('/otp',{method:'POST',body:{email:email.trim().toLowerCase(),create_user:true}});
      if(r.ok)return {status:200};
      if(r.status===429)return {status:429,error:'Has pedido demasiados códigos. Espera un poco y vuelve a intentarlo.'};
      log('Auth /otp:',r.status,r.data?.msg||r.data?.error_description||'');
      return {status:502,error:'No hemos podido enviar el código. Inténtalo más tarde.'};
    },
    async verifyCode(email,code){
      if(typeof email!=='string'||!EMAIL.test(email.trim())||typeof code!=='string'||!/^\d{6,10}$/.test(code.trim()))return {status:400,error:'Escribe el código que te hemos enviado'};
      const r=await call('/verify',{method:'POST',body:{type:'email',email:email.trim().toLowerCase(),token:code.trim()}});
      if(r.ok&&r.data?.access_token)return {status:200,session:r.data};
      return {status:401,error:'El código no es correcto o ha caducado'};
    },
    // Google con PKCE: el verificador va en una cookie HttpOnly de 10 minutos.
    googleStart(req,origin){
      const verifier=base64url(randomBytes(48)),challenge=base64url(createHash('sha256').update(verifier).digest());
      const params=new URLSearchParams({provider:'google',redirect_to:origin+'/api/auth/callback',code_challenge:challenge,code_challenge_method:'s256'});
      return {location:`${root}/authorize?${params}`,cookie:cookie(req,VERIFIER_COOKIE,verifier,600)};
    },
    async exchange(code,verifier){
      if(typeof code!=='string'||!code||typeof verifier!=='string'||!verifier)return null;
      const r=await call('/token?grant_type=pkce',{method:'POST',body:{auth_code:code,code_verifier:verifier}});
      return r.ok&&r.data?.access_token?r.data:null;
    },
    // Sesión de la petición: valida el token y, si caducó, lo renueva con el de refresco.
    // Devuelve {account, cookies} (cookies nuevas si se renovó; las de borrado si ya no vale) o null si no hay sesión.
    async current(req,read){
      const access=read(req,SESSION_COOKIE),refresh=read(req,REFRESH_COOKIE);
      if(!access&&!refresh)return null;
      if(access){const r=await call('/user',{token:access});if(r.ok&&r.data?.id)return {account:account(r.data),cookies:[]}}
      if(refresh){
        const r=await call('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:refresh}});
        if(r.ok&&r.data?.user)return {account:account(r.data.user),cookies:sessionCookies(req,r.data)};
      }
      return {account:null,cookies:clearCookies(req)};
    },
    sessionCookies,
    account,
    // Enlaza la cuenta con un jugador. Solo la primera vez: después la cuenta conserva el suyo.
    // Recibe una cuenta (de account() o current()) y devuelve la cuenta ya enlazada.
    async link(current,player){
      if(current.player||!PLAYER.test(player||''))return current;
      const meta={...current.meta,jugador:player.toLowerCase()};
      const r=await call('/admin/users/'+encodeURIComponent(current.id),{method:'PUT',admin:true,body:{app_metadata:meta}});
      if(!r.ok){log('Auth enlazar jugador:',r.status,r.data?.msg||'');throw Error('No se pudo enlazar la cuenta')}
      return {...current,meta,player:meta.jugador};
    },
    async logout(req,read){
      const access=read(req,SESSION_COOKIE);
      if(access)await call('/logout?scope=local',{method:'POST',token:access}).catch(()=>{});
    }
  };
}
