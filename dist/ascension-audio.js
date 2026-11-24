// Una familia de motivos cortos, con el mismo control de sonido que todo Faraday.
(()=>{
  const root=293.66; // Re
  const cues={
    start:[[0,0,.12],[7,.09,.19]],
    clock:[[7,0,.12]],
    retry:[[0,0,.09]],
    pass:[[0,0,.12]],
    timeout:[[7,0,.11],[0,.09,.15]],
    settled:[[0,0,.16]],
    summary:[[0,0,.24],[7,.12,.25],[12,.25,.37]]
  };
  const responses={
    10:[[0,0,.18]],
    30:[[0,0,.14],[7,.10,.20]],
    60:[[0,0,.14],[4,.09,.14],[12,.18,.24]],
    85:[[0,0,.14],[7,.09,.16],[16,.19,.29]],
    100:[[0,0,.15],[7,.10,.16],[12,.20,.19],[16,.30,.36]],
    million:[[0,0,.13],[7,.09,.14],[12,.18,.16],[19,.27,.21],[24,.40,.40]]
  };

  function output(){
    return !document.hidden&&window.Sound?.on?window.Sound:null;
  }

  function motif(sound,notes,gain,type='sine'){
    notes.forEach(([step,at,duration],index)=>{
      sound.tone(root*2**(step/12),at,duration,{type,gain:gain*(index===0?1:.84)});
    });
  }

  function play(event){
    const sound=output(),notes=cues[event];
    if(sound&&notes)motif(sound,notes,(event==='clock'||event==='retry') ? .022 : .033);
  }

  function launch(points,bonus=false){
    const sound=output();
    if(!sound)return;
    const strength=bonus?1:Math.max(0,Math.min(1,points/118));
    sound.noise?.(0,.18+.16*strength,{gain:.026,from:210,to:450+450*strength,q:.85,attack:.04});
  }

  function response(points,{bonus=false,reason}={}){
    const sound=output();
    if(!sound)return;
    if(!points){play(reason==='timeout'?'timeout':'pass');return}
    motif(sound,responses[bonus?'million':points]||responses[10],.034,'triangle');
    if(bonus)sound.tone(root*2,.40,.37,{gain:.016});
  }

  window.AscensionAudio={play,launch,response};
})();
