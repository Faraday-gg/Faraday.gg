// Tarjeta para stories (decisión 0032): una imagen vertical de 1080 × 1920 con el resultado del día, sin destripar ninguna cifra real.
// app.js solo llama a window.ShareCard.open(día, respuestas, número de edición); todo lo demás vive aquí.
(() => {
  const W = 1080, H = 1920;
  const TONES = {coral:'#ff6548', mostaza:'#ffb627', verde:'#2fd67b', cian:'#3fc5f0', violeta:'#b49bff', rosa:'#ff7aa8'};
  const INK = '#202630', PAPER = '#fffdf7', NIGHT = '#23395b', CREAM = '#fff8ec';
  const GOLD = ['#ffe58a', '#ffc93d', '#e9a400'];
  const FONT = "'DM Sans', Arial, sans-serif", DISPLAY = "'Space Grotesk', Arial, sans-serif", NUM = "'Geist', 'DM Sans', Arial, sans-serif";
  const CLOSE = 1.1; // «¡Casi casi!»: a menos de 1,1× de la cifra real.

  const score = (guess, answer) => Math.max(guess / answer, answer / guess);
  const times = f => new Intl.NumberFormat('es-ES', {maximumFractionDigits: f < 10 ? 2 : f < 100 ? 1 : 0, useGrouping: 'always'}).format(f) + '×';
  const whole = n => new Intl.NumberFormat('es-ES', {maximumFractionDigits: n < 10 ? 2 : 0, useGrouping: 'always'}).format(n);
  const longDate = id => new Intl.DateTimeFormat('es-ES', {day: 'numeric', month: 'long', timeZone: 'Europe/Madrid'}).format(new Date(`${id}T12:00:00Z`));

  // Una marca por pregunta: 🎯 < 1,1× · 🟩 < 1,5× · 🟨 < 3× · 🟥 el resto.
  const markOf = f => f < CLOSE ? 'target' : f < 1.5 ? 'green' : f < 3 ? 'yellow' : 'red';
  const EMOJI = {target: '🎯', green: '🟩', yellow: '🟨', red: '🟥'};
  const MARK_LABEL = {target: 'diana', green: 'verde', yellow: 'amarillo', red: 'rojo'};

  function summarize(day, guesses) {
    const scores = day.questions.map((q, i) => score(guesses[i], q.answer));
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    const marks = scores.map(markOf);
    const golden = scores.some(s => s < CLOSE);
    // La pregunta destacada: la más cercana si alguna fue «¡Casi casi!»; si no, en la que más lejos se quedó.
    let pick = 0;
    scores.forEach((s, i) => { if (golden ? s < scores[pick] : s > scores[pick]) pick = i; });
    return {scores, average, marks, golden, pick};
  }

  function shareText(day, sum, edition) {
    return [
      `Faraday.gg · Nº ${edition} · ${day.name} ${longDate(day.id)}`,
      sum.marks.map(m => EMOJI[m]).join(''),
      `Distancia media: ${times(sum.average)}`,
      sum.golden ? '¡Casi casi! Clavé una.' : '¿Te acercas más que yo?',
      'Juega en faraday.gg'
    ].join('\n');
  }

  // ---- Dibujo ----
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function wrap(ctx, text, maxWidth, maxLines) {
    const words = String(text).split(/\s+/), lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      const cut = lines.slice(0, maxLines);
      let last = cut[maxLines - 1];
      while (ctx.measureText(last + '…').width > maxWidth && last.includes(' ')) last = last.slice(0, last.lastIndexOf(' '));
      cut[maxLines - 1] = last + '…';
      return cut;
    }
    return lines;
  }
  function fit(ctx, text, maxWidth, weight, size, family, min) {
    let s = size;
    do { ctx.font = `${weight} ${s}px ${family}`; s -= 4; } while (ctx.measureText(text).width > maxWidth && s >= min);
  }
  function drawMark(ctx, kind, x, y, size) {
    if (kind === 'target') {
      const c = size / 2;
      [[c, '#e5372b'], [c * .72, PAPER], [c * .46, '#e5372b'], [c * .2, PAPER]].forEach(([r, color]) => { ctx.beginPath(); ctx.arc(x + c, y + c, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); });
      ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(x + c, y + c, c - 3, 0, Math.PI * 2); ctx.stroke();
      return;
    }
    roundRect(ctx, x, y, size, size, 22);
    ctx.fillStyle = {green: '#2fb768', yellow: '#ffcc33', red: '#e5372b'}[kind]; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
  }
  // Iconos de categorías.js (trazos de 24 × 24) dibujados en el lienzo, sin pasar por una imagen SVG.
  function drawIcon(ctx, key, x, y, size, tone) {
    const markup = window.CATEGORIES?.[key]?.icon; if (!markup) return;
    const r = size / 2;
    ctx.save();
    ctx.fillStyle = tone; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    const k = size * .6 / 24; ctx.translate(x - 12 * k, y - 12 * k); ctx.scale(k, k);
    ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const attr = (el, name) => { const at = el.indexOf(` ${name}="`); return at < 0 ? 0 : parseFloat(el.slice(at + name.length + 3)); };
    for (const el of markup.match(/<(path|circle|rect)[^>]*>/g) || []) {
      let path;
      if (el.startsWith('<path')) path = new Path2D(el.match(/d="([^"]+)"/)[1]);
      else if (el.startsWith('<circle')) { path = new Path2D(); path.arc(attr(el, 'cx'), attr(el, 'cy'), attr(el, 'r'), 0, Math.PI * 2); }
      else { path = new Path2D(); path.roundRect(attr(el, 'x'), attr(el, 'y'), attr(el, 'width'), attr(el, 'height'), attr(el, 'rx')); }
      ctx.stroke(path);
    }
    ctx.restore();
  }
  function loadImage(src) {
    return new Promise(resolve => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Sin cabecera CORS el lienzo quedaría «manchado» y no se podría exportar: entonces va sin foto.
      img.onload = () => resolve(img); img.onerror = () => resolve(null);
      setTimeout(() => resolve(null), 6000);
      img.src = src;
    });
  }
  function drawCover(ctx, img, x, y, w, h) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight), sw = w / scale, sh = h / scale;
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  }

  async function draw(day, guesses, edition, sum, withPhoto = true) {
    await Promise.all(['400 40px DM Sans', '800 40px DM Sans', '700 40px Space Grotesk', '300 40px Geist', '400 40px Geist', '500 40px Geist']
      .map(f => document.fonts?.load(f).catch(() => null)));
    const q = day.questions[sum.pick], guess = guesses[sum.pick];
    const tone = TONES[window.CATEGORIES?.[q.category]?.tone] || TONES.coral;
    const photo = withPhoto ? await loadImage(q.image?.src) : null;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic';

    // Fondo: el color de la categoría de la pregunta, o dorado si hubo un «¡Casi casi!».
    if (sum.golden) {
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, GOLD[0]); g.addColorStop(.5, GOLD[1]); g.addColorStop(1, GOLD[2]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = PAPER;
      for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(W / 2, 330); const a = i / 14 * Math.PI * 2; ctx.arc(W / 2, 330, 1700, a, a + .11); ctx.fill(); }
      ctx.restore();
    } else { ctx.fillStyle = tone; ctx.fillRect(0, 0, W, H); }

    // Cabecera: marca, número y fecha de la jornada.
    // Instagram tapa unos 200 px arriba y abajo con su interfaz: lo importante queda dentro.
    const HY = 210;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(110, HY, 40, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = sum.golden ? GOLD[1] : tone; ctx.font = `500 56px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('≈', 110, HY + 20);
    ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = `700 54px ${DISPLAY}`; ctx.fillText('Faraday', 170, HY + 19);
    const fw = ctx.measureText('Faraday').width; ctx.fillStyle = PAPER; ctx.fillText('.', 170 + fw, HY + 19); ctx.fillStyle = INK; ctx.fillText('gg', 170 + fw + ctx.measureText('.').width, HY + 19);
    ctx.textAlign = 'right'; ctx.font = `800 30px ${FONT}`; ctx.fillText(`RETO Nº ${edition}`, W - 70, HY - 6);
    ctx.font = `600 30px ${FONT}`; ctx.fillText(`${day.name} · ${longDate(day.id)}`.toUpperCase(), W - 70, HY + 34);
    ctx.textAlign = 'left';

    let y = 290;
    if (sum.golden) {
      ctx.fillStyle = INK; roundRect(ctx, 70, y, 360, 74, 37); ctx.fill();
      ctx.fillStyle = GOLD[0]; ctx.font = `800 36px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('¡CASI CASI!', 250, y + 50); ctx.textAlign = 'left';
      y += 104;
    }

    // Tarjeta con la pregunta destacada.
    const cx = 70, cw = W - 140, pad = 56;
    const cardTop = y, cardBottom = 1330;
    ctx.save(); ctx.shadowColor = '#20263055'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
    ctx.fillStyle = PAPER; roundRect(ctx, cx, cardTop, cw, cardBottom - cardTop, 56); ctx.fill(); ctx.restore();
    ctx.lineWidth = 5; ctx.strokeStyle = INK; roundRect(ctx, cx, cardTop, cw, cardBottom - cardTop, 56); ctx.stroke();

    let ty = cardTop + pad;
    if (photo) {
      const ph = sum.golden ? 300 : 360;
      ctx.save(); roundRect(ctx, cx + 28, cardTop + 28, cw - 56, ph, 36); ctx.clip(); drawCover(ctx, photo, cx + 28, cardTop + 28, cw - 56, ph); ctx.restore();
      ty = cardTop + 28 + ph + 34;
      ctx.fillStyle = '#666a6d'; ctx.font = `500 22px ${FONT}`;
      const credit = `Foto: ${q.image.credit} · ${q.image.license}`;
      ctx.fillText(wrap(ctx, credit, cw - 2 * pad, 1)[0], cx + pad, ty); ty += 56;
    }
    const kicker = window.CATEGORIES?.[q.category]?.label || 'Pregunta';
    ctx.fillStyle = INK; ctx.font = `800 26px ${FONT}`;
    ctx.fillText(`PREGUNTA ${sum.pick + 1} · ${kicker.toUpperCase()}`, cx + pad, ty); ty += 26;
    // «Yo dije» y la cifra real tapada, abajo de la tarjeta; la pregunta, entera, en el espacio que queda encima.
    const BOX = 230, boxY = cardBottom - pad - BOX, half = (cw - 2 * pad - 24) / 2;
    // La pregunta se lee entera: la letra baja hasta que cabe (sin foto se prefiere no pasar de cuatro líneas).
    const avail = boxY - 36 - ty;
    let titleSize = photo ? 52 : 70, lines;
    for (; titleSize >= 34; titleSize -= 2) {
      ctx.font = `700 ${titleSize}px ${DISPLAY}`;
      lines = wrap(ctx, q.title, cw - 2 * pad, 99);
      if (lines.length * titleSize * 1.14 <= avail && (photo || lines.length <= 4 || titleSize <= 54)) break;
    }
    if (titleSize < 34) { titleSize = 34; ctx.font = `700 34px ${DISPLAY}`; lines = wrap(ctx, q.title, cw - 2 * pad, Math.max(1, Math.floor(avail / (34 * 1.14)))); }
    lines.forEach(line => { ty += titleSize * 1.14; ctx.fillText(line, cx + pad, ty); });

    // Sin foto, el icono de la categoría llena el hueco entre la pregunta y las cifras.
    const room = boxY - ty - 60;
    if (!photo && room > 120) drawIcon(ctx, q.category, W / 2, ty + 30 + room / 2, Math.min(room, 300), tone);
    ctx.fillStyle = '#f2ece0'; roundRect(ctx, cx + pad, boxY, half, BOX, 32); ctx.fill();
    ctx.fillStyle = '#4d5359'; ctx.font = `800 24px ${FONT}`; ctx.fillText('YO DIJE', cx + pad + 32, boxY + 54);
    ctx.fillStyle = INK; fit(ctx, whole(guess), half - 64, 400, 84, NUM, 40); ctx.fillText(whole(guess), cx + pad + 32, boxY + 146);
    ctx.fillStyle = '#4d5359'; ctx.font = `600 28px ${FONT}`; ctx.fillText(wrap(ctx, q.unit, half - 64, 1)[0], cx + pad + 32, boxY + 196);

    const rx = cx + pad + half + 24;
    ctx.save(); roundRect(ctx, rx, boxY, half, BOX, 32); ctx.clip();
    ctx.fillStyle = NIGHT; ctx.fillRect(rx, boxY, half, BOX);
    ctx.strokeStyle = '#ffffff14'; ctx.lineWidth = 18;
    for (let s = -BOX; s < half; s += 46) { ctx.beginPath(); ctx.moveTo(rx + s, boxY + BOX); ctx.lineTo(rx + s + BOX, boxY); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#fff8ecbb'; ctx.font = `800 24px ${FONT}`; ctx.fillText('LA REAL', rx + 32, boxY + 54);
    ctx.fillStyle = '#ffdb70'; ctx.font = `400 84px ${NUM}`; ctx.fillText('? ? ?', rx + 32, boxY + 146);
    ctx.fillStyle = CREAM; fit(ctx, '¿Cuántas son de verdad?', half - 64, 700, 28, FONT, 18); ctx.fillText('¿Cuántas son de verdad?', rx + 32, boxY + 196);

    // Marcas por pregunta y distancia media.
    const size = 112, gap = 32, rowW = sum.marks.length * size + (sum.marks.length - 1) * gap;
    sum.marks.forEach((m, i) => drawMark(ctx, m, (W - rowW) / 2 + i * (size + gap), 1376, size));
    ctx.textAlign = 'center'; ctx.fillStyle = INK;
    ctx.font = `800 28px ${FONT}`; ctx.fillText('DISTANCIA MEDIA', W / 2, 1546);
    ctx.font = `300 112px ${NUM}`; ctx.fillText(times(sum.average), W / 2, 1650);

    // Llamada a jugar.
    ctx.font = `800 34px ${FONT}`;
    const cta = 'Juega en faraday.gg →', ctaW = ctx.measureText(cta).width + 80;
    ctx.fillStyle = INK; roundRect(ctx, (W - ctaW) / 2, 1688, ctaW, 84, 42); ctx.fill();
    ctx.fillStyle = PAPER; ctx.fillText(cta, W / 2, 1742);
    ctx.textAlign = 'left';
    return canvas;
  }
  const toBlob = canvas => new Promise((resolve, reject) => { try { canvas.toBlob(b => b ? resolve(b) : reject(Error('toBlob')), 'image/png'); } catch (e) { reject(e); } });
  async function render(day, guesses, edition, sum) {
    try { return await toBlob(await draw(day, guesses, edition, sum, true)); }
    catch { return toBlob(await draw(day, guesses, edition, sum, false)); } // Lienzo manchado por la foto: se repite sin ella.
  }

  // ---- Vista previa ----
  let dialog, state = null;
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'share-dialog'; dialog.setAttribute('aria-labelledby', 'share-title');
    dialog.innerHTML = `<button type="button" class="share-close" aria-label="Cerrar" data-share-close>×</button>
<h2 id="share-title">Tu tarjeta del día</h2>
<p class="share-hint" id="share-hint">Súbela a tus stories: la cifra real va tapada para que nadie se la salte.</p>
<div class="share-preview" aria-busy="true"><img id="share-image" alt="" hidden><p class="share-loading" role="status">Preparando la imagen…</p></div>
<pre class="share-text" id="share-text" aria-label="Texto que se comparte"></pre>
<div class="share-actions"><button type="button" class="share-primary" id="share-go">Compartir</button><button type="button" class="share-secondary" id="share-download">Descargar</button></div>
<p class="share-status" id="share-status" role="status" aria-live="polite"></p>`;
    document.body.append(dialog);
    dialog.addEventListener('keydown', e => { if (e.key === 'Escape') e.stopPropagation(); }); // Que Escape cierre solo la vista previa, no el juego.
    dialog.addEventListener('click', e => { if (e.target === dialog || e.target.closest('[data-share-close]')) dialog.close(); });
    dialog.addEventListener('close', () => { if (state?.url) URL.revokeObjectURL(state.url); state = null; document.getElementById('share-result')?.focus(); });
    dialog.querySelector('#share-go').addEventListener('click', share);
    dialog.querySelector('#share-download').addEventListener('click', download);
    return dialog;
  }
  // El diálogo modal tapa el aviso general de la página: el mensaje se escribe dentro.
  const toast = msg => { const status = dialog?.querySelector('#share-status'); if (status && dialog.open) status.textContent = msg; else window.showToast?.(msg); };
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }
  function download() {
    if (!state?.blob) return;
    const a = document.createElement('a'); a.href = state.url; a.download = state.fileName; document.body.append(a); a.click(); a.remove();
    toast('Imagen descargada. Súbela a tus stories.');
  }
  async function share() {
    if (!state) return;
    const {blob, text, fileName} = state;
    const file = blob ? new File([blob], fileName, {type: 'image/png'}) : null;
    try {
      if (file && navigator.canShare?.({files: [file]})) { await navigator.share({files: [file], text, title: 'Mi resultado en Faraday.gg'}); return; }
      const copied = await copyText(text);
      if (blob) { download(); toast(copied ? 'Texto copiado e imagen descargada.' : 'Imagen descargada.'); }
      else toast(copied ? 'Resultado copiado al portapapeles.' : 'No se pudo compartir ahora mismo.');
    } catch (e) { if (e?.name !== 'AbortError') toast('No se pudo compartir ahora mismo.'); }
  }

  async function open(day, guesses, edition) {
    const sum = summarize(day, guesses), text = shareText(day, sum, edition), d = ensureDialog();
    const img = d.querySelector('#share-image'), loading = d.querySelector('.share-loading'), preview = d.querySelector('.share-preview');
    d.classList.toggle('is-golden', sum.golden);
    d.querySelector('#share-text').textContent = text; d.querySelector('#share-status').textContent = '';
    img.hidden = true; loading.hidden = false; loading.textContent = 'Preparando la imagen…'; preview.setAttribute('aria-busy', 'true');
    const token = state = {text, fileName: `faraday-${day.id}.png`, blob: null, url: null};
    if (!d.open) d.showModal();
    d.querySelector('#share-go').focus();
    try {
      const blob = await render(day, guesses, edition, sum);
      if (state !== token) return;
      token.blob = blob; token.url = URL.createObjectURL(blob);
      const q = day.questions[sum.pick];
      img.alt = `Tarjeta de Faraday.gg, reto Nº ${edition}. Pregunta destacada: ${q.title} Yo dije ${whole(guesses[sum.pick])} ${q.unit}; la cifra real va tapada. Marcas: ${sum.marks.map(m => MARK_LABEL[m]).join(', ')}. Distancia media ${times(sum.average)}.${sum.golden ? ' Variante dorada: ¡Casi casi!' : ''}`;
      img.src = token.url; img.hidden = false; loading.hidden = true;
    } catch {
      if (state !== token) return;
      loading.textContent = 'No se pudo preparar la imagen. Puedes compartir el texto.';
      d.querySelector('#share-download').disabled = true;
    } finally { preview.setAttribute('aria-busy', 'false'); }
    d.querySelector('#share-download').disabled = !token.blob;
  }

  window.ShareCard = {open, summarize, shareText, markOf, draw};
})();
