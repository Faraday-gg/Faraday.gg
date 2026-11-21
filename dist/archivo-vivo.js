import { MIN_YEAR, MAX_YEAR, MAX_POINTS, scenes, scoreYear } from './archivo-vivo-rondas.js';
import { mountPanorama } from './archivo-vivo-visor.js';

const dialog = document.getElementById('archivo-vivo');
const body = document.getElementById('archivo-vivo-body');
const progress = document.getElementById('archivo-vivo-progress');
const close = dialog.querySelector('[data-av-close]');
const mode = 'archivo-vivo';
const legacyKey = 'faraday.archivo-vivo.v1';
const draftKey = 'faraday.archivo-vivo.v2.draft';
const byId = new Map(scenes.map(scene => [scene.id, scene]));
const format = new Intl.NumberFormat('es-ES');
const validYear = year => Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
const photoUrl = scene => `assets/archivo-vivo/${scene.id}-foto.jpg`;
const yearError = `Escribe un año entre ${MIN_YEAR} y ${MAX_YEAR}.`;
const panoramaIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4H4v3m13-3h3v3M4 17v3h3m13-3v3h-3"/><ellipse cx="12" cy="12" rx="7" ry="3.5"/><path d="M12 8.5c3 0 3 7 0 7s-3-7 0-7Z"/></svg>';

let run = null;
let opener;
let immersion;
let pending = false;
let viewVersion = 0;

function localRead(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function legacyRun() {
  const saved = localRead(legacyKey);
  if (!Array.isArray(saved?.guesses) || saved.guesses.length > 3 || !saved.guesses.every(validYear) ||
      !Number.isInteger(saved.index) || saved.index < 0 || saved.index > 3 ||
      (saved.index !== saved.guesses.length && saved.index !== saved.guesses.length - 1) ||
      typeof saved.draft !== 'string' || !/^\d{0,4}$/.test(saved.draft)) return null;
  return saved.guesses.length || saved.draft ? saved : null;
}

function saveDraft() {
  const key = draftKey + '.' + run.id;
  try {
    if (run.draft) localStorage.setItem(key, JSON.stringify({ index: run.index, value: run.draft }));
    else localStorage.removeItem(key);
  } catch {}
}

function adopt(data, legacy) {
  if (!Array.isArray(data?.scenes) || !data.scenes.length || data.scenes.some(id => !byId.has(id))) {
    throw Error('No se pudo recuperar la colección fotográfica.');
  }
  const local = localRead(draftKey + '.' + data.id);
  const draft = local && local.index === data.index && /^\d{0,4}$/.test(local.value)
    ? local.value
    : data.kind === 'legacy' && legacy?.index === data.index ? legacy.draft : '';
  run = { ...data, draft: data.index === data.guesses.length ? draft : '' };
  // Estadísticas del perfil (stats.js): los puntos de cada foto respondida de esta partida.
  window.Progress?.tally?.('archivo', `${run.date}:${run.id}`, run.guesses.map((year, index) => scoreYear(year, byId.get(run.scenes[index]).year)), run.scenes.length);
  saveDraft();
  if (legacy) {
    try { localStorage.removeItem(legacyKey); } catch {}
  }
}

async function request(action, extra = {}) {
  await playerReady;
  const response = await fetch('/api/continuacion', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
    body: JSON.stringify({ mode, action, ...extra }), signal: AbortSignal.timeout(12000)
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'No se pudo guardar la partida.');
  return data;
}

async function load() {
  const visit = ++viewVersion;
  stopViewer();
  run = null;
  pending = false;
  progress.textContent = '';
  body.innerHTML = '<section class="av-panel"><h3 tabindex="-1">Abriendo Archivo Vivo…</h3></section>';
  const legacy = legacyRun();
  try {
    const data = await request('archivo-estado', legacy ? { legacy: { index: legacy.index, guesses: legacy.guesses } } : {});
    if (visit !== viewVersion || !dialog.open) return;
    adopt(data, legacy);
    render(true);
  } catch (error) {
    if (visit !== viewVersion || !dialog.open) return;
    body.innerHTML = '<section class="av-panel"><h3 tabindex="-1">No se pudo abrir Archivo Vivo</h3><p role="status"></p><button class="av-primary" type="button" data-av="retry">Reintentar</button></section>';
    body.querySelector('[role="status"]').textContent = error.message;
    body.querySelector('h3').focus({ preventScroll: true });
  }
}

async function playAction(action, button, extra) {
  if (!run || pending) return;
  const visit = viewVersion;
  pending = true;
  if (button) button.disabled = true;
  try {
    const data = await request(action, { date: run.date, id: run.id, index: run.index, ...extra });
    if (visit !== viewVersion || !dialog.open) return;
    adopt(data);
    render(true);
  } catch (error) {
    if (visit === viewVersion && dialog.open) {
      const status = body.querySelector('[data-av-error],#av-year-feedback');
      if (status) {
        status.hidden = false;
        status.textContent = error.message;
      }
    }
  } finally {
    if (visit === viewVersion) {
      pending = false;
      if (button?.isConnected) button.disabled = false;
    }
  }
}

function stopViewer() {
  if (!immersion) return;
  const viewing = immersion;
  immersion = null;
  viewing.viewer?.destroy();
  stopAvatar(viewing);
  dialog.classList.remove('av-immersive');
  close.textContent = '×';
  close.setAttribute('aria-label', 'Cerrar Archivo Vivo');
}

function stopAvatar(viewing) {
  viewing.avatar?.destroy();
  viewing.avatar = null;
  viewing.avatarCanvas.hidden = true;
  viewing.feetButton.hidden = true;
}

function drawAvatar(viewing) {
  if (!viewing.view || viewing.avatarFailed || !window.Avatar3D?.firstPerson) return;
  try {
    if (!viewing.avatar) {
      const look = window.Avatar.resolve(window.Progress?.look?.());
      viewing.avatar = window.Avatar3D.firstPerson(viewing.avatarCanvas, look, viewing.ground);
    }
    if (viewing.avatar) {
      viewing.avatarCanvas.hidden = false;
      viewing.avatar.draw(viewing.view);
      viewing.feetButton.hidden = !viewing.viewer?.lookAtFeet;
    } else {
      viewing.avatarFailed = true;
    }
  } catch {
    viewing.avatarFailed = true;
    stopAvatar(viewing);
  }
}

function photo(scene) {
  if (!scene.ground) return `<div class="av-photo"><img src="${photoUrl(scene)}" alt="${scene.alt}"></div>
    <div class="av-photo-caption"><p>Fotografía de archivo</p></div>`;
  return `<button class="av-photo" type="button" data-av="enter" aria-label="Entrar en el año en 360 grados" aria-describedby="av-photo-description">
    <img id="av-photo-description" src="${photoUrl(scene)}" alt="${scene.alt}">
    <span class="av-enter">${panoramaIcon} Entrar en el año <span class="av-enter-degrees">360°</span></span>
  </button>
  <div class="av-photo-caption"><p>Fotografía de archivo</p><p>Toca o haz clic en la foto para explorarla.</p></div>`;
}

function showPhoto(scene, focusAnswer) {
  stopViewer();
  body.querySelector('.av-stage').innerHTML = photo(scene);
  const target = (focusAnswer && body.querySelector('#av-year')) || body.querySelector('.av-panel h3');
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'nearest' });
}

function enterPhoto(scene, fromKeyboard) {
  if (!scene.ground) return;
  const stage = body.querySelector('.av-stage');
  stage.innerHTML = `<div class="av-viewer">
    <img src="${photoUrl(scene)}" alt="${scene.alt}">
    <canvas class="av-panorama" hidden tabindex="0" aria-label="Panorama interactivo. Usa las flechas para girar y + o − para acercar o alejar."></canvas>
    <canvas class="av-avatar" aria-hidden="true" hidden></canvas>
    <div class="av-viewer-meta">
      <p class="av-viewer-status" role="status">Cargando panorama…</p>
      <p class="av-viewer-label">Recreación con IA</p>
    </div>
    <div class="av-viewer-controls" aria-label="Controles del panorama" role="group" hidden>
      <button class="av-feet" type="button" data-av="feet" hidden>Mirar a mis pies</button>
      <button type="button" data-av="zoom-out" aria-label="Alejar">−</button>
      <button type="button" data-av="zoom-in" aria-label="Acercar">+</button>
      <button type="button" data-av="reset-view" aria-label="Volver al encuadre inicial">⟲</button>
    </div>
  </div>`;
  const canvas = stage.querySelector('.av-panorama');
  const controls = stage.querySelector('.av-viewer-controls');
  const image = stage.querySelector('img');
  const label = stage.querySelector('.av-viewer-label');
  const status = stage.querySelector('[role="status"]');
  const viewing = {
    ground: scene.ground,
    avatarCanvas: stage.querySelector('.av-avatar'),
    feetButton: stage.querySelector('[data-av="feet"]')
  };
  immersion = viewing;
  dialog.classList.add('av-immersive');
  dialog.scrollTop = 0;
  close.textContent = run.guesses.length === run.index ? 'Volver a responder' : 'Volver al resultado';
  close.removeAttribute('aria-label');
  close.focus({ preventScroll: true });
  viewing.viewer = mountPanorama(canvas, scene, {
    ready() {
      canvas.hidden = false;
      controls.hidden = false;
      image.hidden = true;
      status.textContent = matchMedia('(pointer: coarse)').matches
        ? 'Arrastra para mirar alrededor.'
        : 'Arrastra o usa las flechas para mirar alrededor.';
      if (fromKeyboard && document.activeElement === close) {
        canvas.focus({ preventScroll: true });
      }
    },
    onView(view) {
      viewing.view = view;
      drawAvatar(viewing);
    },
    unavailable() {
      const focusInViewer = canvas === document.activeElement || controls.contains(document.activeElement);
      viewing.viewer?.destroy();
      viewing.viewer = null;
      viewing.view = null;
      stopAvatar(viewing);
      canvas.hidden = true;
      controls.hidden = true;
      label.hidden = true;
      image.hidden = false;
      status.textContent = 'El visor 360° no está disponible. Puedes responder mirando la foto.';
      if (focusInViewer) close.focus({ preventScroll: true });
    }
  });
}

function renderRound(scene, guess) {
  progress.textContent = `Foto ${run.index + 1} de ${run.scenes.length}`;
  const content = guess === undefined
    ? `<h3 tabindex="-1">¿De qué año es esta foto?</h3>
       <form class="av-year-form" novalidate>
         <label for="av-year">Año de la foto</label>
         <div class="av-year-controls">
           <button type="button" data-av="year-down" aria-label="Restar un año">−</button>
           <input id="av-year" name="year" type="number" inputmode="numeric" step="1" min="${MIN_YEAR}" max="${MAX_YEAR}"
             placeholder="${MIN_YEAR}–${MAX_YEAR}" value="${run.draft}" aria-describedby="av-year-feedback" required>
           <button type="button" data-av="year-up" aria-label="Sumar un año">+</button>
         </div>
         <p class="av-year-feedback" id="av-year-feedback" role="status"></p>
         <button type="submit" class="av-primary">Confirmar año</button>
       </form>
       <details class="av-clue"><summary>Pista de la foto original</summary><p>${scene.detail}</p></details>`
    : `<p class="av-score">${format.format(scoreYear(guess, scene.year))} de ${format.format(MAX_POINTS)} puntos</p>
       <h3 tabindex="-1">${scene.year}</h3>
       <p>${guess === scene.year ? '¡Año exacto!' : `Tu respuesta: ${guess} · Diferencia: ${Math.abs(scene.year - guess)} ${Math.abs(scene.year - guess) === 1 ? 'año' : 'años'}`}</p>
       <p><strong>${scene.title}</strong><br>${scene.place}</p>
       <p>${scene.story}</p>
       <p class="av-credit">${scene.credit} · ${scene.rights}. <a href="${scene.source}" target="_blank" rel="noopener">Ver ficha de archivo</a>
         ${scene.ground && scene.ground.reference !== scene.source ? ` · <a href="${scene.ground.reference}" target="_blank" rel="noopener">Referencia de la recreación</a>` : ''}</p>
       <p role="status" data-av-error hidden></p>
       <button class="av-primary" type="button" data-av="next">${run.index === run.scenes.length - 1 ? 'Ver resultado' : 'Siguiente foto'}</button>`;
  body.innerHTML = `<div class="av-round">
    <div class="av-stage">${photo(scene)}</div>
    <section class="av-panel">${content}</section>
  </div>`;
}

function renderSummary() {
  progress.textContent = '';
  const collection = run.scenes.map(id => byId.get(id));
  const scores = run.guesses.map((year, index) => scoreYear(year, collection[index].year));
  const total = format.format(scores.reduce((sum, points) => sum + points, 0));
  body.innerHTML = `<section class="av-summary">
    <h3 tabindex="-1"><span>${total}</span> de ${format.format(collection.length * MAX_POINTS)} puntos</h3>
    <ol>${collection.map((scene, index) => `<li>
      <img src="${photoUrl(scene)}" alt="">
      <div><a href="${scene.source}" target="_blank" rel="noopener">${scene.title}</a>
        <small>${scene.year} · Tu respuesta: ${run.guesses[index]}</small></div>
      <strong>${format.format(scores[index])} pts</strong>
    </li>`).join('')}</ol>
    <div data-continue-slot="${mode}"></div>
    <div data-plus-slot="archivo-vivo" data-compact="true"></div>
  </section>`;
}

function render(focus = false) {
  stopViewer();
  if (run.index === run.scenes.length) renderSummary();
  else renderRound(byId.get(run.scenes[run.index]), run.guesses[run.index]);
  dialog.scrollTop = 0;
  if (focus) body.querySelector('h3').focus({ preventScroll: true });
}

function updateDraft(input) {
  run.draft = /^\d{0,4}$/.test(input.value) ? input.value : '';
  body.querySelector('#av-year-feedback').textContent = '';
  input.removeAttribute('aria-invalid');
  saveDraft();
}

window.PlusOffers?.register(mode, {
  title: 'Sigue explorando con Faraday Plus',
  description: 'Juega las partidas extra de Archivo Vivo sin anuncios.'
});

window.Continuations?.register(mode, async offer => {
  const visit = viewVersion;
  const data = await request('archivo-extra', { date: offer.date, ticket: offer.ticket, id: offer.id, from: run?.id });
  if (visit !== viewVersion || !dialog.open) return;
  adopt(data);
  render(true);
});

document.querySelectorAll('[data-open-archivo-vivo]').forEach(button => button.addEventListener('click', () => {
  opener = button;
  if (window.menuOpen?.()) {
    opener = document.getElementById(document.getElementById('game-shell').hidden ? 'home-menu-toggle' : 'menu-toggle');
    window.toggleMenu(false);
  }
  dialog.showModal();
  load();
}));

dialog.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-av-close')) {
    const focusAnswer = event.detail === 0 || event.pointerType === 'mouse' ||
      (!event.pointerType && matchMedia('(pointer: fine)').matches);
    if (!backFromViewer(focusAnswer)) dialog.close();
    return;
  }
  if (button.dataset.av === 'retry') {
    load();
    return;
  }
  if (!run || pending) return;
  const scene = byId.get(run.scenes[run.index]);
  switch (button.dataset.av) {
    case 'enter': enterPhoto(scene, event.detail === 0); break;
    case 'zoom-in': immersion?.viewer?.magnify(1.25); break;
    case 'zoom-out': immersion?.viewer?.magnify(0.8); break;
    case 'reset-view': immersion?.viewer?.reset(); break;
    case 'feet': immersion?.viewer?.lookAtFeet?.(); break;
    case 'year-down':
    case 'year-up': {
      const input = body.querySelector('#av-year');
      const current = input.valueAsNumber;
      const delta = button.dataset.av === 'year-up' ? 1 : -1;
      const year = Number.isFinite(current) ? Math.round(current) + delta : (MIN_YEAR + MAX_YEAR) / 2;
      input.value = Math.max(MIN_YEAR, Math.min(MAX_YEAR, year));
      updateDraft(input);
      break;
    }
    case 'next': playAction('archivo-siguiente', button); break;
  }
});

body.addEventListener('input', event => {
  if (run && event.target.id === 'av-year') updateDraft(event.target);
});

body.addEventListener('submit', event => {
  if (!event.target.matches('.av-year-form')) return;
  event.preventDefault();
  const input = event.target.elements.year;
  if (!validYear(input.valueAsNumber)) {
    input.setAttribute('aria-invalid', 'true');
    body.querySelector('#av-year-feedback').textContent = yearError;
    input.focus({ preventScroll: true });
    return;
  }
  if (!run || run.guesses.length !== run.index) return;
  playAction('archivo-responder', event.submitter, { guess: input.valueAsNumber });
});

function backFromViewer(focusAnswer = false) {
  if (!immersion) return false;
  showPhoto(byId.get(run.scenes[run.index]), focusAnswer);
  return true;
}

dialog.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  event.stopPropagation();
  if (!backFromViewer(true)) dialog.close();
});
dialog.addEventListener('cancel', event => {
  if (backFromViewer()) event.preventDefault();
});
dialog.addEventListener('close', () => {
  viewVersion++;
  stopViewer();
  opener?.focus({ preventScroll: true });
});
document.addEventListener('faraday:avatar3d-ready', () => {
  if (immersion) drawAvatar(immersion);
});
document.addEventListener('faraday:before-plan', event => {
  if (!dialog.open) return;
  if (run && run.index === run.scenes.length) dialog.close();
  else event.preventDefault();
});
document.addEventListener('faraday:cuenta', () => {
  if (dialog.open) load();
});
