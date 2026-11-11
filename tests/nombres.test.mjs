// Prueba los nombres de usuario únicos (lib/nombres.mjs) a través de la API, sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore,supabaseStore} from '../lib/stores.mjs';
import {checkName,nameKey} from '../lib/nombres.mjs';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-nombres-'));
const post=api=>async(route,data)=>{
  const response=await api.handle(new Request('http://casi.test/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}));
  return {status:response.status,data:await response.json()};
};
try{
  // Reglas del nombre.
  assert.equal(nameKey('José  Luis_99'),'joseluis99','Sin mayúsculas, acentos, espacios ni signos');
  assert.deepEqual(checkName('  Ada   Lovelace '),{name:'Ada Lovelace',key:'adalovelace'});
  assert.ok(checkName('ab').error,'Menos de 3 caracteres');assert.ok(checkName('x'.repeat(17)).error,'Más de 16 caracteres');
  assert.ok(checkName('<b>hola</b>').error,'Caracteres no permitidos');assert.ok(checkName('. _ -').error,'Sin letras ni números');
  for(const reserved of ['Faraday-bot','FARADAY','Jugador 123','jugador','Admin'])assert.ok(checkName(reserved).error,`«${reserved}» está reservado`);
  assert.ok(checkName(42).error,'Tiene que ser texto');

  const file=path.join(directory,'answers.json'),call=post(createApi({store:fileStore(file),persistDays:false,log:()=>{}}));
  const ana=randomUUID(),luis=randomUUID();
  assert.deepEqual((await call('nombre',{player:ana})).data,{name:null},'Sin nombre reservado');
  assert.equal((await call('nombre',{})).status,400,'Hace falta el jugador');
  let r=await call('nombre',{player:ana,name:' José Luis '});
  assert.equal(r.status,200);assert.equal(r.data.name,'José Luis','Se guarda limpio, con sus mayúsculas y acentos');
  assert.equal((await call('nombre',{player:ana})).data.name,'José Luis');

  // Otro jugador no puede usar el mismo nombre, aunque lo escriba de otra forma.
  for(const copy of ['José Luis','jose luis','JOSE_LUIS','josé-luis'])assert.equal((await call('nombre',{player:luis,name:copy})).status,409,`«${copy}» ya está cogido`);
  assert.equal((await call('nombre',{player:luis,name:'ab'})).status,400,'Nombre no válido');
  assert.equal((await call('nombre',{player:luis,name:'Faraday bot'})).status,400,'Nombre reservado');
  assert.equal((await call('nombre',{player:luis,name:'Luis'})).status,200);

  // El dueño puede repetir su nombre o cambiarlo; al cambiarlo, el anterior queda libre.
  assert.equal((await call('nombre',{player:ana,name:'jose luis'})).data.name,'jose luis','Puede cambiar mayúsculas y acentos de su propio nombre');
  assert.equal((await call('nombre',{player:ana,name:'Ana'})).status,200);
  assert.equal((await call('nombre',{player:luis,name:'José Luis'})).status,200,'El nombre que Ana dejó queda libre');
  assert.equal((await call('nombre',{player:ana,name:'Jose Luis'})).status,409,'Y ahora es de Luis');

  // /api/jugador devuelve el nombre reservado, para recuperarlo en otro dispositivo.
  assert.equal((await call('jugador',{player:ana})).data.name,'Ana');
  assert.equal((await call('jugador',{player:randomUUID()})).data.name,null);

  // Los nombres sobreviven a un reinicio del servidor local.
  const again=post(createApi({store:fileStore(file),persistDays:false,log:()=>{}}));
  assert.equal((await again('nombre',{player:ana})).data.name,'Ana');
  assert.equal((await again('nombre',{player:randomUUID(),name:'ana'})).status,409);

  // En los duelos se juega con el nombre reservado y no se puede usar el de otro jugador.
  const intruso=randomUUID();
  let duel=await call('duelo',{action:'crear',player:ana,name:'Otro nombre',avatar:{},level:1});
  assert.equal(duel.status,200);assert.equal(duel.data.players[0].name,'Ana','Manda el nombre reservado');
  duel=await call('duelo',{action:'crear',player:intruso,name:'José  Luis',avatar:{},level:1});
  assert.match(duel.data.players[0].name,/^Jugador \d{3}$/,'Sin reserva no se puede usar el nombre de otro');
  duel=await call('duelo',{action:'crear',player:randomUUID(),name:'Nombre libre',avatar:{},level:1});
  assert.equal(duel.data.players[0].name,'Nombre libre','Un nombre que nadie ha reservado se puede usar sin reservarlo');

  // Almacén de Supabase: consultas a la tabla usernames y un 409 cuando el nombre es de otro.
  const requests=[],hash=createHash('sha256').update(ana).digest('hex');
  const fake=async(url,init={})=>{
    requests.push({url:String(url),method:init.method||'GET',body:init.body?JSON.parse(init.body):null,headers:init.headers});
    if(init.method==='POST')return new Response(null,{status:String(url).includes('usernames')&&JSON.parse(init.body).name_key==='cogido'?409:201});
    return new Response(JSON.stringify(String(url).includes('name_key=eq.')?[{player_hash:hash}]:[{name:'Ana'}]),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const supabase=supabaseStore({url:'https://ejemplo.supabase.co',key:'clave-de-prueba',fetch:fake});
  assert.equal(await supabase.names.get(hash),'Ana');assert.match(requests.at(-1).url,/\/rest\/v1\/usernames\?select=name&player_hash=eq\./);
  assert.equal(await supabase.names.owner('ana'),hash);
  assert.equal(await supabase.names.claim(hash,'Ana','ana'),true);
  assert.deepEqual({...requests.at(-1).body,updated_at:null},{player_hash:hash,name:'Ana',name_key:'ana',updated_at:null});
  assert.equal(requests.at(-1).headers.apikey,'clave-de-prueba','La cabecera lleva la clave del almacén');
  assert.match(requests.at(-1).url,/on_conflict=player_hash/);
  assert.equal(await supabase.names.claim(hash,'Cogido','cogido'),false,'Un 409 significa que el nombre es de otro');

  // Si el almacén de nombres falla (por ejemplo, la tabla aún no existe), el resto sigue funcionando.
  const roto=post(createApi({store:{...fileStore(path.join(directory,'otro.json')),names:{get:async()=>{throw Error('sin tabla')},owner:async()=>{throw Error('sin tabla')},claim:async()=>{throw Error('sin tabla')}}},persistDays:false,log:()=>{}}));
  assert.equal((await roto('nombre',{player:ana,name:'Ana'})).status,503);
  assert.equal((await roto('jugador',{player:ana})).status,200,'El jugador se identifica aunque no haya nombres');
  assert.equal((await roto('duelo',{action:'crear',player:ana,name:'Ana',avatar:{},level:1})).status,200,'Los duelos siguen funcionando');
  console.log('Pruebas de nombres de usuario superadas');
}finally{fs.rmSync(directory,{recursive:true,force:true})}
