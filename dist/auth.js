// Inicio de sesión opcional (decisión 0018): código por correo o Google, siempre a través de /api/auth/.
// El navegador no habla con Supabase ni ve los tokens: la sesión vive en cookies HttpOnly del servidor.
// Usa syncPlayer, leaveAccount, currentAccount y playerId de community.js, y showToast de app.js.
(()=>{
  const $id=id=>document.getElementById(id),dialog=$id('auth-dialog'),message=$id('auth-message');
  let email='',providers=null,account=typeof currentAccount!=="undefined"?currentAccount:null,busy=false;
  const post=(route,body={})=>fetch('/api/auth/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin',signal:AbortSignal.timeout(12000)});
  const say=(text='')=>{message.textContent=text};
  function step(name){for(const id of ['start','code','account'])$id('auth-step-'+id).hidden=id!==name;say()}
  function render(){
    const label=account?(account.name||account.email||'Tu cuenta'):'Entrar';
    const home=$id('home-account');home.classList.toggle('is-signed',Boolean(account));
    home.querySelector('.home-account-label').textContent=account?label.charAt(0).toUpperCase():'Entrar';
    home.setAttribute('aria-label',account?`Tu cuenta: ${account.email||label}`:'Entrar o crear cuenta');home.title=account?account.email||label:'';
    $id('menu-account-label').textContent=account?(account.email||label):'Entrar o crear cuenta';
    $id('menu-account-hint').textContent=account?'Sesión iniciada':'Guarda tu progreso';
  }
  async function loadProviders(){
    if(providers)return providers;
    try{const r=await post('estado');if(r.status===503){providers={off:true};return providers}if(!r.ok)throw Error();providers=(await r.json()).providers}catch{providers=null;return {email:true,google:false}}
    return providers;
  }
  async function open(){
    if(typeof toggleMenu==='function')toggleMenu(false);
    say();dialog.showModal();
    if(account){$id('auth-account-email').textContent=account.email||'tu cuenta';$id('auth-account-title').textContent=account.name?`Hola, ${account.name.split(' ')[0]}`:'Sesión iniciada';step('account');$id('auth-logout').focus();return}
    step('start');
    const p=await loadProviders();
    $id('auth-google').hidden=!p.google;$id('auth-or').hidden=!p.google;
    if(p.off){say('El inicio de sesión aún no está disponible en este servidor.');$id('auth-email-form').querySelector('button').disabled=true}
    else $id('auth-email').focus();
  }
  async function sendCode(){
    if(busy)return;const value=$id('auth-email').value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)){say('Escribe un correo válido.');$id('auth-email').focus();return}
    busy=true;say('Enviando…');
    try{
      const r=await post('codigo',{email:value}),data=await r.json().catch(()=>({}));
      if(!r.ok){say(data.error||'No hemos podido enviar el código.');return}
      email=value;$id('auth-sent-to').textContent=value;$id('auth-code').value='';step('code');$id('auth-code').focus();
    }catch{say('No hay conexión. Inténtalo de nuevo.')}finally{busy=false}
  }
  async function verify(){
    if(busy)return;const code=$id('auth-code').value.replace(/\D/g,'');
    if(code.length<6){say('El código tiene al menos 6 cifras.');$id('auth-code').focus();return}
    busy=true;say('Comprobando…');
    try{
      const r=await post('verificar',{email,code,player:playerId()}),data=await r.json().catch(()=>({}));
      if(!r.ok){say(data.error||'El código no es correcto.');$id('auth-code').select();return}
      await syncPlayer();window.Progress?.syncName();account=currentAccount||data.account;render();dialog.close();
      showToast('Sesión iniciada. Tu progreso ya se guarda en tu cuenta.');
    }catch{say('No hay conexión. Inténtalo de nuevo.')}finally{busy=false}
  }
  async function logout(){
    if(busy)return;busy=true;say('Cerrando sesión…');
    try{
      const r=await post('salir'),data=await r.json().catch(()=>({}));if(!r.ok)throw Error();
      leaveAccount(data.player);window.Progress?.syncName();account=null;render();dialog.close();showToast('Has cerrado la sesión.');
    }catch{say('No se pudo cerrar la sesión. Inténtalo de nuevo.')}finally{busy=false}
  }
  document.querySelectorAll('[data-auth-open]').forEach(button=>button.addEventListener('click',open));
  $id('auth-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
  $id('auth-email-form').addEventListener('submit',event=>{event.preventDefault();sendCode()});
  $id('auth-code-form').addEventListener('submit',event=>{event.preventDefault();verify()});
  $id('auth-code').addEventListener('input',event=>{const digits=event.target.value.replace(/\D/g,'');event.target.value=digits;if(digits.length===6&&!busy)verify()});
  $id('auth-back').addEventListener('click',()=>{step('start');$id('auth-email').focus()});
  $id('auth-resend').addEventListener('click',()=>{$id('auth-email').value=email;sendCode()});
  $id('auth-logout').addEventListener('click',logout);
  document.addEventListener('faraday:cuenta',event=>{account=event.detail.account;render()});
  // Vuelta desde Google: /api/auth/callback redirige a /?sesion=ok o /?sesion=error.
  const params=new URLSearchParams(location.search),result=params.get('sesion');
  if(result){
    params.delete('sesion');history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);
    playerReady.then(()=>showToast(result==='ok'&&currentAccount?'Sesión iniciada. Tu progreso ya se guarda en tu cuenta.':'No se pudo iniciar sesión con Google. Inténtalo de nuevo.'));
  }
  render();
})();
