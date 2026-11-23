// Salón: lo social de la sala. El chat (una caja abajo a la izquierda y un bocadillo sobre la cabeza de quien habla),
// la rueda de gestos y el botón de saltar. Aquí solo está la interfaz: casino.js mueve al personaje y coloca los
// bocadillos, y casino-friends.js lleva los mensajes y los gestos a los amigos.

// Gestos que se pueden hacer. «id» es el nombre del gesto en avatar3d.js (CLIPS) y el que viaja al servidor
// (SALON_ACTS en lib/casino.mjs). Los diez primeros tienen tecla: del 1 al 0.
export const EMOTES=[
  {id:'saludo',icon:'👋',name:'Saludar'},{id:'puno',icon:'✊',name:'¡Vamos!'},{id:'giro',icon:'🌀',name:'Giro'},{id:'bailar',icon:'💃',name:'Bailar'},
  {id:'robot',icon:'🤖',name:'Robot'},{id:'disco',icon:'🕺',name:'Disco'},{id:'twist',icon:'🎶',name:'Twist'},{id:'dab',icon:'😎',name:'Dab'},
  {id:'negar',icon:'🙅',name:'No'},{id:'pensar',icon:'🤔',name:'Pensar'},{id:'hombros',icon:'🤷',name:'Ni idea'},{id:'suspiro',icon:'😮‍💨',name:'Suspiro'}
];
const MAX=140,LINES=40;

export function casinoChat({root,onSay,onEmote,onJump}){
  const box=document.createElement('div');
  box.className='casino-social';
  box.innerHTML=`<div class="casino-bubbles" aria-hidden="true"></div>
    <section class="casino-chat" aria-label="Chat del Salón">
      <ol class="casino-chat-log" aria-live="polite" aria-relevant="additions"></ol>
      <form><label class="sr-only" for="casino-chat-input">Mensaje para el chat</label>
        <input id="casino-chat-input" type="text" maxlength="${MAX}" autocomplete="off" enterkeyhint="send" placeholder="Escribe aquí (Enter)"></form>
    </section>
    <div class="casino-emotes" id="casino-emotes" role="group" aria-label="Gestos" hidden>
      ${EMOTES.map((emote,i)=>`<button type="button" data-emote="${emote.id}"><span aria-hidden="true">${emote.icon}</span>${emote.name}${i<10?`<kbd aria-hidden="true">${(i+1)%10}</kbd>`:''}</button>`).join('')}
    </div>
    <div class="casino-acts">
      <button type="button" data-act="emotes" aria-expanded="false" aria-controls="casino-emotes"><span aria-hidden="true">👋</span> Gestos</button>
      <button type="button" data-act="jump"><span aria-hidden="true">⤴</span> Saltar</button>
    </div>`;
  root.append(box);
  const layer=box.querySelector('.casino-bubbles'),log=box.querySelector('.casino-chat-log'),form=box.querySelector('form'),input=box.querySelector('input');
  const wheel=box.querySelector('.casino-emotes'),toggle=box.querySelector('[data-act="emotes"]');
  const bubbles=new Map();

  function line(html,kind=''){
    const item=document.createElement('li');
    if(kind)item.className=kind;
    item.append(...html);
    log.append(item);
    while(log.children.length>LINES)log.firstElementChild.remove();
    log.scrollTop=log.scrollHeight;
  }
  // Un mensaje: va al registro y, si no es antiguo («quiet»), sale en un bocadillo sobre quien habla.
  function say({id,name,text,mine=false,quiet=false}){
    const who=document.createElement('b');
    who.textContent=name+': ';
    line([who,String(text)],mine?'is-mine':'');
    if(quiet)return;
    bubbles.get(id)?.el.remove();
    const el=document.createElement('p');
    el.className='casino-bubble';el.textContent=text;el.hidden=true;
    layer.append(el);
    bubbles.set(id,{el,until:performance.now()+3800+Math.min(4000,String(text).length*55)});
  }
  const note=text=>line([String(text)],'is-note');
  // Coloca los bocadillos. locate(id) devuelve dónde queda en pantalla la cabeza de ese jugador, o null si no se ve.
  function frame(now,locate){
    for(const [id,bubble] of bubbles){
      if(now>bubble.until){bubble.el.remove();bubbles.delete(id);continue}
      const at=locate(id);
      bubble.el.hidden=!at;
      if(at)bubble.el.style.transform=`translate(${at.x.toFixed(1)}px,${at.y.toFixed(1)}px)`;
      bubble.el.classList.toggle('is-fading',bubble.until-now<500);
    }
  }
  function showWheel(open){
    wheel.hidden=!open;toggle.setAttribute('aria-expanded',open);
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const text=input.value.replace(/\s+/g,' ').trim().slice(0,MAX);
    input.value='';input.blur();
    if(text)onSay(text);
  });
  // Escape suelta la caja sin cerrar el Salón.
  input.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();input.blur()}});
  box.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button)return;
    if(button.dataset.emote){showWheel(false);onEmote(button.dataset.emote)}
    else if(button.dataset.act==='emotes')showWheel(wheel.hidden);
    else if(button.dataset.act==='jump')onJump();
    // El foco vuelve al mundo para que las teclas sigan moviendo al personaje.
    root.querySelector('#casino-canvas')?.focus({preventScroll:true});
  });
  return {
    say,note,frame,
    focus(){input.focus()},
    blur(){input.blur()},
    typing:()=>document.activeElement===input,
    toggleEmotes(){showWheel(wheel.hidden)},
    clear(){for(const bubble of bubbles.values())bubble.el.remove();bubbles.clear();showWheel(false)}
  };
}
