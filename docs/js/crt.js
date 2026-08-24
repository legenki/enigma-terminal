// CRT post-processing. The terminal's 2D canvas becomes a texture that is run
// through a bright-pass, a separable Gaussian blur (the phosphor bloom) and a
// composite pass doing barrel distortion, chromatic aberration, scanlines, an
// aperture-grille mask, vignette, noise and mains flicker.
//
// If WebGL is unavailable the caller falls back to showing the 2D canvas as-is.

const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const BRIGHT_PASS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform float uThreshold;
void main() {
  vec3 colour = texture2D(uScene, vUv).rgb;
  float luma = dot(colour, vec3(0.299, 0.587, 0.114));
  float weight = smoothstep(uThreshold, uThreshold + 0.35, luma);
  gl_FragColor = vec4(colour * weight, 1.0);
}`;

const BLUR_PASS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform vec2 uDirection;   // texel-sized step along one axis
void main() {
  // 9-tap Gaussian, weights from the normalised binomial kernel.
  vec3 sum = texture2D(uScene, vUv).rgb * 0.2270270270;
  sum += texture2D(uScene, vUv + uDirection * 1.3846153846).rgb * 0.3162162162;
  sum += texture2D(uScene, vUv - uDirection * 1.3846153846).rgb * 0.3162162162;
  sum += texture2D(uScene, vUv + uDirection * 3.2307692308).rgb * 0.0702702703;
  sum += texture2D(uScene, vUv - uDirection * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(sum, 1.0);
}`;

const COMPOSITE_PASS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2 uResolution;
uniform float uTime;
uniform float uCurvature;
uniform float uScanline;
uniform float uAberration;
uniform float uNoise;
uniform float uFlicker;
uniform float uBloomAmount;
uniform float uMask;

vec2 curve(vec2 uv) {
  uv = uv * 2.0 - 1.0;
  vec2 offset = abs(uv.yx) / vec2(6.0 / uCurvature, 5.0 / uCurvature);
  uv += uv * offset * offset;
  return uv * 0.5 + 0.5;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = curve(vUv);

  // Everything outside the tube face is bezel, not picture.
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.008, 0.004, 1.0);
    return;
  }

  float shift = uAberration / uResolution.x;
  vec3 colour;
  colour.r = texture2D(uScene, uv + vec2(shift, 0.0)).r;
  colour.g = texture2D(uScene, uv).g;
  colour.b = texture2D(uScene, uv - vec2(shift, 0.0)).b;

  colour += texture2D(uBloom, uv).rgb * uBloomAmount;

  // Scanlines: one dark band per physical pixel row of the source grid.
  float scan = sin(uv.y * uResolution.y * 3.14159265) * 0.5 + 0.5;
  colour *= 1.0 - uScanline * scan;

  // Aperture grille: RGB stripes every three device pixels.
  float stripe = mod(gl_FragCoord.x, 3.0);
  vec3 mask = vec3(1.0 - uMask);
  if (stripe < 1.0) mask.r = 1.0 + uMask;
  else if (stripe < 2.0) mask.g = 1.0 + uMask;
  else mask.b = 1.0 + uMask;
  colour *= mask;

  // A slow bright band drifting up the tube, like an unsynced refresh.
  float roll = fract(uv.y + uTime * 0.06);
  colour *= 1.0 + 0.045 * smoothstep(0.96, 1.0, roll);

  colour *= 1.0 - uFlicker * (0.5 + 0.5 * sin(uTime * 47.0));
  colour += (hash(uv * uResolution + uTime) - 0.5) * uNoise;

  float vignette = 16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
  colour *= pow(clamp(vignette, 0.0, 1.0), 0.22);

  gl_FragColor = vec4(colour, 1.0);
}`;

const DEFAULTS = {
  curvature: 1.0,
  scanline: 0.22,
  aberration: 1.6,
  noise: 0.05,
  flicker: 0.012,
  bloomAmount: 0.85,
  bloomThreshold: 0.25,
  mask: 0.09,
};

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${log}`);
  }
  return shader;
}

function program(gl, fragmentSource) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(prog)}`);
  }
  const uniforms = {};
  const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const name = gl.getActiveUniform(prog, i).name;
    uniforms[name] = gl.getUniformLocation(prog, name);
  }
  return { prog, uniforms };
}

function createTarget(gl, width, height) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture, framebuffer, width, height };
}

export class CrtRenderer {
  /**
   * @param {HTMLCanvasElement} canvas   the visible WebGL canvas
   * @param {HTMLCanvasElement} source   the terminal's 2D canvas
   */
  constructor(canvas, source, settings = {}) {
    this.canvas = canvas;
    this.source = source;
    this.settings = { ...DEFAULTS, ...settings };
    this.enabled = true;

    const attributes = { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: false };
    const gl = canvas.getContext('webgl', attributes) || canvas.getContext('experimental-webgl', attributes);
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;

    this.bright = program(gl, BRIGHT_PASS);
    this.blur = program(gl, BLUR_PASS);
    this.composite = program(gl, COMPOSITE_PASS);

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    this.sceneTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.resize();
  }

  resize() {
    const gl = this.gl;
    this.canvas.width = this.source.width;
    this.canvas.height = this.source.height;
    const half = [
      Math.max(1, this.canvas.width >> 1),
      Math.max(1, this.canvas.height >> 1),
    ];
    for (const target of [this.targetA, this.targetB]) {
      if (target) {
        gl.deleteTexture(target.texture);
        gl.deleteFramebuffer(target.framebuffer);
      }
    }
    this.targetA = createTarget(gl, half[0], half[1]);
    this.targetB = createTarget(gl, half[0], half[1]);
  }

  drawQuad(programInfo) {
    const gl = this.gl;
    gl.useProgram(programInfo.prog);
    const location = gl.getAttribLocation(programInfo.prog, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  bindTarget(target) {
    const gl = this.gl;
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, target.width, target.height);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  render(timeSeconds) {
    const gl = this.gl;
    const { settings } = this;

    gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.source);

    // 1. bright pass into half-resolution target A
    this.bindTarget(this.targetA);
    gl.useProgram(this.bright.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
    gl.uniform1i(this.bright.uniforms.uScene, 0);
    gl.uniform1f(this.bright.uniforms.uThreshold, settings.bloomThreshold);
    this.drawQuad(this.bright);

    // 2. horizontal blur A -> B, 3. vertical blur B -> A
    const passes = [
      [this.targetA, this.targetB, [1 / this.targetA.width, 0]],
      [this.targetB, this.targetA, [0, 1 / this.targetA.height]],
    ];
    for (const [from, to, direction] of passes) {
      this.bindTarget(to);
      gl.useProgram(this.blur.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, from.texture);
      gl.uniform1i(this.blur.uniforms.uScene, 0);
      gl.uniform2f(this.blur.uniforms.uDirection, direction[0], direction[1]);
      this.drawQuad(this.blur);
    }

    // 4. composite to the screen
    this.bindTarget(null);
    gl.useProgram(this.composite.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
    gl.uniform1i(this.composite.uniforms.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.targetA.texture);
    gl.uniform1i(this.composite.uniforms.uBloom, 1);
    gl.uniform2f(this.composite.uniforms.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.composite.uniforms.uTime, timeSeconds);
    gl.uniform1f(this.composite.uniforms.uCurvature, settings.curvature);
    gl.uniform1f(this.composite.uniforms.uScanline, settings.scanline);
    gl.uniform1f(this.composite.uniforms.uAberration, settings.aberration);
    gl.uniform1f(this.composite.uniforms.uNoise, settings.noise);
    gl.uniform1f(this.composite.uniforms.uFlicker, settings.flicker);
    gl.uniform1f(this.composite.uniforms.uBloomAmount, settings.bloomAmount);
    gl.uniform1f(this.composite.uniforms.uMask, settings.mask);
    this.drawQuad(this.composite);
  }

  /** Cycle through the visual presets offered by the CRT command. */
  applyPreset(name) {
    const presets = {
      full: DEFAULTS,
      soft: { ...DEFAULTS, curvature: 0.5, scanline: 0.12, noise: 0.02, bloomAmount: 0.6, aberration: 0.8 },
      flat: { ...DEFAULTS, curvature: 0.0001, scanline: 0.08, noise: 0.015, aberration: 0.4, mask: 0.03 },
      off: null,
    };
    if (!(name in presets)) return false;
    if (presets[name] === null) {
      this.enabled = false;
    } else {
      this.enabled = true;
      this.settings = { ...presets[name] };
    }
    return true;
  }
}
