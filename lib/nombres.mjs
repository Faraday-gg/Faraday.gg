// Nombres de usuario únicos (decisión 0025). Cada jugador puede reservar un nombre de 3 a 16 caracteres; dos nombres
// son el mismo si coinciden sin mayúsculas, acentos, espacios ni signos («José Luis» = «jose_luis»).
// El nombre va ligado al jugador (el SHA-256 de su identificador), que es lo que enlaza una cuenta: por eso viaja
// entre dispositivos al iniciar sesión.
//   names.get(hash)             -> nombre reservado por ese jugador, o null
//   names.owner(key)            -> hash del jugador que tiene ese nombre, o null
//   names.claim(hash,name,key)  -> true si lo reserva (o ya era suyo); false si lo tiene otro
const ALLOWED=/^[\p{L}\p{N} _.-]+$/u;
// Nombres que no se pueden reservar: el del bot, los del juego y el provisional «Jugador 123».
const RESERVED=/^(faraday|faradaybot|faradaygg|casicasi|admin|administrador|moderador|soporte|jugador\d*)$/;

export const nameKey=name=>name.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[ _.-]/g,'');

// Devuelve {name,key} si el nombre vale, o {error} con el motivo para enseñárselo al jugador.
export function checkName(value){
  if(typeof value!=='string')return {error:'Escribe un nombre de usuario'};
  const name=value.replace(/\s+/g,' ').trim();
  if(name.length<3||name.length>16)return {error:'El nombre debe tener entre 3 y 16 caracteres'};
  if(!ALLOWED.test(name))return {error:'Usa solo letras, números, espacios, puntos, guiones y guiones bajos'};
  const key=nameKey(name);
  if(key.length<3)return {error:'El nombre necesita al menos 3 letras o números'};
  if(RESERVED.test(key))return {error:'Ese nombre está reservado. Elige otro'};
  return {name,key};
}

// En memoria: para el servidor local sin disco y para las pruebas.
export function memoryNames(initial={}){
  const rows=new Map(Object.entries(initial));
  return {
    async get(hash){return rows.get(hash)?.name??null},
    async owner(key){for(const [hash,row] of rows)if(row.key===key)return hash;return null},
    async claim(hash,name,key){const owner=await this.owner(key);if(owner&&owner!==hash)return false;rows.set(hash,{name,key});return true},
    dump:()=>Object.fromEntries(rows)
  };
}
