import { MIN_YEAR, MAX_YEAR, MAX_POINTS, scenes, scoreYear } from './archivo-vivo-rondas.js';
import { mountPanorama } from './archivo-vivo-visor.js';

const dialog = document.getElementById('archivo-vivo');
const body = document.getElementById('archivo-vivo-body');
const progress = document.getElementById('archivo-vivo-progress');
const storageKey = 'faraday.archivo-vivo.v1';
const format = new Intl.NumberFormat('es-ES');
const newRun = () => ({ index: 0, guesses: [], draft: '' });
const validYear = year => Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
const photoUrl = scene => `assets/archivo-vivo/${scene.id}-foto.jpg`;
const yearError = `Escribe un año entre ${MIN_YEAR} y ${MAX_YEAR}.`;
const expandIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/></svg>';
const panoramaIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4H4v3m13-3h3v3M4 17v3h3m13-3v3h-3"/><ellipse cx="12" cy="12" rx="7" ry="3.5"/><path d="M12 8.5c3 0 3 7 0 7s-3-7 0-7Z"/></svg>';

let run = readRun();
let opener;
let viewer;

function readRun() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved?.guesses) && saved.guesses.length <= scenes.length &&
        saved.guesses.every(validYear) && Number.isInteger(saved.index) &&
        saved.index >= 0 && saved.index <= scenes.length &&
        (saved.index === saved.guesses.length || saved.index === saved.guesses.length - 1) &&
        typeof saved.draft === 'string' && /^\d{0,4}$/.test(saved.draft)) return saved;
  } catch {
    // La partida sigue disponible durante la sesión si el navegador bloquea el almacenamiento.
  }
  return newRun();
}

function saveRun() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(run));
  } catch {}
}

function stopViewer() {
  viewer?.destroy();
  viewer = null;
  dialog.classList.remove('av-immersive');
}

function photo(scene) {
  return `<button class="av-photo" type="button" data-av="enter" aria-label="Entrar en la foto en 360 grados" aria-describedby="av-photo-description">
    <img id="av-photo-description" src="${photoUrl(scene)}" alt="${scene.alt}">
    <span class="av-enter">${panoramaIcon} Entrar en 360°</span>
  </button>
  <div class="av-stage-tools"><p>Fotografía de archivo</p></div>`;
}

function showPhoto(scene, focus = false) {
  stopViewer();
  body.querySelector('.av-stage').innerHTML = photo(scene);
  if (focus) body.querySelector('[data-av="enter"]').focus({ preventScroll: true });
}

function enterPhoto(scene) {
  const stage = body.querySelector('.av-stage');
  stage.innerHTML = `<div class="av-viewer">
    <img src="${photoUrl(scene)}" alt="${scene.alt}">
    <canvas hidden tabindex="0" aria-label="Panorama interactivo. Usa las flechas para girar y + o − para acercar o alejar."></canvas>
    <p class="av-viewer-label">${scene.type === 'archive' ? 'Panorama de archivo · 360° horizontal' : 'Recreación con IA'}</p>
    <div class="av-viewer-controls" aria-label="Controles del panorama" role="group" hidden>
      <button type="button" data-av="zoom-out" aria-label="Alejar">−</button>
      <button type="button" data-av="zoom-in" aria-label="Acercar">+</button>
      <button type="button" data-av="reset-view" aria-label="Volver al encuadre inicial">⟲</button>
      <button type="button" data-av="expand" aria-label="Vista inmersiva" aria-pressed="false">${expandIcon}</button>
    </div>
  </div>
  <div class="av-stage-tools">
    <p role="status">Cargando panorama…</p>
    <button class="av-return" type="button" data-av="leave">Volver a la foto</button>
  </div>`;
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('.av-viewer-controls');
  const image = stage.querySelector('img');
  const label = stage.querySelector('.av-viewer-label');
  const status = stage.querySelector('[role="status"]');
  const back = stage.querySelector('[data-av="leave"]');
  back.focus({ preventScroll: true });
  viewer = mountPanorama(canvas, scene, {
    ready() {
      canvas.hidden = false;
      controls.hidden = false;
      image.hidden = true;
      status.textContent = 'Arrastra para mirar alrededor.';
      if (document.activeElement === back && matchMedia('(pointer: fine)').matches) {
        canvas.focus({ preventScroll: true });
      }
    },
    unavailable() {
      const focusInViewer = canvas === document.activeElement || controls.contains(document.activeElement);
      stopViewer();
      canvas.hidden = true;
      controls.hidden = true;
      label.hidden = true;
      image.hidden = false;
      status.textContent = 'El visor 360° no está disponible. Puedes responder mirando la foto.';
      if (focusInViewer) back.focus({ preventScroll: true });
    }
  });
}

function renderRound(scene, guess) {
  progress.textContent = `Foto ${run.index + 1} de ${scenes.length}`;
  const content = guess === undefined
    ? `<h3 tabindex="-1">¿De qué año es esta foto?</h3>
       <p>Observa la imagen o entra en ella para mirar alrededor.</p>
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
       <p class="av-credit">${scene.credit} · ${scene.rights}. <a href="${scene.source}" target="_blank" rel="noopener">Ver ficha de archivo</a></p>
       <button class="av-primary" type="button" data-av="next">${run.index === scenes.length - 1 ? 'Ver resultado' : 'Siguiente foto'}</button>`;
  body.innerHTML = `<div class="av-round">
    <div class="av-stage">${photo(scene)}</div>
    <section class="av-panel">${content}</section>
  </div>`;
}

function renderSummary() {
  progress.textContent = '';
  const scores = run.guesses.map((year, index) => scoreYear(year, scenes[index].year));
  const total = format.format(scores.reduce((sum, points) => sum + points, 0));
  body.innerHTML = `<section class="av-summary">
    <h3 tabindex="-1"><span>${total}</span> de ${format.format(scenes.length * MAX_POINTS)} puntos</h3>
    <ol>${scenes.map((scene, index) => `<li>
      <img src="${photoUrl(scene)}" alt="">
      <div><a href="${scene.source}" target="_blank" rel="noopener">${scene.title}</a>
        <small>${scene.year} · Tu respuesta: ${run.guesses[index]}</small></div>
      <strong>${format.format(scores[index])} pts</strong>
    </li>`).join('')}</ol>
    <button class="av-primary" type="button" data-av="restart">Volver a jugar</button>
    <div data-plus-slot="archivo-vivo" data-compact="true"></div>
  </section>`;
}

function render(focus = false) {
  stopViewer();
  if (run.index === scenes.length) renderSummary();
  else renderRound(scenes[run.index], run.guesses[run.index]);
  dialog.scrollTop = 0;
  if (focus) body.querySelector('h3').focus({ preventScroll: true });
}

function updateDraft(input) {
  run.draft = /^\d{0,4}$/.test(input.value) ? input.value : '';
  body.querySelector('#av-year-feedback').textContent = '';
  input.removeAttribute('aria-invalid');
  saveRun();
}

window.PlusOffers?.register('archivo-vivo', {
  title: 'Descubre Faraday Plus',
  description: 'Consulta las ventajas de Faraday Plus desde tu perfil.'
});

document.querySelectorAll('[data-open-archivo-vivo]').forEach(button => button.addEventListener('click', () => {
  opener = button;
  if (window.menuOpen?.()) {
    opener = document.getElementById(document.getElementById('game-shell').hidden ? 'home-menu-toggle' : 'menu-toggle');
    window.toggleMenu(false);
  }
  render();
  dialog.showModal();
}));

dialog.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-av-close')) {
    dialog.close();
    return;
  }
  const scene = scenes[run.index];
  switch (button.dataset.av) {
    case 'enter': enterPhoto(scene); break;
    case 'leave': showPhoto(scene, true); break;
    case 'zoom-in': viewer?.magnify(1.25); break;
    case 'zoom-out': viewer?.magnify(0.8); break;
    case 'reset-view': viewer?.reset(); break;
    case 'expand':
      button.setAttribute('aria-pressed', String(dialog.classList.toggle('av-immersive')));
      break;
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
    case 'next':
      if (run.guesses.length !== run.index + 1) return;
      run.index += 1;
      saveRun();
      render(true);
      break;
    case 'restart':
      run = newRun();
      saveRun();
      render(true);
      break;
  }
});

body.addEventListener('input', event => {
  if (event.target.id === 'av-year') updateDraft(event.target);
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
  if (run.guesses.length !== run.index) return;
  run.guesses.push(input.valueAsNumber);
  run.draft = '';
  saveRun();
  render(true);
});

function backFromViewer() {
  const expand = body.querySelector('[data-av="expand"]');
  if (!expand) return false;
  if (dialog.classList.contains('av-immersive')) {
    expand.click();
  } else {
    showPhoto(scenes[run.index], true);
  }
  return true;
}

dialog.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  event.stopPropagation();
  if (!backFromViewer()) dialog.close();
});
dialog.addEventListener('cancel', event => {
  if (backFromViewer()) event.preventDefault();
});
dialog.addEventListener('close', () => {
  stopViewer();
  opener?.focus({ preventScroll: true });
});
document.addEventListener('faraday:before-plan', event => {
  if (!dialog.open) return;
  if (run.index === scenes.length) dialog.close();
  else event.preventDefault();
});
