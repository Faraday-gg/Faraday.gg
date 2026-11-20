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
const float PI = 3.14159265;

void main() {
  vec3 ray = normalize(vec3(screenPoint * field, 1.0));
  vec3 direction = vec3(ray.x, ray.y * cameraPitch.x + ray.z * cameraPitch.y,
                       ray.z * cameraPitch.x - ray.y * cameraPitch.y);
  float u = fract(0.5 + (atan(direction.x, direction.z) + yaw) / (2.0 * PI));
  float v = 0.5 - asin(direction.y) / heightSpan;
  if (v < 0.0 || v > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    gl_FragColor = texture2D(panorama, vec2(u, v));
  }
}`;

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function mountPanorama(canvas, scene, { ready, unavailable }) {
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
  const uniforms = Object.fromEntries(['field', 'cameraPitch', 'yaw', 'heightSpan']
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
  const pitchLimit = archival ? 0.20 : 1.46;
  const baseField = archival ? 0.65 : 1.18;
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
    gl.uniform2f(uniforms.field, baseField * Math.min(1, aspect) / zoom, baseField * Math.min(1, 1 / aspect) / zoom);
    gl.uniform2f(uniforms.cameraPitch, Math.cos(pitch), Math.sin(pitch));
    gl.uniform1f(uniforms.yaw, yaw);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function requestDraw() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function move(horizontal, vertical) {
    yaw = (yaw + horizontal) % TAU;
    pitch = clamp(pitch + vertical, -pitchLimit, pitchLimit);
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
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
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
