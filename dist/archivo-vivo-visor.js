const VERTEX = `
attribute vec2 vertex;
varying vec2 screenPoint;
void main() {
  screenPoint = vertex;
  gl_Position = vec4(vertex, 0.0, 1.0);
}`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 screenPoint;
uniform sampler2D panorama;
uniform vec2 field;
uniform vec2 cameraPitch;
uniform float yaw;
uniform float heightSpan;
uniform float horizon;
uniform float seamWidth;
const float PI = 3.14159265;

void main() {
  vec3 ray = normalize(vec3(screenPoint * field, 1.0));
  vec3 direction = vec3(ray.x, ray.y * cameraPitch.x + ray.z * cameraPitch.y,
                       ray.z * cameraPitch.x - ray.y * cameraPitch.y);
  float u = fract(0.5 + (atan(direction.x, direction.z) + yaw) / (2.0 * PI));
  float elevation = asin(direction.y);
  // Ancla el horizonte de la textura sin perder ni el cenit ni el suelo.
  float hemisphere = elevation >= 0.0 ? horizon : 1.0 - horizon;
  float v = horizon - 2.0 * elevation * hemisphere / heightSpan;
  if (v < 0.0 || v > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    float offset = u < 0.5 ? u : u - 1.0;
    if (abs(offset) < seamWidth) {
      // Suaviza únicamente la unión trasera de las recreaciones. El original de archivo se muestra entero.
      vec4 end = texture2D(panorama, vec2(1.0 - abs(offset), v));
      vec4 start = texture2D(panorama, vec2(abs(offset), v));
      gl_FragColor = mix(end, start, smoothstep(-seamWidth, seamWidth, offset));
    } else {
      gl_FragColor = texture2D(panorama, vec2(u, v));
    }
  }
}`;

const TAU = Math.PI * 2;
const PITCH_LIMIT = 1.46;
const ARCHIVE_PITCH_LIMIT = 0.20;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function photographPitch(scene, pitch) {
  if (scene.type !== 'archive') return pitch;
  const archiveLimit = scene.archivePitchLimit ?? ARCHIVE_PITCH_LIMIT;
  if (pitch >= scene.pitch) return Math.min(pitch, archiveLimit);
  // La toma histórica limita la vista a la altura de sus placas.
  const progress = (scene.pitch - pitch) / (scene.pitch + PITCH_LIMIT);
  return Math.max(-archiveLimit, scene.pitch - progress * (scene.pitch + archiveLimit));
}

export function mountPanorama(canvas, scene, { ready, unavailable, onView }) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
  if (!gl) {
    unavailable();
    return null;
  }

  const program = gl.createProgram();
  const shaders = [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]];
  for (const [type, source] of shaders) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    unavailable();
    return null;
  }

  gl.useProgram(program);
  const vertex = gl.getAttribLocation(program, 'vertex');
  const uniforms = Object.fromEntries(['field', 'cameraPitch', 'yaw', 'heightSpan', 'horizon', 'seamWidth']
    .map(name => [name, gl.getUniformLocation(program, name)]));
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(vertex);
  gl.vertexAttribPointer(vertex, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const archival = scene.type === 'archive';
  const upperPitchLimit = archival ? (scene.archivePitchLimit ?? ARCHIVE_PITCH_LIMIT) : PITCH_LIMIT;
  const baseField = archival ? 0.65 : 1.18;
  gl.uniform1f(uniforms.horizon, scene.ground?.horizon ?? 0.5);
  gl.uniform1f(uniforms.seamWidth, archival ? 0 : 0.012);
  let yaw = scene.yaw;
  let pitch = scene.pitch;
  let zoom = 1;
  let pointer = null;
  let frame = 0;
  let loaded = false;
  const image = new Image();

  function draw() {
    frame = 0;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!loaded || !width || !height) return;
    const scale = Math.min(window.devicePixelRatio || 1, 1.6, 1700 / Math.max(width, height));
    const pixelsWide = Math.round(width * scale);
    const pixelsHigh = Math.round(height * scale);
    if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
      canvas.width = pixelsWide;
      canvas.height = pixelsHigh;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    const aspect = width / height;
    // Las placas históricas pueden limitar la apertura vertical sin estrechar el recorrido horizontal en escritorio.
    const fieldX = Math.min(baseField * Math.min(1, aspect), (scene.archiveField ?? Infinity) * aspect);
    const fieldY = fieldX / aspect / zoom;
    gl.uniform2f(uniforms.field, fieldX / zoom, fieldY);
    const backgroundPitch = photographPitch(scene, pitch);
    gl.uniform2f(uniforms.cameraPitch, Math.cos(backgroundPitch), Math.sin(backgroundPitch));
    gl.uniform1f(uniforms.yaw, yaw);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    onView?.({ pitch: backgroundPitch, field: fieldY, width, height });
  }

  function requestDraw() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function move(horizontal, vertical) {
    yaw = (yaw + horizontal) % TAU;
    pitch = clamp(pitch + vertical, -PITCH_LIMIT, upperPitchLimit);
    requestDraw();
  }

  function magnify(factor) {
    zoom = clamp(zoom * factor, 0.8, 3);
    requestDraw();
  }

  function reset() {
    yaw = scene.yaw;
    pitch = scene.pitch;
    zoom = 1;
    requestDraw();
  }

  const resize = new ResizeObserver(requestDraw);
  resize.observe(canvas);
  canvas.addEventListener('pointerdown', event => {
    if (pointer || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(pointer.id);
  }, options);
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer?.id) return;
    const speed = 2.5 / Math.max(canvas.clientWidth, canvas.clientHeight) / zoom;
    move((pointer.x - event.clientX) * speed, (event.clientY - pointer.y) * speed);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  }, options);
  canvas.addEventListener('lostpointercapture', () => { pointer = null; }, options);
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    magnify(event.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { ...options, passive: false });
  canvas.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') move(-0.12, 0);
    else if (event.key === 'ArrowRight') move(0.12, 0);
    else if (event.key === 'ArrowUp') move(0, 0.08);
    else if (event.key === 'ArrowDown') move(0, -0.08);
    else if (event.key === '+' || event.key === '=') magnify(1.25);
    else if (event.key === '-') magnify(0.8);
    else if (event.key === 'Home') reset();
    else return;
    event.preventDefault();
  }, options);
  canvas.addEventListener('webglcontextlost', unavailable, options);
  image.addEventListener('error', unavailable, options);
  image.addEventListener('load', () => {
    try {
      let textureSource = image;
      const scale = gl.getParameter(gl.MAX_TEXTURE_SIZE) / Math.max(image.width, image.height);
      if (scale < 1) {
        textureSource = document.createElement('canvas');
        textureSource.width = Math.max(1, Math.round(image.width * scale));
        textureSource.height = Math.max(1, Math.round(image.height * scale));
        textureSource.getContext('2d').drawImage(image, 0, 0, textureSource.width, textureSource.height);
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureSource);
      if (gl.getError() !== gl.NO_ERROR) {
        unavailable();
        return;
      }
    } catch {
      unavailable();
      return;
    }
    gl.uniform1f(uniforms.heightSpan, archival ? TAU * image.height / image.width : Math.PI);
    loaded = true;
    ready();
    requestDraw();
  }, options);
  image.src = `assets/archivo-vivo/${scene.id}-escena.jpg`;

  return {
    magnify,
    reset,
    lookAtFeet() {
      pitch = -1.34;
      zoom = 1;
      requestDraw();
    },
    destroy() {
      listeners.abort();
      resize.disconnect();
      cancelAnimationFrame(frame);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
}
