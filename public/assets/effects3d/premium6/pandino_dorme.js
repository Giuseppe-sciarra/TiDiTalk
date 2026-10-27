// Tiditalk — effetto viso 3D "pandino_dorme" (premium6). Codice originale, AGPL-3.0. GENERATO da _src/fx/pandino_dorme.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

// lib/head.js
var clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;

// lib/fur.js
var VS_HEAD = `
#ifdef USE_FLEN
attribute float flen;
#endif
uniform float uOff; uniform float uLen; uniform vec3 uBend; varying vec3 vBase; varying float vH;
`;
var FS_HEAD = `
uniform float uOff; uniform float uFreq; uniform float uDens; uniform vec3 uRoot; uniform vec3 uTip; uniform float uClump; uniform float uVC; uniform float uRootK; varying vec3 vBase; varying float vH;
float h31(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
`;
function furMesh(THREE, geo, { color = 15327958, tip = null, len = 0.6, shells = 10, freq = 18, dens = 0.75, rough = 0.9, clump = 0.35, baseMat = null, renderOrder = 2, vertexColors = false, rootK = 0.55, flen = false } = {}) {
  const group = new THREE.Group();
  const root = new THREE.Color(color).multiplyScalar(0.55), tipC = new THREE.Color(tip ?? color);
  const bend = new THREE.Vector3();
  const base = new THREE.Mesh(geo, baseMat || new THREE.MeshStandardMaterial({ color: new THREE.Color(vertexColors ? tip ?? color : color).multiplyScalar(0.62), roughness: 1, transparent: true, vertexColors }));
  group.add(base);
  const mats = [];
  for (let s = 1; s <= shells; s++) {
    const f = s / shells;
    const m = new THREE.MeshStandardMaterial({ color: vertexColors ? tipC : 16777215, roughness: rough, transparent: true, depthWrite: false, envMapIntensity: 0.5, vertexColors });
    const U = { uOff: { value: f }, uLen: { value: len }, uBend: { value: bend }, uFreq: { value: freq }, uDens: { value: dens }, uRoot: { value: root }, uTip: { value: tipC }, uClump: { value: clump }, uVC: { value: vertexColors ? 1 : 0 }, uRootK: { value: rootK } };
    if (flen) m.defines = { USE_FLEN: "" };
    m.onBeforeCompile = (sh2) => {
      Object.assign(sh2.uniforms, U);
      sh2.vertexShader = VS_HEAD + sh2.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
          vBase = position; vH = uOff;
          float fl = 1.0;
          #ifdef USE_FLEN
          fl = flen;
          #endif
          transformed += normalize(objectNormal) * uOff * uLen * fl + uBend * (uOff * uOff) * uLen * fl;`);
      sh2.fragmentShader = FS_HEAD + sh2.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
          vec3 q = vBase * uFreq; vec3 cell = floor(q); vec3 fr = fract(q) - 0.5;
          float r = h31(cell), r2 = h31(cell + 17.3);
          // ciocca: i peli di una cella si assottigliano verso la punta (cono), alcuni pi\xF9 corti
          float lenK = mix(0.55, 1.0, r2);
          float rad = mix(0.62, 0.12, clamp(vH / lenK, 0.0, 1.0));
          float d = length(fr) * 1.1;
          float strand = step(1.0 - uDens, r) * step(vH, lenK) * (1.0 - smoothstep(rad * 0.45, rad, d));
          float a = mix(strand, max(strand, 1.0 - vH * 2.2), uClump * (1.0 - vH));
          if (a < 0.08) discard;
          vec3 cc = uVC > 0.5 ? diffuseColor.rgb * mix(uRootK, 1.0, smoothstep(0.0, 0.9, vH)) : mix(uRoot, uTip, smoothstep(0.0, 0.9, vH));
          diffuseColor.rgb = cc * (0.82 + 0.3 * r);
          diffuseColor.a *= a;`);
    };
    m.customProgramCacheKey = () => "p6fur" + (flen ? "L" : "");
    const sh = new THREE.Mesh(geo, m);
    sh.renderOrder = renderOrder + s * 0.01;
    group.add(sh);
    mats.push(m);
  }
  return { group, base, mats, bend, setBend(v) {
    bend.copy(v);
  } };
}

// lib/core.js
var clamp2 = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
var TAU = Math.PI * 2;
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
var Spring = class {
  constructor(x = 0, k = 120, c = 12) {
    this.x = x;
    this.v = 0;
    this.k = k;
    this.c = c;
    this.target = x;
  }
  step(dt, target = this.target) {
    const sub = dt > 1 / 60 ? Math.ceil(dt * 60) : 1, h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const a = this.k * (target - this.x) - this.c * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
    return this.x;
  }
};

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
var Rel = class {
  constructor({ up = 0.035, down = 3 } = {}) {
    this.up = up;
    this.down = down;
    this.b = 0;
    this.init = false;
    this.v = 0;
  }
  update(x, dt, ready = true) {
    if (!ready) {
      this.init = false;
      this.v = 0;
      return 0;
    }
    if (!this.init) {
      this.b = x;
      this.init = true;
    }
    const k = x < this.b ? this.down : this.up;
    this.b += (x - this.b) * (1 - Math.exp(-k * dt));
    this.v = clamp2((x - this.b) / Math.max(0.3, 1 - this.b));
    return this.v;
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
  const grid = Math.ceil(Math.sqrt(names.length)) || 1, cs = size / grid;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  const cell = {};
  names.forEach((n, i) => {
    const cx = i % grid * cs, cy = Math.floor(i / grid) * cs;
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
  return { tex, grid, cell, canvas: c };
}

// fx/pandino_dorme.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "rot": void 0, "spin": void 0, "cell": void 0, "wob": void 0, "wf": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var meta = { label: "Pandino che dorme in testa", labelEn: "Sleepy panda on your head", labelFr: "B\xE9b\xE9 panda endormi sur la t\xEAte", labelDe: "Schlafender Panda auf dem Kopf", category: "divertenti", icon: "\u{1F43C}" };
var WHITE = [0.93, 0.91, 0.87];
var BLACK = [0.09, 0.085, 0.09];
function part(THREE, r, sx, sy, sz, pos, rot, black, ws = 22, hs = 14) {
  const g2 = new THREE.SphereGeometry(r, ws, hs);
  g2.scale(sx, sy, sz);
  if (rot) g2.rotateX(rot[0]).rotateY(rot[1]).rotateZ(rot[2]);
  g2.translate(pos[0], pos[1], pos[2]);
  const p = g2.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const c = (typeof black === "function" ? black(p.getX(i), p.getY(i), p.getZ(i)) : black) ? BLACK : WHITE;
    col[i * 3] = c[0];
    col[i * 3 + 1] = c[1];
    col[i * 3 + 2] = c[2];
  }
  g2.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g2;
}
function merge(THREE, list) {
  let nv = 0, ni = 0;
  for (const g2 of list) {
    nv += g2.attributes.position.count;
    ni += g2.index.count;
  }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g2 of list) {
    g2.computeVertexNormals();
    pos.set(g2.attributes.position.array, ov * 3);
    nor.set(g2.attributes.normal.array, ov * 3);
    col.set(g2.attributes.color.array, ov * 3);
    const I = g2.index.array;
    for (let k = 0; k < I.length; k++) idx[oi + k] = I[k] + ov;
    ov += g2.attributes.position.count;
    oi += I.length;
    g2.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
async function build(THREE, h) {
  const g2 = new THREE.Group();
  g2.name = "pandino_dorme";
  const root = new THREE.Group();
  root.scale.setScalar(1.25);
  root.position.set(0, 10.5 * -0.25 - 0.8, 3.5 * -0.25);
  g2.add(root);
  const body = new THREE.Group();
  body.position.set(0, 14.6, -3.4);
  root.add(body);
  const bodyGeo = merge(THREE, [
    part(THREE, 1, 3.5, 2.5, 4.3, [0, 0, 0], [-0.32, 0, 0], (x, y, z) => z > 1.5 && y > -0.8, 26, 16),
    // corpo, fascia nera delle spalle
    part(THREE, 1, 1.1, 2.2, 1.15, [-3, -3, 6], [-0.45, 0, 0.3], true, 14, 10),
    // zampe davanti sui lati della fronte
    part(THREE, 1, 1.1, 2.2, 1.15, [3, -3, 6], [-0.45, 0, -0.3], true, 14, 10),
    part(THREE, 1, 1.25, 1.1, 2, [-3.5, -1, -3], [0.5, 0.5, -0.4], true, 14, 10),
    // zampe dietro
    part(THREE, 1, 1.25, 1.1, 2, [3.5, -1, -3], [0.5, -0.5, 0.4], true, 14, 10),
    part(THREE, 0.75, 1, 1, 1, [0, 1.6, -4.3], null, false, 10, 8)
    // codina
  ]);
  const bfur = furMesh(THREE, bodyGeo, { vertexColors: true, color: 16777215, tip: 15920870, len: 0.28, shells: 7, freq: 13, dens: 0.96, clump: 0.9, rootK: 0.7 });
  body.add(bfur.group);
  const neck = new THREE.Group();
  neck.position.set(0, 12.15, 2.9);
  root.add(neck);
  const headG = new THREE.Group();
  headG.position.set(0, 0.35, 0.35);
  headG.rotation.set(0.18, 0, 0.12);
  neck.add(headG);
  const ex = 1.22, ey = 0.2;
  const patch = (x, y, z) => {
    for (const s of [-1, 1]) {
      const ca = Math.cos(0.55), sa = Math.sin(0.55) * s;
      const qx = (x - s * ex) * ca + (y - ey) * sa, qy = -(x - s * ex) * sa + (y - ey) * ca;
      const d2 = qx / 0.62 * (qx / 0.62) + qy / 0.9 * (qy / 0.9);
      if (z > 1.4 && d2 < 1) return true;
    }
    return false;
  };
  const headGeo = merge(THREE, [
    part(THREE, 1, 3, 2.65, 2.65, [0, 0, 0], null, patch, 36, 24),
    part(THREE, 1, 0.95, 0.95, 0.55, [-2.05, 2.15, -0.4], [0, 0, 0.35], true, 12, 8),
    // orecchie
    part(THREE, 1, 0.95, 0.95, 0.55, [2.05, 2.15, -0.4], [0, 0, -0.35], true, 12, 8)
  ]);
  const hfur = furMesh(THREE, headGeo, { vertexColors: true, color: 16777215, tip: 15920870, len: 0.26, shells: 7, freq: 14, dens: 0.96, clump: 0.9, rootK: 0.7 });
  headG.add(hfur.group);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshPhysicalMaterial({ color: 15526112, roughness: 0.9, sheen: 0.6, sheenColor: new THREE.Color(1, 1, 1), transparent: true }));
  muzzle.scale.set(1.35, 0.95, 0.9);
  muzzle.position.set(0, -0.9, 2.35);
  headG.add(muzzle);
  const blackGloss = new THREE.MeshPhysicalMaterial({ color: 723468, roughness: 0.2, clearcoat: 1, transparent: true });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), blackGloss);
  nose.scale.set(1.25, 0.8, 0.8);
  nose.position.set(0, -0.55, 3.2);
  headG.add(nose);
  const closed = [], open = [];
  for (const s of [-1, 1]) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.075, 6, 16, Math.PI * 0.8), new THREE.MeshStandardMaterial({ color: 15525596, roughness: 0.6, transparent: true }));
    arc.position.set(s * ex, ey + 0.05, 2.62);
    arc.rotation.set(0.25, s * 0.38, Math.PI + 0.1 * Math.PI);
    headG.add(arc);
    closed.push(arc);
    const eye = new THREE.Group();
    eye.position.set(s * ex, ey, 2.45);
    eye.rotation.y = s * 0.38;
    headG.add(eye);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12), blackGloss);
    ball.scale.z = 0.7;
    eye.add(ball);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 16777215, transparent: true }));
    hl.position.set(-0.13, 0.15, 0.26);
    eye.add(hl);
    eye.scale.setScalar(1e-3);
    open.push(eye);
  }
  const U = g2.userData;
  Object.assign(U, { root, body, neck, headG, closed, open, ears: null, tick: new Ticker(), ex: new Expr(["browUp", "smile"]), rel: new Rel(), wake: new Spring(0, 70, 11), awakeT: 0, frame: new HeadFrame(THREE, root), sway: new Spring(0, 60, 6), pv: new THREE.Vector3(), acc: new THREE.Vector3(), loc: new THREE.Vector3(), init: false, zT: 0.5 });
  U.atlas = makeAtlas(THREE, ["z"], { extra: { z: (x, s) => {
    x.fillStyle = "#fff";
    x.strokeStyle = "rgba(60,70,110,0.9)";
    x.lineWidth = s * 0.06;
    x.font = `bold ${Math.round(s * 0.8)}px sans-serif`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.strokeText("Z", s / 2, s / 2);
    x.fillText("Z", s / 2, s / 2);
  } } });
  U.zz = new Sprites(THREE, { max: 8, atlas: U.atlas, blend: "normal", renderOrder: 6 });
  root.add(U.zz.mesh);
  U.zero = new THREE.Vector3();
  U.upv = new THREE.Vector3(0, -1, 0);
  return g2;
}
function update(g2, bs, t, h) {
  const U = g2.userData, dt = U.tick.tick(t);
  const v = U.ex.update(bs, dt, h);
  const up = U.rel.update(v.browUp, dt, U.ex.ready);
  if (up > 0.5) U.awakeT = 1.6;
  else U.awakeT = Math.max(0, U.awakeT - dt);
  const w = clamp(U.wake.step(dt, U.awakeT > 0 ? 1 : 0), -0.1, 1.15);
  const br = Math.sin(t * (w > 0.5 ? 2.2 : 1.35)) * (1 - 0.5 * w);
  U.body.scale.set(1 + 0.025 * br, 1 + 0.04 * br, 1 + 0.015 * br);
  U.neck.position.y = 12.15 + 1 * w + 0.05 * br * (1 - w);
  U.headG.rotation.z = 0.12 * (1 - w) + 0.04 * Math.sin(t * 0.7) * (1 - w);
  U.headG.rotation.x = 0.18 * (1 - w) - 0.12 * w;
  for (let k = 0; k < 2; k++) {
    const s = clamp(w * 1.4 - 0.2), c = clamp(1 - w * 1.6);
    U.open[k].scale.setScalar(Math.max(1e-3, s));
    U.closed[k].scale.setScalar(Math.max(1e-3, c));
  }
  U.frame.update(dt);
  if (U.init && dt > 0) U.acc.subVectors(U.frame.vel, U.pv).divideScalar(dt);
  else U.acc.set(0, 0, 0);
  U.pv.copy(U.frame.vel);
  U.init = true;
  U.frame.dirToLocal(U.acc, U.loc);
  const sw = U.sway.step(dt, clamp(-U.loc.x * 4e-4, -0.15, 0.15));
  U.root.rotation.z = sw;
  U.zT -= dt;
  if (w < 0.3 && U.zT <= 0) {
    U.zT = 1.5;
    U.zz.spawn((__s0["x"] = 2.4, __s0["y"] = 15.6, __s0["z"] = 4.4, __s0["vx"] = 0.8, __s0["vy"] = 1.6, __s0["vz"] = 0.4, __s0["life"] = 2.6, __s0["size"] = 1, __s0["size1"] = 2, __s0["r"] = 1, __s0["g"] = 1, __s0["b"] = 1, __s0["a"] = 0.95, __s0["rot"] = -0.2, __s0["spin"] = 0.15, __s0["cell"] = 0, __s0["wob"] = 0.4, __s0["wf"] = 2, __s0["fadeIn"] = 0.15, __s0["fadeOut"] = 0.4, __s0));
  }
  U.zz.update(dt, U.zero);
}
export {
  build as default,
  meta,
  update
};
