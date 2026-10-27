// Tiditalk — effetto viso 3D "cuffia_nuoto" (premium6). Codice originale, AGPL-3.0. GENERATO da _src/fx/cuffia_nuoto.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

// lib/head.js
var HULL = { c: [0, 2.4, -4], r: [8.1, 11.6, 9.9] };
var clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
var smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
function hullAt(theta, phi, off, P, N) {
  const c = HULL.c, r = HULL.r;
  const sx = Math.sin(theta) * Math.sin(phi), sy = Math.cos(theta), sz = Math.sin(theta) * Math.cos(phi);
  N.set(sx / r[0], sy / r[1], sz / r[2]).normalize();
  P.set(c[0] + r[0] * sx, c[1] + r[1] * sy, c[2] + r[2] * sz);
  if (off) P.addScaledVector(N, off);
  return P;
}
function thetaAtY(y) {
  return Math.acos(clamp((y - HULL.c[1]) / HULL.r[1], -1, 1));
}
function bandRing(THREE, { yF = 8.6, yB = 4.4, gap = () => 0.6, lift = null, n = 96 } = {}) {
  const V = THREE.Vector3;
  const F = hullAt(thetaAtY(yF), 0, 0, new V(), new V());
  const B = hullAt(thetaAtY(yB), Math.PI, 0, new V(), new V());
  const d = new V().subVectors(B, F);
  const axis = new V(0, -d.z, d.y).normalize();
  if (axis.y < 0) axis.negate();
  const P = [], N = [], T = [], PH = [], G = [];
  const p = new V(), nn = new V();
  for (let i = 0; i <= n; i++) {
    const phi = i / n * Math.PI * 2;
    const off = lift ? lift(phi) : 0;
    let a = 0.02, b = Math.PI - 0.02;
    for (let k = 0; k < 40; k++) {
      const m = (a + b) / 2;
      hullAt(m, phi, 0, p, nn);
      const g2 = axis.dot(p.clone().sub(F)) - off;
      if (g2 > 0) a = m;
      else b = m;
    }
    const th = (a + b) / 2;
    hullAt(th, phi, 0, p, nn);
    const gp = gap(phi);
    P.push(p.clone().addScaledVector(nn, gp));
    N.push(nn.clone());
    T.push(th);
    PH.push(phi);
    G.push(gp);
  }
  const C = new V();
  for (let i = 0; i < n; i++) C.add(P[i]);
  C.divideScalar(n);
  const fwd = new V(0, 0, 1).projectOnPlane(axis).normalize();
  const side = new V().crossVectors(axis, fwd).normalize();
  return { n, P, N, T, G, phi: PH, axis, C, fwd, side, F, B };
}
function grid(THREE, nu, nv, fn, { uRep = 1, vRep = 1, colors = null, pole0 = false, pole1 = false, flip = false } = {}) {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3), uv = new Float32Array((nu + 1) * (nv + 1) * 2);
  const col = colors ? new Float32Array((nu + 1) * (nv + 1) * 3) : null;
  const P = new THREE.Vector3(), C = new THREE.Color();
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const k = j * (nu + 1) + i;
    fn(i % nu === 0 && i ? 0 : i, j, P);
    pos[k * 3] = P.x;
    pos[k * 3 + 1] = P.y;
    pos[k * 3 + 2] = P.z;
    uv[k * 2] = i / nu * uRep;
    uv[k * 2 + 1] = j / nv * vRep;
    if (col) {
      colors(i % nu, j, C);
      col[k * 3] = C.r;
      col[k * 3 + 1] = C.g;
      col[k * 3 + 2] = C.b;
    }
  }
  const idx = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    if (flip) idx.push(a, b, c, b, d, c);
    else idx.push(a, c, b, b, c, d);
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g2.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  if (col) g2.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g2.setIndex(idx);
  g2.computeVertexNormals();
  const n = g2.attributes.normal.array;
  for (let j = 0; j <= nv; j++) {
    const a = j * (nu + 1), b = a + nu;
    for (let c = 0; c < 3; c++) {
      const m = (n[a * 3 + c] + n[b * 3 + c]) / 2;
      n[a * 3 + c] = n[b * 3 + c] = m;
    }
    const L = Math.hypot(n[a * 3], n[a * 3 + 1], n[a * 3 + 2]) || 1;
    for (let c = 0; c < 3; c++) {
      n[a * 3 + c] /= L;
      n[b * 3 + c] /= L;
    }
  }
  for (const [on, j] of [[pole0, 0], [pole1, nv]]) {
    if (!on) continue;
    let x = 0, y = 0, z = 0;
    for (let i = 0; i <= nu; i++) {
      const k = (j * (nu + 1) + i) * 3;
      x += n[k];
      y += n[k + 1];
      z += n[k + 2];
    }
    const L = Math.hypot(x, y, z) || 1;
    for (let i = 0; i <= nu; i++) {
      const k = (j * (nu + 1) + i) * 3;
      n[k] = x / L;
      n[k + 1] = y / L;
      n[k + 2] = z / L;
    }
  }
  return g2;
}

// lib/core.js
var clamp2 = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
var TAU = Math.PI * 2;
function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s = s * 1664525 + 1013904223 >>> 0;
    return s / 4294967296;
  };
}
var Ticker = class {
  constructor() {
    this.t = null;
    this.dt = 1 / 30;
    this.n = 0;
  }
  tick(t) {
    if (this.t == null || !isFinite(t)) {
      this.t = t;
      this.dt = 1 / 30;
      this.n++;
      return this.dt;
    }
    let dt = t - this.t;
    this.t = t;
    if (!(dt > 0)) dt = 0;
    else if (dt > 0.1) dt = 0.1;
    this.dt = dt;
    this.n++;
    return dt;
  }
};
var HeadFrame = class {
  constructor(THREE, g2) {
    this.g = g2;
    this.M = new THREE.Matrix4();
    this.Mi = new THREE.Matrix4();
    this.p = new THREE.Vector3();
    this.q = new THREE.Quaternion();
    this.qi = new THREE.Quaternion();
    this.s = new THREE.Vector3(1, 1, 1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.down = new THREE.Vector3(0, -1, 0);
    this.vel = new THREE.Vector3();
    this._pp = new THREE.Vector3();
    this._has = false;
    this._v = new THREE.Vector3();
    this.attached = false;
  }
  update(dt) {
    const g2 = this.g, P = g2.parent;
    if (P) {
      if (P.matrixAutoUpdate) P.updateMatrix();
      this.M.copy(P.matrix);
      if (P.parent && P.parent.matrixWorld) this.M.premultiply(P.parent.matrixWorld);
      this.attached = true;
    } else {
      this.M.identity();
      this.attached = false;
    }
    if (g2.matrixAutoUpdate) g2.updateMatrix();
    this.M.multiply(g2.matrix);
    this.Mi.copy(this.M).invert();
    this.M.decompose(this.p, this.q, this.s);
    this.qi.copy(this.q).invert();
    this.up.set(0, 1, 0).applyQuaternion(this.qi);
    this.down.copy(this.up).negate();
    if (this._has && dt > 0) {
      this._v.subVectors(this.p, this._pp).divideScalar(dt);
      this.vel.lerp(this._v, 0.5);
    }
    this._pp.copy(this.p);
    this._has = true;
  }
  toWorld(v, out) {
    return out.copy(v).applyMatrix4(this.M);
  }
  toLocal(v, out) {
    return out.copy(v).applyMatrix4(this.Mi);
  }
  dirToWorld(v, out) {
    return out.copy(v).applyQuaternion(this.q);
  }
  dirToLocal(v, out) {
    return out.copy(v).applyQuaternion(this.qi);
  }
};
function worldRoot(THREE, g2, frame) {
  const r = new THREE.Group();
  r.matrixAutoUpdate = false;
  r.userData.sync = () => {
    r.matrix.copy(frame.Mi);
    r.matrixWorldNeedsUpdate = true;
  };
  g2.add(r);
  return r;
}

// lib/tex.js
function canvas(w, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function texFrom(THREE, c, { srgb = true, repeat = null, wrap = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  return t;
}
function valueNoise(seed = 1, per = 16) {
  const r = rng(seed), N = per, tab = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) tab[i] = r();
  const at = (x, y) => tab[(y % N + N) % N * N + (x % N + N) % N];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function normalFromHeight(THREE, H, w, h, strength = 2, repeat = null) {
  const c = canvas(w, h), x = c.getContext("2d"), img = x.createImageData(w, h), d = img.data;
  const at = (i, j) => H[(j + h) % h * w + (i + w) % w];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = (at(i + 1, j) - at(i - 1, j)) * strength, dy = (at(i, j + 1) - at(i, j - 1)) * strength;
    let nx = -dx, ny = dy, nz = 1;
    const L = Math.hypot(nx, ny, nz);
    nx /= L;
    ny /= L;
    nz /= L;
    const k = (j * w + i) * 4;
    d[k] = (nx * 0.5 + 0.5) * 255;
    d[k + 1] = (ny * 0.5 + 0.5) * 255;
    d[k + 2] = (nz * 0.5 + 0.5) * 255;
    d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return texFrom(THREE, c, { srgb: false, repeat });
}
function heightField(w, h, fn) {
  const H = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) H[j * w + i] = fn(i / w, j / h);
  return H;
}

// lib/mats.js
function mirrorLens(THREE, { top = "#2c4e8a", hor = "#f2a35e", low = "#3a2a2a", tint = "#2a2f36", sun = 1, opacity = 0.97, rim = 0.35, sharp = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(top) }, uHor: { value: new THREE.Color(hor) }, uLow: { value: new THREE.Color(low) }, uTint: { value: new THREE.Color(tint) }, uSun: { value: sun }, uOp: { value: opacity }, uRim: { value: rim }, uShift: { value: 0 }, uSharp: { value: sharp } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uTop, uHor, uLow, uTint; uniform float uSun, uOp, uRim, uShift, uSharp; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main(){
        vec3 N = normalize(vN); vec3 V = normalize(vV); if (dot(N, V) < 0.0) N = -N;
        vec3 R = reflect(-V, N);
        float y = R.y + uShift;
        vec3 env = y > 0.0 ? mix(uHor, uTop, smoothstep(0.0, 0.75, y)) : mix(uHor, uLow, smoothstep(0.0, mix(0.35, 0.04, uSharp), -y));
        // paesaggio riflesso (uSharp): orizzonte netto, colline scure e qualche nuvola chiara
        float hill = 0.05 * sin(R.x * 9.0) + 0.03 * sin(R.x * 23.0 + 1.0);
        env = mix(env, uLow * 0.8, uSharp * smoothstep(0.012, 0.0, y - hill - 0.02) * step(-0.25, y));
        float cl = smoothstep(0.55, 0.8, sin(R.x * 6.0 + y * 3.0) * 0.5 + 0.5) * smoothstep(0.1, 0.3, y) * (1.0 - smoothstep(0.5, 0.8, y));
        env = mix(env, vec3(0.95), uSharp * cl * 0.55);
        float sun = pow(max(dot(R, normalize(vec3(0.35, 0.55, 0.75))), 0.0), 90.0) * 3.0 + pow(max(dot(R, normalize(vec3(-0.4, 0.3, 0.8))), 0.0), 24.0) * 0.35;
        float fr = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
        vec3 col = mix(uTint, env, 0.62 + 0.3 * fr) + sun * uSun;
        gl_FragColor = vec4(col, clamp(uOp + fr * uRim, 0.0, 1.0));
        #include <colorspace_fragment>
      }`,
    transparent: true
  });
}

// lib/expr.js
var g = (b, k) => {
  const v = b ? b[k] : 0;
  return typeof v === "number" && v === v ? v : 0;
};
var avg = (b, a, c) => (g(b, a) + g(b, c)) / 2;
var smileOf = (b) => b && typeof b.smile === "number" ? b.smile : avg(b, "mouthSmileLeft", "mouthSmileRight");
var CHANNELS = {
  smile: (b) => smileOf(b),
  jaw: (b) => g(b, "jawOpen"),
  // labbra a "o" / bacio / guance gonfie (soffiare): il più forte dei tre
  pucker: (b) => Math.max(g(b, "mouthPucker"), g(b, "mouthFunnel"), g(b, "cheekPuff")),
  browUp: (b) => Math.max(g(b, "browInnerUp"), avg(b, "browOuterUpLeft", "browOuterUpRight")),
  browDown: (b) => avg(b, "browDownLeft", "browDownRight"),
  wide: (b) => avg(b, "eyeWideLeft", "eyeWideRight"),
  eyesClosed: (b) => b && typeof b.blink === "number" ? b.blink : avg(b, "eyeBlinkLeft", "eyeBlinkRight"),
  // broncio: angoli giù o labbro inferiore in fuori; un sorriso lo annulla
  // fronte aggrottata o angoli della bocca giù (niente labbro in fuori: con la barba sale da solo)
  frown: (b) => Math.max(avg(b, "browDownLeft", "browDownRight"), avg(b, "mouthFrownLeft", "mouthFrownRight")) * (1 - 0.8 * clamp2(smileOf(b) * 1.5)),
  pout: (b) => Math.max(avg(b, "mouthFrownLeft", "mouthFrownRight"), g(b, "mouthShrugLower") * 0.85, g(b, "mouthRollLower") * 0.6) * (1 - 0.8 * clamp2(smileOf(b) * 1.5))
};
var Expr = class {
  constructor(names = Object.keys(CHANNELS)) {
    this.names = names;
    this.v = {};
    this.raw = {};
    this.ready = true;
    this.gate = 1;
    this._first = true;
    for (const n of names) {
      this.v[n] = 0;
      this.raw[n] = 0;
    }
  }
  // bs: espressioni calibrate del motore; h: helper del motore (h.calib = { ready, progress })
  update(bs, dt, h) {
    const c = h && h.calib;
    const target = !c || c.ready ? 1 : clamp2((c.progress - 0.5) * 2);
    if (this._first) {
      this.gate = target;
      this._first = false;
    } else this.gate += (target - this.gate) * Math.min(1, dt * 4);
    if (target === 1 && this.gate > 0.995) this.gate = 1;
    this.ready = this.gate > 0.98;
    for (let i = 0; i < this.names.length; i++) {
      const n = this.names[i], x = clamp2(CHANNELS[n](bs));
      this.raw[n] = x;
      this.v[n] = x * this.gate;
    }
    return this.v;
  }
};
var Trigger = class {
  constructor({ on = 0.55, off = 0.3, hold = 0, cooldown = 0.8 } = {}) {
    Object.assign(this, { on, off, hold, cooldown });
    this.active = false;
    this.above = 0;
    this.cool = 0;
    this.fired = false;
    this.released = false;
    this.since = 0;
  }
  update(v, dt) {
    this.fired = false;
    this.released = false;
    this.cool -= dt;
    if (!this.active) {
      if (v >= this.on) {
        this.above += dt;
        if (this.above >= this.hold && this.cool <= 0) {
          this.active = true;
          this.fired = true;
          this.cool = this.cooldown;
          this.since = 0;
        }
      } else this.above = 0;
    } else {
      this.since += dt;
      if (v <= this.off) {
        this.active = false;
        this.above = 0;
        this.released = true;
      }
    }
    return this.fired;
  }
};

// lib/fx.js
var SPR_VS = (
  /* glsl */
  `
attribute vec3 iPos; attribute vec4 iCol; attribute vec4 iSR; attribute vec3 iVel;
uniform float uGrid;
varying vec2 vUv; varying vec4 vCol;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float rot = iSR.y;
  if (iSR.w > 1.01) {                      // allungato lungo la velocit\xE0 (pioggia, scintille)
    vec2 vv = (modelViewMatrix * vec4(iVel, 0.0)).xy;
    if (dot(vv, vv) > 1e-6) rot = atan(vv.y, vv.x) - 1.5707963;
  }
  float c = cos(rot), s = sin(rot);
  vec2 q = position.xy * vec2(iSR.x, iSR.x * max(iSR.w, 0.05));
  mv.xy += vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  gl_Position = projectionMatrix * mv;
  float cx = mod(iSR.z, uGrid), cy = floor(iSR.z / uGrid);
  vUv = (uv + vec2(cx, uGrid - 1.0 - cy)) / uGrid;
  vCol = iCol;
}`
);
var SPR_FS = (
  /* glsl */
  `
uniform sampler2D uMap;
varying vec2 vUv; varying vec4 vCol;
void main() {
  vec4 t = texture2D(uMap, vUv);
  gl_FragColor = vec4(t.rgb * vCol.rgb, t.a * vCol.a);
  if (gl_FragColor.a < 0.002) discard;
  #include <colorspace_fragment>
}`
);
var Sprites = class {
  constructor(THREE, { max = 200, atlas, blend = "add", renderOrder = 3, depthTest = true } = {}) {
    this.max = max;
    this.n = 0;
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.attributes.position);
    geo.setAttribute("uv", base.attributes.uv);
    const D = THREE.DynamicDrawUsage;
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(D);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(D);
    this.aSR = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(D);
    this.aVel = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(D);
    geo.setAttribute("iPos", this.aPos);
    geo.setAttribute("iCol", this.aCol);
    geo.setAttribute("iSR", this.aSR);
    geo.setAttribute("iVel", this.aVel);
    geo.instanceCount = 0;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: atlas.tex }, uGrid: { value: atlas.grid } },
      vertexShader: SPR_VS,
      fragmentShader: SPR_FS,
      transparent: true,
      depthWrite: false,
      depthTest,
      blending: blend === "add" ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.mat.atlasTex = atlas.tex;
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    const F = (k) => new Float32Array(max * k);
    this.p = F(3);
    this.v = F(3);
    this.c0 = F(4);
    this.c1 = F(3);
    this.age = F(1);
    this.life = F(1);
    this.s0 = F(1);
    this.s1 = F(1);
    this.rot = F(1);
    this.spin = F(1);
    this.cell = F(1);
    this.drag = F(1);
    this.grav = F(1);
    this.fi = F(1);
    this.fo = F(1);
    this.asp = F(1);
    this.wob = F(1);
    this.wf = F(1);
    this.ph = F(1);
    this.flk = F(1);
    this._v3 = [this.p, this.v, this.c1];
    this._s1 = [this.age, this.life, this.s0, this.s1, this.rot, this.spin, this.cell, this.drag, this.grav, this.fi, this.fo, this.asp, this.wob, this.wf, this.ph, this.flk];
  }
  get count() {
    return this.n;
  }
  clear() {
    this.n = 0;
    this.geo.instanceCount = 0;
  }
  // o: { x,y,z, vx,vy,vz, life, size, size1, r,g,b,a, r1,g1,b1, rot, spin, cell, drag, grav, fadeIn, fadeOut, aspect, wob, wf, flicker }
  spawn(o) {
    if (this.n >= this.max) return -1;
    const i = this.n++;
    const i3 = i * 3, i4 = i * 4;
    this.p[i3] = o.x || 0;
    this.p[i3 + 1] = o.y || 0;
    this.p[i3 + 2] = o.z || 0;
    this.v[i3] = o.vx || 0;
    this.v[i3 + 1] = o.vy || 0;
    this.v[i3 + 2] = o.vz || 0;
    const r = o.r ?? 1, g2 = o.g ?? 1, b = o.b ?? 1;
    this.c0[i4] = r;
    this.c0[i4 + 1] = g2;
    this.c0[i4 + 2] = b;
    this.c0[i4 + 3] = o.a ?? 1;
    this.c1[i3] = o.r1 ?? r;
    this.c1[i3 + 1] = o.g1 ?? g2;
    this.c1[i3 + 2] = o.b1 ?? b;
    this.age[i] = 0;
    this.life[i] = o.life || 1;
    this.s0[i] = o.size || 1;
    this.s1[i] = o.size1 ?? this.s0[i];
    this.rot[i] = o.rot || 0;
    this.spin[i] = o.spin || 0;
    this.cell[i] = o.cell || 0;
    this.drag[i] = o.drag || 0;
    this.grav[i] = o.grav || 0;
    this.fi[i] = o.fadeIn ?? 0.1;
    this.fo[i] = o.fadeOut ?? 0.4;
    this.asp[i] = o.aspect || 1;
    this.wob[i] = o.wob || 0;
    this.wf[i] = o.wf || 2;
    this.ph[i] = Math.random() * 6.283;
    this.flk[i] = o.flicker || 0;
    return i;
  }
  _kill(i) {
    const j = --this.n;
    if (i === j) return;
    const V3 = this._v3, S1 = this._s1;
    for (let a = 0; a < V3.length; a++) {
      const A = V3[a];
      A[i * 3] = A[j * 3];
      A[i * 3 + 1] = A[j * 3 + 1];
      A[i * 3 + 2] = A[j * 3 + 2];
    }
    for (let k = 0; k < 4; k++) this.c0[i * 4 + k] = this.c0[j * 4 + k];
    for (let a = 0; a < S1.length; a++) S1[a][i] = S1[a][j];
  }
  // down = direzione della gravità nello spazio del contenitore (Vector3 normalizzato)
  update(dt, down, extraForce) {
    const { p, v } = this;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this._kill(i);
        i--;
        continue;
      }
      const i3 = i * 3, gk = this.grav[i] * dt, dk = Math.exp(-this.drag[i] * dt);
      v[i3] = (v[i3] + down.x * gk) * dk;
      v[i3 + 1] = (v[i3 + 1] + down.y * gk) * dk;
      v[i3 + 2] = (v[i3 + 2] + down.z * gk) * dk;
      if (extraForce) extraForce(i, p, v, dt);
      let wx = 0, wz = 0;
      if (this.wob[i]) {
        const a = this.age[i] * this.wf[i] + this.ph[i];
        wx = Math.sin(a) * this.wob[i];
        wz = Math.cos(a * 0.7) * this.wob[i] * 0.6;
      }
      p[i3] += (v[i3] + wx) * dt;
      p[i3 + 1] += v[i3 + 1] * dt;
      p[i3 + 2] += (v[i3 + 2] + wz) * dt;
      this.rot[i] += this.spin[i] * dt;
    }
    this.write();
  }
  write() {
    const P = this.aPos.array, C = this.aCol.array, S = this.aSR.array, V = this.aVel.array;
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3, i4 = i * 4, u = this.age[i] / this.life[i];
      P[i3] = this.p[i3];
      P[i3 + 1] = this.p[i3 + 1];
      P[i3 + 2] = this.p[i3 + 2];
      V[i3] = this.v[i3];
      V[i3 + 1] = this.v[i3 + 1];
      V[i3 + 2] = this.v[i3 + 2];
      const fi = this.fi[i], fo = this.fo[i];
      let a = this.c0[i4 + 3] * (fi > 0 ? Math.min(1, u / fi) : 1) * (fo > 0 ? Math.min(1, (1 - u) / fo) : 1);
      if (this.flk[i]) a *= 1 - this.flk[i] * (0.5 + 0.5 * Math.sin(this.age[i] * 37 + this.ph[i] * 5));
      C[i4] = this.c0[i4] + (this.c1[i3] - this.c0[i4]) * u;
      C[i4 + 1] = this.c0[i4 + 1] + (this.c1[i3 + 1] - this.c0[i4 + 1]) * u;
      C[i4 + 2] = this.c0[i4 + 2] + (this.c1[i3 + 2] - this.c0[i4 + 2]) * u;
      C[i4 + 3] = a;
      const e = 1 - (1 - u) * (1 - u);
      S[i4] = this.s0[i] + (this.s1[i] - this.s0[i]) * e;
      S[i4 + 1] = this.rot[i];
      S[i4 + 2] = this.cell[i];
      S[i4 + 3] = this.asp[i];
    }
    this.geo.instanceCount = this.n;
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSR.needsUpdate = this.aVel.needsUpdate = true;
  }
};
var DRAW = {
  glow(x, s) {
    const g2 = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g2.addColorStop(0, "rgba(255,255,255,1)");
    g2.addColorStop(0.25, "rgba(255,255,255,.55)");
    g2.addColorStop(0.6, "rgba(255,255,255,.12)");
    g2.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g2;
    x.fillRect(0, 0, s, s);
  },
  core(x, s) {
    const g2 = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g2.addColorStop(0, "rgba(255,255,255,1)");
    g2.addColorStop(0.5, "rgba(255,255,255,.8)");
    g2.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g2;
    x.fillRect(0, 0, s, s);
  },
  spark(x, s) {
    DRAW.glow2(x, s, 0.32);
    x.save();
    x.translate(s / 2, s / 2);
    x.fillStyle = "#fff";
    for (const [len, wid, rot] of [[0.48, 0.05, 0], [0.48, 0.05, Math.PI / 2], [0.26, 0.035, Math.PI / 4], [0.26, 0.035, -Math.PI / 4]]) {
      x.save();
      x.rotate(rot);
      x.beginPath();
      x.moveTo(-len * s, 0);
      x.quadraticCurveTo(0, wid * s, len * s, 0);
      x.quadraticCurveTo(0, -wid * s, -len * s, 0);
      x.fill();
      x.restore();
    }
    x.restore();
  },
  glow2(x, s, k) {
    const g2 = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * k);
    g2.addColorStop(0, "rgba(255,255,255,.9)");
    g2.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g2;
    x.fillRect(0, 0, s, s);
  },
  star(x, s) {
    x.save();
    x.translate(s / 2, s / 2 + s * 0.03);
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = (i % 2 ? 0.2 : 0.44) * s, a = -Math.PI / 2 + i * Math.PI / 5;
      x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    x.closePath();
    x.lineJoin = "round";
    x.lineWidth = s * 0.05;
    x.strokeStyle = "#fff";
    x.fillStyle = "#fff";
    x.fill();
    x.stroke();
    const g2 = x.createRadialGradient(-s * 0.08, -s * 0.12, 0, 0, 0, s * 0.45);
    g2.addColorStop(0, "rgba(255,255,255,0)");
    g2.addColorStop(1, "rgba(0,0,0,.35)");
    x.fillStyle = g2;
    x.fill();
    x.restore();
  },
  heart(x, s) {
    x.save();
    x.translate(s / 2, s * 0.53);
    const k = s * 0.0105;
    x.beginPath();
    x.moveTo(0, 30 * k);
    x.bezierCurveTo(-38 * k, 4 * k, -44 * k, -22 * k, -22 * k, -32 * k);
    x.bezierCurveTo(-10 * k, -37 * k, 0, -28 * k, 0, -18 * k);
    x.bezierCurveTo(0, -28 * k, 10 * k, -37 * k, 22 * k, -32 * k);
    x.bezierCurveTo(44 * k, -22 * k, 38 * k, 4 * k, 0, 30 * k);
    x.closePath();
    x.fillStyle = "#fff";
    x.fill();
    const g2 = x.createRadialGradient(-12 * k, -18 * k, 0, 0, 0, 40 * k);
    g2.addColorStop(0, "rgba(255,255,255,0)");
    g2.addColorStop(1, "rgba(0,0,0,.4)");
    x.fillStyle = g2;
    x.fill();
    x.fillStyle = "rgba(255,255,255,.9)";
    x.beginPath();
    x.ellipse(-20 * k, -20 * k, 7 * k, 4 * k, -0.6, 0, 6.3);
    x.fill();
    x.restore();
  },
  flake(x, s) {
    x.save();
    x.translate(s / 2, s / 2);
    x.strokeStyle = "#fff";
    x.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      x.save();
      x.rotate(i * Math.PI / 3);
      x.lineWidth = s * 0.045;
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(0, -s * 0.42);
      x.stroke();
      x.lineWidth = s * 0.03;
      for (const [d, l] of [[0.17, 0.11], [0.29, 0.08]]) {
        x.beginPath();
        x.moveTo(0, -s * d);
        x.lineTo(-s * l, -s * (d + l));
        x.moveTo(0, -s * d);
        x.lineTo(s * l, -s * (d + l));
        x.stroke();
      }
      x.restore();
    }
    x.fillStyle = "#fff";
    x.beginPath();
    x.arc(0, 0, s * 0.06, 0, 6.3);
    x.fill();
    x.restore();
  },
  smoke(x, s) {
    const r = /* @__PURE__ */ (() => {
      let z = 7;
      return () => (z = z * 16807 % 2147483647) / 2147483647;
    })();
    for (let i = 0; i < 18; i++) {
      const cx = s / 2 + (r() - 0.5) * s * 0.36, cy = s / 2 + (r() - 0.5) * s * 0.36, rr = s * (0.14 + r() * 0.16);
      const g2 = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
      g2.addColorStop(0, "rgba(255,255,255,.28)");
      g2.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g2;
      x.fillRect(0, 0, s, s);
    }
  },
  ring(x, s) {
    x.strokeStyle = "#fff";
    x.lineWidth = s * 0.05;
    x.shadowColor = "#fff";
    x.shadowBlur = s * 0.06;
    x.beginPath();
    x.arc(s / 2, s / 2, s * 0.38, 0, 6.3);
    x.stroke();
    x.shadowBlur = 0;
  },
  dot(x, s) {
    const g2 = x.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s * 0.42);
    g2.addColorStop(0, "#fff");
    g2.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g2;
    x.beginPath();
    x.arc(s / 2, s / 2, s * 0.44, 0, 6.3);
    x.fill();
  },
  drop(x, s) {
    const g2 = x.createLinearGradient(0, 0, 0, s);
    g2.addColorStop(0, "rgba(255,255,255,0)");
    g2.addColorStop(0.7, "rgba(255,255,255,.7)");
    g2.addColorStop(1, "rgba(255,255,255,1)");
    x.fillStyle = g2;
    x.beginPath();
    x.ellipse(s / 2, s / 2, s * 0.13, s * 0.46, 0, 0, 6.3);
    x.fill();
  },
  flame(x, s) {
    const g2 = x.createRadialGradient(s / 2, s * 0.62, 0, s / 2, s * 0.6, s * 0.42);
    g2.addColorStop(0, "rgba(255,255,255,1)");
    g2.addColorStop(0.45, "rgba(255,255,255,.55)");
    g2.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g2;
    x.beginPath();
    x.moveTo(s / 2, s * 0.06);
    x.bezierCurveTo(s * 0.62, s * 0.32, s * 0.86, s * 0.5, s * 0.82, s * 0.68);
    x.bezierCurveTo(s * 0.78, s * 0.9, s * 0.22, s * 0.9, s * 0.18, s * 0.68);
    x.bezierCurveTo(s * 0.14, s * 0.5, s * 0.38, s * 0.32, s / 2, s * 0.06);
    x.fill();
  },
  note(x, s) {
    x.save();
    x.translate(s * 0.5, s * 0.5);
    x.fillStyle = "#fff";
    x.strokeStyle = "#fff";
    x.lineWidth = s * 0.06;
    x.beginPath();
    x.ellipse(-s * 0.12, s * 0.22, s * 0.13, s * 0.095, -0.4, 0, 6.3);
    x.fill();
    x.beginPath();
    x.moveTo(0, s * 0.2);
    x.lineTo(0, -s * 0.36);
    x.quadraticCurveTo(s * 0.16, -s * 0.24, s * 0.22, -s * 0.06);
    x.stroke();
    x.restore();
  }
};
function makeAtlas(THREE, names, { size = 512, extra = {} } = {}) {
  const grid2 = Math.ceil(Math.sqrt(names.length)) || 1, cs = size / grid2;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  const cell = {};
  names.forEach((n, i) => {
    const cx = i % grid2 * cs, cy = Math.floor(i / grid2) * cs;
    x.save();
    x.beginPath();
    x.rect(cx, cy, cs, cs);
    x.clip();
    x.translate(cx + cs * 0.04, cy + cs * 0.04);
    const fn = extra[n] || DRAW[n];
    if (fn) fn(x, cs * 0.92);
    x.restore();
    cell[n] = i;
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, grid: grid2, cell, canvas: c };
}

// fx/cuffia_nuoto.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "grav": void 0, "drag": void 0, "wob": void 0, "wf": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var meta = { label: "Cuffia e occhialini da nuoto", labelEn: "Swim cap & goggles", labelFr: "Bonnet et lunettes de natation", labelDe: "Badekappe und Schwimmbrille", category: "costumi", icon: "\u{1F3CA}" };
async function build(THREE, h) {
  const g2 = new THREE.Group();
  g2.name = "cuffia_nuoto";
  const ring = bandRing(THREE, { yF: 7.9, yB: -0.6, n: 120, gap: () => 0, lift: (p) => 0.5 * Math.pow(Math.sin(p), 2) });
  const NV = 26, n = ring.n;
  const off = (t, phi) => {
    const back = Math.max(0, -Math.cos(phi)), bun = 1.4 * Math.exp(-Math.pow((t - 0.5) / 0.22, 2)) * Math.pow(back, 1.5);
    return 0.22 + 2.1 * smooth(0, 0.85, t) * (0.6 + 0.4 * smooth(0.2, 1, t)) + bun;
  };
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  const geo = grid(THREE, n, NV, (i, j, out) => {
    const t = j / NV, th = ring.T[i] * (1 - t), phi = ring.phi[i];
    const wr = 0.06 * Math.sin(phi * 38) * (1 - smooth(0, 0.25, t)) * smooth(0, 0.05, t);
    hullAt(Math.max(1e-4, th), phi, off(t, phi) + wr, out, N);
  }, { pole1: true, flip: true, uRep: 6, vRep: 2 });
  const nz = valueNoise(8, 64), nm = normalFromHeight(THREE, heightField(128, 128, (u, v) => nz(u * 24, v * 24) * 0.6 + nz(u * 64, v * 64) * 0.4), 128, 128, 1.4, [2, 2]);
  const sil = new THREE.MeshPhysicalMaterial({ color: 2056143, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2, normalMap: nm, normalScale: new THREE.Vector2(0.25, 0.25), envMapIntensity: 0.8, sheen: 0.3, sheenColor: new THREE.Color(0.6, 0.75, 1), transparent: true });
  {
    const col = new Float32Array(geo.attributes.position.count * 3);
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i, s = 0.82 + 0.18 * smooth(0, 0.2, j / NV);
      col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = s;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    sil.vertexColors = true;
  }
  g2.add(new THREE.Mesh(geo, sil));
  {
    const pts = [];
    for (let i = 0; i < n; i++) pts.push(hullAt(ring.T[i], ring.phi[i], 0.32, new THREE.Vector3(), N));
    g2.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, 0.2, 8, true), sil));
  }
  const lensM = mirrorLens(THREE, { top: "#3d8fe0", hor: "#d9f0ff", low: "#1a2a3a", tint: "#1b3550", opacity: 0.9, sharp: 0.7 });
  const rimM = new THREE.MeshPhysicalMaterial({ color: 2781142, roughness: 0.2, clearcoat: 1, transparent: true, opacity: 0.92 });
  const cups = [];
  for (const s of [-1, 1]) {
    const cup = new THREE.Group();
    cup.position.set(s * 3.12, 2.66, 4.95);
    cup.rotation.y = s * 0.32;
    g2.add(cup);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, 1.1), lensM);
    shell.rotation.x = Math.PI / 2;
    shell.scale.set(2.05, 0.75, 1.45);
    shell.position.z = -0.35;
    shell.renderOrder = 3;
    cup.add(shell);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.13, 8, 40), rimM);
    rim.scale.set(2.05 * Math.sin(1.1), 1.45 * Math.sin(1.1), 1);
    rim.position.z = -0.35 + 0.75 * Math.cos(1.1) - 0.02;
    cup.add(rim);
    const gask = new THREE.Mesh(new THREE.TorusGeometry(1, 0.2, 8, 40), new THREE.MeshStandardMaterial({ color: 1780282, roughness: 0.6, transparent: true }));
    gask.scale.copy(rim.scale);
    gask.position.z = rim.position.z - 0.28;
    cup.add(gask);
    cups.push(cup);
  }
  {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.25, 2.85, 5.35), new THREE.Vector3(0, 3.2, 5.75), new THREE.Vector3(1.25, 2.85, 5.35)]);
    g2.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.09, 6, false), rimM));
  }
  {
    const pts = [new THREE.Vector3(-5.05, 2.95, 4.2)];
    for (let k = 0; k <= 20; k++) {
      const phi = -Math.PI * 0.42 - k / 20 * Math.PI * 1.16;
      hullAt(1.38, phi, off(0.12, phi) + 0.38, P, N);
      pts.push(P.clone());
    }
    pts.push(new THREE.Vector3(5.05, 2.95, 4.2));
    const c = new THREE.CatmullRomCurve3(pts);
    const tg = new THREE.TubeGeometry(c, 120, 0.4, 8, false);
    const p = tg.attributes.position, q = new THREE.Vector3(), cpt = new THREE.Vector3();
    for (let i = 0; i <= 120; i++) {
      c.getPointAt(i / 120, cpt);
      const r = Math.hypot(cpt.x, cpt.z - HULL.c[2]) || 1;
      const rx = cpt.x / r, rz = (cpt.z - HULL.c[2]) / r;
      for (let j = 0; j <= 8; j++) {
        const k = i * 9 + j;
        q.fromBufferAttribute(p, k).sub(cpt);
        const d = q.x * rx + q.z * rz;
        q.x -= d * rx * 0.75;
        q.z -= d * rz * 0.75;
        q.y *= 1.4;
        p.setXYZ(k, cpt.x + q.x, cpt.y + q.y, cpt.z + q.z);
      }
    }
    tg.computeVertexNormals();
    g2.add(new THREE.Mesh(tg, new THREE.MeshPhysicalMaterial({ color: 1851270, roughness: 0.4, clearcoat: 0.6, transparent: true })));
  }
  const U = g2.userData;
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.ex = new Expr(["jaw", "pucker"]);
  U.trig = new Trigger({ on: 0.45, off: 0.25, hold: 0.05, cooldown: 0.4 });
  U.world = worldRoot(THREE, g2, U.frame);
  U.atlas = makeAtlas(THREE, ["bubble"], { extra: { bubble: (x, s) => {
    x.strokeStyle = "rgba(255,255,255,0.85)";
    x.lineWidth = s * 0.05;
    x.beginPath();
    x.arc(s / 2, s / 2, s * 0.42, 0, 6.3);
    x.stroke();
    const gr = x.createRadialGradient(s / 2, s / 2, s * 0.2, s / 2, s / 2, s * 0.44);
    gr.addColorStop(0, "rgba(200,230,255,0.05)");
    gr.addColorStop(1, "rgba(200,230,255,0.35)");
    x.fillStyle = gr;
    x.fill();
    x.fillStyle = "rgba(255,255,255,0.95)";
    x.beginPath();
    x.ellipse(s * 0.36, s * 0.34, s * 0.09, s * 0.05, -0.7, 0, 6.3);
    x.fill();
  } } });
  U.bub = new Sprites(THREE, { max: 50, atlas: U.atlas, blend: "normal", renderOrder: 6 });
  U.world.add(U.bub.mesh);
  U.mouth = new THREE.Vector3(0, -4.4, 6);
  U.t0 = 0;
  U.pw = new THREE.Vector3();
  U.down = new THREE.Vector3(0, -1, 0);
  U.vv = new THREE.Vector3();
  U.vw = new THREE.Vector3();
  return g2;
}
function update(g2, bs, t, h) {
  const U = g2.userData, dt = U.tick.tick(t);
  const v = U.ex.update(bs, dt, h);
  U.frame.update(dt);
  U.world.userData.sync();
  U.trig.update(Math.max(v.jaw, v.pucker), dt);
  if (U.trig.fired) U.t0 = 0.6;
  if (U.trig.active) U.t0 = Math.max(U.t0, 0.15);
  if (U.t0 > 0) {
    U.t0 -= dt;
    if (Math.random() < dt * 26) {
      U.frame.toWorld(U.mouth, U.pw);
      U.vv.set((Math.random() - 0.5) * 3, 4 + Math.random() * 3, 3 + Math.random() * 3);
      U.frame.dirToWorld(U.vv, U.vw);
      const s = 0.5 + Math.random() * 0.9;
      U.bub.spawn((__s0["x"] = U.pw.x + (Math.random() - 0.5), __s0["y"] = U.pw.y, __s0["z"] = U.pw.z, __s0["vx"] = U.vw.x, __s0["vy"] = U.vw.y, __s0["vz"] = U.vw.z, __s0["life"] = 2.2 + Math.random(), __s0["size"] = s, __s0["size1"] = s * 1.25, __s0["r"] = 1, __s0["g"] = 1, __s0["b"] = 1, __s0["a"] = 0.95, __s0["cell"] = 0, __s0["grav"] = -9, __s0["drag"] = 0.6, __s0["wob"] = 1.2, __s0["wf"] = 4, __s0["fadeIn"] = 0.1, __s0["fadeOut"] = 0.15, __s0));
    }
  }
  U.bub.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
