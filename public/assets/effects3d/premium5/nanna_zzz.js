// Tiditalk — effetto viso 3D "nanna_zzz" (premium5). Codice originale, AGPL-3.0. GENERATO da _src/fx/nanna_zzz.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

// lib/core.js
var clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
var damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
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
var Dangle = class {
  constructor(THREE, len, { damping = 0.9, stiff = 200, grav = 980 } = {}) {
    this.len = len;
    this.damping = damping;
    this.stiff = stiff;
    this.grav = grav;
    this.b = new THREE.Vector3();
    this.bp = new THREE.Vector3();
    this.dir = new THREE.Vector3(0, -1, 0);
    this._a = new THREE.Vector3();
    this._r = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this.init = false;
    this._lp = new THREE.Vector3();
  }
  // pivot e restDir in spazio mondo; restituisce la direzione (mondo, normalizzata)
  step(dt, pivot, restDir, down) {
    if (this.init && this._lp.distanceToSquared(pivot) > 64) this.init = false;
    this._lp.copy(pivot);
    if (!this.init) {
      this.b.copy(pivot).addScaledVector(restDir, this.len);
      this.bp.copy(this.b);
      this.init = true;
    }
    if (dt <= 0) return this.dir;
    const sub = dt > 1 / 45 ? 2 : 1, h = dt / sub;
    for (let k = 0; k < sub; k++) {
      this._r.copy(pivot).addScaledVector(restDir, this.len);
      this._a.copy(down).multiplyScalar(this.grav).addScaledVector(this._t.subVectors(this._r, this.b), this.stiff);
      const d = Math.pow(this.damping, h * 60);
      this._t.subVectors(this.b, this.bp).multiplyScalar(d);
      this.bp.copy(this.b);
      this.b.add(this._t).addScaledVector(this._a, h * h);
      this._t.subVectors(this.b, pivot);
      const L = this._t.length() || 1;
      this.b.copy(pivot).addScaledVector(this._t, this.len / L);
    }
    this.dir.subVectors(this.b, pivot).normalize();
    return this.dir;
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
  frown: (b) => Math.max(avg(b, "browDownLeft", "browDownRight"), avg(b, "mouthFrownLeft", "mouthFrownRight")) * (1 - 0.8 * clamp(smileOf(b) * 1.5)),
  pout: (b) => Math.max(avg(b, "mouthFrownLeft", "mouthFrownRight"), g(b, "mouthShrugLower") * 0.85, g(b, "mouthRollLower") * 0.6) * (1 - 0.8 * clamp(smileOf(b) * 1.5))
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
    const target = !c || c.ready ? 1 : clamp((c.progress - 0.5) * 2);
    if (this._first) {
      this.gate = target;
      this._first = false;
    } else this.gate += (target - this.gate) * Math.min(1, dt * 4);
    if (target === 1 && this.gate > 0.995) this.gate = 1;
    this.ready = this.gate > 0.98;
    for (let i = 0; i < this.names.length; i++) {
      const n = this.names[i], x = clamp(CHANNELS[n](bs));
      this.raw[n] = x;
      this.v[n] = x * this.gate;
    }
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
var _Q0 = [0, 0, 0, 1];
var _C1 = [1, 1, 1];
var Bodies = class {
  constructor(THREE, geo, mat, max = 100) {
    this.max = max;
    this.n = 0;
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    const F = (k) => new Float32Array(max * k);
    this.p = F(3);
    this.v = F(3);
    this.q = F(4);
    this.w = F(3);
    this.col = F(3);
    this.age = F(1);
    this.life = F(1);
    this.s = F(1);
    this.s1 = F(1);
    this.drag = F(1);
    this.grav = F(1);
    this.flut = F(1);
    this.ph = F(1);
    this.grow = F(1);
    this.sx = F(1);
    this.sy = F(1);
    this.sz = F(1);
    this.al = new Uint8Array(max);
    this._s1 = [this.age, this.life, this.s, this.s1, this.drag, this.grav, this.flut, this.ph, this.grow, this.sx, this.sy, this.sz, this.al];
    this.onDie = null;
  }
  clear() {
    this.n = 0;
    this.mesh.count = 0;
  }
  // o: { x,y,z, vx,vy,vz, life, s, s1, sx,sy,sz (forma), color: THREE.Color | [r,g,b], q:[x,y,z,w], wx,wy,wz, drag, grav, flut, grow }
  spawn(o) {
    if (this.n >= this.max) return -1;
    const i = this.n++, i3 = i * 3, i4 = i * 4;
    this.p[i3] = o.x || 0;
    this.p[i3 + 1] = o.y || 0;
    this.p[i3 + 2] = o.z || 0;
    this.v[i3] = o.vx || 0;
    this.v[i3 + 1] = o.vy || 0;
    this.v[i3 + 2] = o.vz || 0;
    const q = o.q || _Q0;
    for (let k = 0; k < 4; k++) this.q[i4 + k] = q[k];
    this.w[i3] = o.wx || 0;
    this.w[i3 + 1] = o.wy || 0;
    this.w[i3 + 2] = o.wz || 0;
    const c = o.color || _C1;
    if (c.isColor) {
      this.col[i3] = c.r;
      this.col[i3 + 1] = c.g;
      this.col[i3 + 2] = c.b;
    } else {
      this.col[i3] = c[0];
      this.col[i3 + 1] = c[1];
      this.col[i3 + 2] = c[2];
    }
    this.age[i] = 0;
    this.life[i] = o.life || 2;
    this.s[i] = o.s ?? 1;
    this.s1[i] = o.s1 ?? this.s[i];
    this.sx[i] = o.sx || 1;
    this.sy[i] = o.sy || 1;
    this.sz[i] = o.sz || 1;
    this.drag[i] = o.drag || 0;
    this.grav[i] = o.grav || 0;
    this.flut[i] = o.flut || 0;
    this.ph[i] = Math.random() * 6.283;
    this.grow[i] = o.grow || 0;
    this.al[i] = o.align ? 1 : 0;
    return i;
  }
  _kill(i) {
    if (this.onDie) this.onDie(i, this);
    const j = --this.n;
    if (i === j) return;
    for (let k = 0; k < 3; k++) {
      this.p[i * 3 + k] = this.p[j * 3 + k];
      this.v[i * 3 + k] = this.v[j * 3 + k];
      this.w[i * 3 + k] = this.w[j * 3 + k];
      this.col[i * 3 + k] = this.col[j * 3 + k];
    }
    for (let k = 0; k < 4; k++) this.q[i * 4 + k] = this.q[j * 4 + k];
    const S1 = this._s1;
    for (let a = 0; a < S1.length; a++) S1[a][i] = S1[a][j];
  }
  update(dt, down, extraForce) {
    const { p, v, q, w } = this;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this._kill(i);
        i--;
        continue;
      }
      const i3 = i * 3, i4 = i * 4, gk = this.grav[i] * dt, dk = Math.exp(-this.drag[i] * dt);
      v[i3] = (v[i3] + down.x * gk) * dk;
      v[i3 + 1] = (v[i3 + 1] + down.y * gk) * dk;
      v[i3 + 2] = (v[i3 + 2] + down.z * gk) * dk;
      if (extraForce) extraForce(i, p, v, dt);
      let fx = 0, fz = 0;
      if (this.flut[i]) {
        const a = this.age[i] * 5 + this.ph[i];
        fx = Math.sin(a) * this.flut[i];
        fz = Math.cos(a * 0.8) * this.flut[i] * 0.7;
      }
      p[i3] += (v[i3] + fx) * dt;
      p[i3 + 1] += v[i3 + 1] * dt;
      p[i3 + 2] += (v[i3 + 2] + fz) * dt;
      if (this.al[i]) {
        let ax = -v[i3], ay = -v[i3 + 1], az = -v[i3 + 2];
        const L = Math.sqrt(ax * ax + ay * ay + az * az);
        if (L > 1e-3) {
          ax /= L;
          ay /= L;
          az /= L;
          const r = ay + 1;
          if (r < 1e-5) {
            q[i4] = 1;
            q[i4 + 1] = 0;
            q[i4 + 2] = 0;
            q[i4 + 3] = 0;
          } else {
            const qx = az, qy = 0, qz = -ax, qw = r, n = 1 / Math.sqrt(qx * qx + qz * qz + qw * qw);
            q[i4] = qx * n;
            q[i4 + 1] = qy;
            q[i4 + 2] = qz * n;
            q[i4 + 3] = qw * n;
          }
        }
        continue;
      }
      const wx = w[i3], wy = w[i3 + 1], wz = w[i3 + 2];
      if (wx || wy || wz) {
        const x = q[i4], y = q[i4 + 1], z = q[i4 + 2], ww = q[i4 + 3], h = 0.5 * dt;
        let nx = x + h * (wx * ww + wy * z - wz * y), ny = y + h * (wy * ww + wz * x - wx * z), nz = z + h * (wz * ww + wx * y - wy * x), nw = ww + h * (-wx * x - wy * y - wz * z);
        const L = 1 / Math.hypot(nx, ny, nz, nw);
        q[i4] = nx * L;
        q[i4 + 1] = ny * L;
        q[i4 + 2] = nz * L;
        q[i4 + 3] = nw * L;
      }
    }
    this.write();
  }
  write() {
    const M = this.mesh.instanceMatrix.array, C = this.mesh.instanceColor.array;
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3, i4 = i * 4, o = i * 16, u = this.age[i] / this.life[i];
      let s = this.s[i] + (this.s1[i] - this.s[i]) * u;
      if (this.grow[i]) s *= Math.min(1, u / this.grow[i]);
      const x = this.q[i4], y = this.q[i4 + 1], z = this.q[i4 + 2], w = this.q[i4 + 3];
      const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
      const sx = s * this.sx[i], sy = s * this.sy[i], sz = s * this.sz[i];
      M[o] = (1 - (yy + zz)) * sx;
      M[o + 1] = (xy + wz) * sx;
      M[o + 2] = (xz - wy) * sx;
      M[o + 3] = 0;
      M[o + 4] = (xy - wz) * sy;
      M[o + 5] = (1 - (xx + zz)) * sy;
      M[o + 6] = (yz + wx) * sy;
      M[o + 7] = 0;
      M[o + 8] = (xz + wy) * sz;
      M[o + 9] = (yz - wx) * sz;
      M[o + 10] = (1 - (xx + yy)) * sz;
      M[o + 11] = 0;
      M[o + 12] = this.p[i3];
      M[o + 13] = this.p[i3 + 1];
      M[o + 14] = this.p[i3 + 2];
      M[o + 15] = 1;
      C[i3] = this.col[i3];
      C[i3 + 1] = this.col[i3 + 1];
      C[i3 + 2] = this.col[i3 + 2];
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
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

// lib/geo.js
function puffy(THREE, shape, { depth = 0.2, bevel = 0.5, seg = 6, curveSeg = 24, size = null } = {}) {
  const g2 = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: size ?? bevel * 0.9, bevelSegments: seg, curveSegments: curveSeg });
  g2.translate(0, 0, -depth / 2);
  g2.computeVertexNormals();
  return g2;
}
var DynTube = class {
  constructor(THREE, n, radial = 10, { r = () => 1, sx = 1, sy = 1, capEnd = false, uRepeat = 1 } = {}) {
    this.n = n;
    this.radial = radial;
    this.r = r;
    this.sx = sx;
    this.sy = sy;
    const R = radial + 1, nv = n * R + (capEnd ? 1 : 0);
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.nor = new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const uv = new Float32Array(nv * 2);
    for (let i = 0; i < n; i++) for (let j = 0; j <= radial; j++) {
      const k = i * R + j;
      uv[k * 2] = j / radial * uRepeat;
      uv[k * 2 + 1] = i / (n - 1);
    }
    const idx = [];
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
      const a = i * R + j, b = a + R;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    if (capEnd) {
      const c = n * R;
      uv[c * 2] = 0.5;
      uv[c * 2 + 1] = 1;
      for (let j = 0; j < radial; j++) idx.push((n - 1) * R + j, (n - 1) * R + j + 1, c);
    }
    this.capEnd = capEnd;
    geo.setAttribute("position", this.pos);
    geo.setAttribute("normal", this.nor);
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);
    this.geo = geo;
    this.T = new Float32Array(n * 3);
    this.N = new Float32Array(n * 3);
    this.B = new Float32Array(n * 3);
  }
  // pts: Float32Array n*3; up0: vettore di riferimento per la prima sezione
  update(pts, up0 = [0, 0, 1]) {
    const n = this.n, T = this.T, N = this.N, B = this.B;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let tx = pts[b * 3] - pts[a * 3], ty = pts[b * 3 + 1] - pts[a * 3 + 1], tz = pts[b * 3 + 2] - pts[a * 3 + 2];
      const L = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
      T[i * 3] = tx / L;
      T[i * 3 + 1] = ty / L;
      T[i * 3 + 2] = tz / L;
    }
    let nx = up0[0], ny = up0[1], nz = up0[2];
    for (let i = 0; i < n; i++) {
      const tx = T[i * 3], ty = T[i * 3 + 1], tz = T[i * 3 + 2];
      const d = nx * tx + ny * ty + nz * tz;
      nx -= d * tx;
      ny -= d * ty;
      nz -= d * tz;
      let L = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (L < 1e-5) {
        nx = ty;
        ny = -tx;
        nz = 0;
        L = Math.sqrt(nx * nx + ny * ny) || 1;
      }
      nx /= L;
      ny /= L;
      nz /= L;
      N[i * 3] = nx;
      N[i * 3 + 1] = ny;
      N[i * 3 + 2] = nz;
      B[i * 3] = ty * nz - tz * ny;
      B[i * 3 + 1] = tz * nx - tx * nz;
      B[i * 3 + 2] = tx * ny - ty * nx;
    }
    const P = this.pos.array, Nn = this.nor.array, R = this.radial + 1;
    for (let i = 0; i < n; i++) {
      const rr = this.r(i / (n - 1)), cx = pts[i * 3], cy = pts[i * 3 + 1], cz = pts[i * 3 + 2];
      for (let j = 0; j <= this.radial; j++) {
        const a = j / this.radial * Math.PI * 2, c = Math.cos(a) * this.sx, s = Math.sin(a) * this.sy, k = (i * R + j) * 3;
        const ox = N[i * 3] * c + B[i * 3] * s, oy = N[i * 3 + 1] * c + B[i * 3 + 1] * s, oz = N[i * 3 + 2] * c + B[i * 3 + 2] * s;
        P[k] = cx + ox * rr;
        P[k + 1] = cy + oy * rr;
        P[k + 2] = cz + oz * rr;
        const c2 = Math.cos(a) / this.sx, s2 = Math.sin(a) / this.sy;
        let mx = N[i * 3] * c2 + B[i * 3] * s2, my = N[i * 3 + 1] * c2 + B[i * 3 + 1] * s2, mz = N[i * 3 + 2] * c2 + B[i * 3 + 2] * s2;
        const L = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
        Nn[k] = mx / L;
        Nn[k + 1] = my / L;
        Nn[k + 2] = mz / L;
      }
    }
    if (this.capEnd) {
      const c = n * R * 3, e = (n - 1) * 3;
      P[c] = pts[e] + T[e] * 0.2;
      P[c + 1] = pts[e + 1] + T[e + 1] * 0.2;
      P[c + 2] = pts[e + 2] + T[e + 2] * 0.2;
      Nn[c] = T[e];
      Nn[c + 1] = T[e + 1];
      Nn[c + 2] = T[e + 2];
    }
    this.pos.needsUpdate = this.nor.needsUpdate = true;
  }
};

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
function fbm(noise, x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise(x * f, y * f);
    n += a;
    a *= 0.5;
    f *= 2;
  }
  return s / n;
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
function feltNormal(THREE, seed = 3, repeat = [4, 4], strength = 3) {
  const n1 = valueNoise(seed, 32), n2 = valueNoise(seed + 7, 64);
  const H = heightField(128, 128, (u, v) => fbm(n1, u * 32, v * 32, 3) * 0.6 + n2(u * 64, v * 64) * 0.4);
  return normalFromHeight(THREE, H, 128, 128, strength, repeat);
}
function furNormal(THREE, seed = 5, repeat = [6, 2], strength = 5) {
  const r = rng(seed);
  const w = 128, h = 128;
  const H = new Float32Array(w * h);
  for (let k = 0; k < 900; k++) {
    const x0 = r() * w, y0 = r() * h, L = 4 + r() * 8, a = -Math.PI / 2 + (r() - 0.5) * 0.9, hv = 0.4 + r() * 0.6;
    for (let t = 0; t < L; t++) {
      const x = Math.floor(x0 + Math.cos(a) * t + w) % w, y = Math.floor(y0 + Math.sin(a) * t + h) % h;
      H[y * w + x] = Math.max(H[y * w + x], hv * (1 - t / L * 0.5));
    }
  }
  return normalFromHeight(THREE, H, w, h, strength, repeat);
}

// lib/kawaii.js
var TAU2 = Math.PI * 2;
var Mats = class {
  constructor(THREE) {
    this.THREE = THREE;
    this._fur = null;
    this._felt = null;
  }
  get furN() {
    return this._fur || (this._fur = furNormal(this.THREE, 5, [3, 3], 3.2));
  }
  get feltN() {
    return this._felt || (this._felt = feltNormal(this.THREE, 3, [5, 5], 2.6));
  }
  _c(c) {
    return new this.THREE.Color(c);
  }
  // peluche / velluto: lucentezza "sheen" ai bordi, pelo fine nella mappa normale
  plush(color, o = {}) {
    const T = this.THREE, c = this._c(color);
    return new T.MeshPhysicalMaterial(Object.assign({
      color: c,
      roughness: 0.88,
      sheen: 0.6,
      sheenRoughness: 0.5,
      sheenColor: c.clone().lerp(new T.Color(1, 1, 1), 0.3),
      normalMap: this.furN,
      normalScale: new T.Vector2(0.55, 0.55),
      envMapIntensity: 0.45,
      transparent: true
    }, o));
  }
  felt(color, o = {}) {
    const T = this.THREE;
    return new T.MeshStandardMaterial(Object.assign({ color: this._c(color), roughness: 0.95, normalMap: this.feltN, normalScale: new T.Vector2(0.7, 0.7), envMapIntensity: 0.45, transparent: true }, o));
  }
  satin(color, o = {}) {
    const T = this.THREE, c = this._c(color);
    return new T.MeshPhysicalMaterial(Object.assign({ color: c, roughness: 0.38, sheen: 0.9, sheenRoughness: 0.3, sheenColor: c.clone().lerp(new T.Color(1, 1, 1), 0.6), clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.7, transparent: true }, o));
  }
  // plastica/caramella lucida (perline, ovetti, ciliegia)
  candy(color, o = {}) {
    const T = this.THREE;
    return new T.MeshPhysicalMaterial(Object.assign({ color: this._c(color), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true }, o));
  }
  // glassa / gelato: lucido e un po' traslucido (sheen tenue)
  glaze(color, o = {}) {
    const T = this.THREE, c = this._c(color);
    return new T.MeshPhysicalMaterial(Object.assign({ color: c, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.4, sheenColor: c.clone().lerp(new T.Color(1, 1, 1), 0.5), transparent: true }, o));
  }
  matte(color, o = {}) {
    return new this.THREE.MeshStandardMaterial(Object.assign({ color: this._c(color), roughness: 0.8, envMapIntensity: 0.6, transparent: true }, o));
  }
  // nero lucido degli occhietti
  eye(color = 1774100, o = {}) {
    return new this.THREE.MeshPhysicalMaterial(Object.assign({ color: this._c(color), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true }, o));
  }
  flat(color, o = {}) {
    return new this.THREE.MeshBasicMaterial(Object.assign({ color: this._c(color), transparent: true }, o));
  }
};
function blob(THREE, r, { sx = 1, sy = 1, sz = 1, ws = 28, hs = 20, amp = 0, seed = 3, freq = 1.5 } = {}) {
  const g2 = new THREE.SphereGeometry(r, ws, hs);
  const p = g2.attributes.position, n = valueNoise(seed, 16);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = amp ? 1 + (n(x * freq + 7, y * freq + z * freq * 0.7) - 0.5) * 2 * amp : 1;
    p.setXYZ(i, x * sx * k, y * sy * k, z * sz * k);
  }
  g2.computeVertexNormals();
  return g2;
}
function zShape(THREE, s = 1) {
  const z = new THREE.Shape();
  z.moveTo(-0.5 * s, 0.5 * s);
  z.lineTo(0.55 * s, 0.5 * s);
  z.lineTo(0.55 * s, 0.28 * s);
  z.lineTo(-0.12 * s, -0.3 * s);
  z.lineTo(0.55 * s, -0.3 * s);
  z.lineTo(0.55 * s, -0.52 * s);
  z.lineTo(-0.55 * s, -0.52 * s);
  z.lineTo(-0.55 * s, -0.3 * s);
  z.lineTo(0.12 * s, 0.28 * s);
  z.lineTo(-0.5 * s, 0.28 * s);
  z.closePath();
  return z;
}

// lib/hat.js
var Dome = class _Dome {
  // 1.8.9: calotta calzata FUORI dal cranio vero del motore (HEAD.cranium: centro (0, 5,6, −4,8), raggi 7,7 × 7,7 × 8,7)
  // con 0,6–1 cm di margine per i capelli: cima a y 14, bordo sulla fronte (y 7,8, z 4,4) e sulla nuca (z −14,7).
  // Prima (centro (0, 2,4, −3,6), cima 12,3) stava dentro la testa vera: il motore spegneva la calotta e da sotto
  // si vedeva l'interno.
  constructor({ rx = 8.9, ry = 11, rz = 10.1, c = [0, 3.7, -4.8], tilt = 0.32, thetaMax = 1.48 } = {}) {
    Object.assign(this, { rx, ry, rz, c, tilt, thetaMax });
  }
  // punto della calotta: theta dal polo, phi intorno (0 = davanti, +π/2 = +X)
  at(theta, phi, out) {
    const x = Math.sin(theta) * Math.sin(phi) * this.rx, y0 = Math.cos(theta) * this.ry, z0 = Math.sin(theta) * Math.cos(phi) * this.rz;
    const cb = Math.cos(this.tilt), sb = Math.sin(this.tilt);
    return out.set(this.c[0] + x, this.c[1] + y0 * cb + z0 * sb, this.c[2] - y0 * sb + z0 * cb);
  }
  // normale (approssimata: gradiente dell'ellissoide)
  nrm(theta, phi, out) {
    const nx = Math.sin(theta) * Math.sin(phi) / this.rx, ny = Math.cos(theta) / this.ry, nz = Math.sin(theta) * Math.cos(phi) / this.rz;
    const cb = Math.cos(this.tilt), sb = Math.sin(this.tilt);
    return out.set(nx, ny * cb + nz * sb, -ny * sb + nz * cb).normalize();
  }
  // geometria: griglia theta × phi con uv (u intorno, v dal polo al bordo); grow allarga verso il bordo
  geo(THREE, { ws = 56, hs = 22, thetaMax = this.thetaMax, bump = null } = {}) {
    const pos = [], uv = [], idx = [], v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i <= hs; i++) {
      const th = i / hs * thetaMax;
      for (let j = 0; j <= ws; j++) {
        const ph = j / ws * Math.PI * 2;
        this.at(th, ph, v);
        if (bump) {
          this.nrm(th, ph, n);
          const b = bump(th, ph);
          v.addScaledVector(n, b);
        }
        pos.push(v.x, v.y, v.z);
        uv.push(j / ws, 1 - i / hs);
      }
    }
    for (let i = 0; i < hs; i++) for (let j = 0; j < ws; j++) {
      const a = i * (ws + 1) + j, b = a + ws + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g2.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g2.setIndex(idx);
    g2.computeVertexNormals();
    return g2;
  }
  // 1.8.9: fodera scura (solo facce interne) appena dentro la calotta + testa vera (solo profondità):
  // dalla webcam bassa, fra il bordo e la testa, si vede l'ombra dentro il cappello e non un
  // "coperchio" chiaro. La calotta esterna va con side: FrontSide.
  lining(THREE, { color = 1972501, k = 0.975, thetaMax = this.thetaMax - 0.01 } = {}) {
    const d = new _Dome({ rx: this.rx * k, ry: this.ry * k, rz: this.rz * k, c: this.c, tilt: this.tilt, thetaMax });
    const g2 = new THREE.Group();
    g2.name = "lining";
    g2.add(new THREE.Mesh(d.geo(THREE, { ws: 48, hs: 16 }), new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.BackSide, transparent: true })));
    const o = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }));
    o.scale.set(7.6, 10.1, 9.3);
    o.position.set(0, 2.3, -4.6);
    o.renderOrder = -1;
    o.name = "realHead";
    g2.add(o);
    return g2;
  }
  // tubo chiuso lungo il bordo (risvolto): r(phi) raggio del tubo, off spinge in fuori
  rim(THREE, { r = 1.2, radial = 14, segs = 96, off = 0.4, theta = this.thetaMax, rib = 0, sy = 1 } = {}) {
    const pos = [], nor = [], uv = [], idx = [];
    const P = new THREE.Vector3(), N = new THREE.Vector3(), T = new THREE.Vector3(), Q = new THREE.Vector3(), B = new THREE.Vector3(), A = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const ph = i / segs * Math.PI * 2;
      this.at(theta, ph, P);
      this.nrm(theta, ph, N);
      this.at(theta, ph + 0.01, Q);
      T.subVectors(Q, P).normalize();
      B.crossVectors(T, N).normalize();
      P.addScaledVector(N, off);
      for (let j = 0; j <= radial; j++) {
        const a = j / radial * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const rr = r * (1 + rib * Math.pow(Math.abs(Math.cos(ph * 40)), 3) * 0.12);
        A.set(0, 0, 0).addScaledVector(N, c).addScaledVector(B, s * sy);
        pos.push(P.x + A.x * rr, P.y + A.y * rr, P.z + A.z * rr);
        A.set(0, 0, 0).addScaledVector(N, c).addScaledVector(B, s / sy).normalize();
        nor.push(A.x, A.y, A.z);
        uv.push(i / segs, j / radial);
      }
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g2.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g2.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g2.setIndex(idx);
    return g2;
  }
};

// fx/nanna_zzz.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "life": void 0, "size": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s1 = { "x": void 0, "y": void 0, "z": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0 };
var __s2 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "grav": void 0 };
var __s3 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "s": void 0, "s1": void 0, "color": void 0, "q": void 0, "wz": void 0, "flut": void 0, "drag": void 0 };
var __s4 = { "x": void 0, "y": void 0, "z": void 0, "life": void 0, "size": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "fadeIn": void 0, "fadeOut": void 0, "spin": void 0 };
var __s5 = { "x": void 0, "y": void 0, "z": void 0, "life": void 0, "s": void 0, "color": void 0, "q": void 0 };
var meta = { label: "Nanna", labelEn: "Sleepy zzz", category: "divertenti", icon: "\u{1F4A4}" };
var NS = 28;
function starTex(THREE) {
  const W = 256, c = canvas(W, W), x = c.getContext("2d");
  x.fillStyle = "#3a4fa8";
  x.fillRect(0, 0, W, W);
  const star = (cx, cy, r2) => {
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r2 * 0.45 : r2;
      x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.closePath();
    x.fill();
  };
  x.fillStyle = "#ffd34d";
  const r = rng(4);
  for (let i = 0; i < 14; i++) star(r() * W, r() * W, 6 + r() * 6);
  for (let i = 0; i < 4; i++) {
    const cx = r() * W, cy = r() * W;
    x.beginPath();
    x.arc(cx, cy, 11, 0, 6.3);
    x.fill();
    x.fillStyle = "#3a4fa8";
    x.beginPath();
    x.arc(cx + 6, cy - 4, 10, 0, 6.3);
    x.fill();
    x.fillStyle = "#ffd34d";
  }
  x.fillStyle = "rgba(255,255,255,.5)";
  for (let i = 0; i < 40; i++) {
    x.beginPath();
    x.arc(r() * W, r() * W, 1.5, 0, 6.3);
    x.fill();
  }
  const t = texFrom(THREE, c, {});
  t.repeat.set(3, 1.5);
  return t;
}
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  const M = new Mats(THREE);
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.expr = new Expr(["eyesClosed", "smile"]);
  U.rnd = rng(17);
  const dome = new Dome();
  const cloth = M.plush(16777215, { map: starTex(THREE), normalMap: null, side: THREE.DoubleSide, sheen: 0.4 });
  g2.add(new THREE.Mesh(dome.geo(THREE, { ws: 60, hs: 22 }), Object.assign(cloth.clone(), { side: THREE.FrontSide })), dome.lining(THREE, { color: 1711148 }));
  g2.add(new THREE.Mesh(dome.rim(THREE, { r: 1, off: 0.4, sy: 1.15, theta: dome.thetaMax - 0.03 }), M.plush(10326742)));
  U.tube = new DynTube(THREE, NS, 20, { r: (s) => 5.6 * Math.pow(1 - s, 1.7) + 0.32, uRepeat: 2 });
  const tip = new THREE.Mesh(U.tube.geo, M.plush(16777215, { map: starTex(THREE), normalMap: null, side: THREE.DoubleSide, sheen: 0.4 }));
  tip.frustumCulled = false;
  g2.add(tip);
  U.pom = new THREE.Mesh(blob(THREE, 1.5, { amp: 0.15, freq: 2.4, seed: 2, ws: 24, hs: 18 }), M.plush(15919615));
  g2.add(U.pom);
  U.d0 = dome.nrm(0.15, 0, new THREE.Vector3());
  U.B0 = dome.at(0.15, 0, new THREE.Vector3()).addScaledVector(U.d0, -3.2);
  U.dg = new Dangle(THREE, 12, { damping: 0.88, stiff: 140, grav: 260 });
  U.pts = new Float32Array(NS * 3);
  U.up0 = [0, 0, 1];
  U.bub = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), new THREE.MeshPhysicalMaterial({ color: 13625599, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.6, emissive: new THREE.Color(2109512), iridescence: 1, iridescenceIOR: 1.3, clearcoat: 1, depthWrite: false, envMapIntensity: 1.5 }));
  U.bubHl = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12), new THREE.MeshBasicMaterial({ color: 16777215, transparent: true, opacity: 0.9, depthWrite: false }));
  U.bubHl.position.set(-0.4, 0.4, 0.9);
  U.bub.add(U.bubHl);
  U.bub.renderOrder = 4;
  g2.add(U.bub);
  U.rimA = makeAtlas(THREE, ["ring", "glow"]);
  U.rim = new Sprites(THREE, { max: 2, atlas: U.rimA, blend: "add", renderOrder: 5 });
  g2.add(U.rim.mesh);
  U.rim.spawn((__s0["x"] = 0, __s0["y"] = 0, __s0["z"] = 0, __s0["life"] = 1e9, __s0["size"] = 1, __s0["r"] = 0.75, __s0["g"] = 0.9, __s0["b"] = 1, __s0["a"] = 0.85, __s0["cell"] = U.rimA.cell.ring, __s0["fadeIn"] = 0, __s0["fadeOut"] = 0, __s0));
  const world = worldRoot(THREE, g2, U.frame);
  U.world = world;
  const zg = puffy(THREE, zShape(THREE, 1), { depth: 0.2, bevel: 0.12, size: 0.1, seg: 2, curveSeg: 2 });
  U.zs = new Bodies(THREE, zg, M.candy(16777215, { roughness: 0.3, emissive: new THREE.Color(2234948) }), 16);
  world.add(U.zs.mesh);
  U.atlas = makeAtlas(THREE, ["spark", "glow", "ring", "star"]);
  U.fx = new Sprites(THREE, { max: 60, atlas: U.atlas, blend: "add", renderOrder: 7 });
  world.add(U.fx.mesh);
  U.sleep = 0;
  U.closedT = 0;
  U.zT = 0;
  U.breath = 0;
  U.bubS = 0;
  U.popT = 0;
  U.v = new THREE.Vector3();
  U.w = new THREE.Vector3();
  U.a = new THREE.Vector3();
  U.b = new THREE.Vector3();
  U.c = new THREE.Vector3();
  U.d = new THREE.Vector3();
  U.r = new THREE.Vector3();
  U.down = new THREE.Vector3(0, -1, 0);
  U.q = [0, 0, 0, 1];
  U.zc = [[0.75, 0.78, 1], [0.95, 0.85, 1], [1, 0.95, 0.75]];
  U.restL = new THREE.Vector3(0.95, -0.28, 0.22).normalize();
  update(g2, {}, 0, h);
  return g2;
}
function shapeTip(U, dirL) {
  const P = U.pts, B = U.B0, d0 = U.d0;
  const C1 = U.a.copy(B).addScaledVector(d0, 8.2), T = U.b.copy(C1).addScaledVector(dirL, 11);
  for (let i = 0; i < NS; i++) {
    const s = i / (NS - 1), u = 1 - s;
    P[i * 3] = u * u * B.x + 2 * u * s * C1.x + s * s * T.x;
    P[i * 3 + 1] = u * u * B.y + 2 * u * s * C1.y + s * s * T.y;
    P[i * 3 + 2] = u * u * B.z + 2 * u * s * C1.z + s * s * T.z;
  }
  U.tube.update(P, U.up0);
  U.pom.position.copy(T);
}
function update(g2, bs, t, h) {
  const U = g2.userData;
  if (!U.frame) return;
  const dt = U.tick.tick(t);
  U.frame.update(dt);
  U.world.userData.sync();
  const e = U.expr.update(bs, dt, h);
  const show = !U.frame.attached;
  const closed = e.eyesClosed > 0.6;
  U.closedT = closed ? U.closedT + dt : 0;
  const asleep = show || U.closedT > 0.6;
  if (!asleep && U.sleep > 0.5 && U.bubS > 0.3) {
    U.frame.toWorld(U.bub.position, U.w);
    U.fx.spawn((__s1["x"] = U.w.x, __s1["y"] = U.w.y, __s1["z"] = U.w.z, __s1["life"] = 0.35, __s1["size"] = U.bubS * 2, __s1["size1"] = U.bubS * 4, __s1["r"] = 0.8, __s1["g"] = 0.9, __s1["b"] = 1, __s1["a"] = 1, __s1["cell"] = U.atlas.cell.ring, __s1));
    for (let k = 0; k < 8; k++) U.fx.spawn((__s2["x"] = U.w.x, __s2["y"] = U.w.y, __s2["z"] = U.w.z, __s2["vx"] = (U.rnd() - 0.5) * 16, __s2["vy"] = (U.rnd() - 0.3) * 14, __s2["vz"] = (U.rnd() - 0.5) * 8, __s2["life"] = 0.4, __s2["size"] = 0.5, __s2["size1"] = 0.1, __s2["r"] = 0.8, __s2["g"] = 0.95, __s2["b"] = 1, __s2["a"] = 1, __s2["cell"] = U.atlas.cell.spark, __s2["grav"] = 30, __s2));
    U.bubS = 0;
  }
  U.sleep = damp(U.sleep, asleep ? 1 : 0, asleep ? 2 : 8, dt);
  U.breath += dt * 2.6;
  const target = asleep ? 0.55 + 0.95 * (0.5 + 0.5 * Math.sin(U.breath)) : 0;
  U.bubS = show ? 1.3 : damp(U.bubS, target, asleep ? 3 : 20, dt);
  U.bub.visible = U.bubS > 0.05;
  U.bub.scale.setScalar(Math.max(1e-3, U.bubS));
  U.bub.position.set(-0.85 - U.bubS * 0.55, -1.9 - U.bubS * 0.25, 6.7 + U.bubS * 0.75);
  {
    const R = U.rim;
    R.p[0] = U.bub.position.x;
    R.p[1] = U.bub.position.y;
    R.p[2] = U.bub.position.z + 0.2;
    R.s0[0] = R.s1[0] = U.bubS * 2.5;
    R.c0[3] = U.bub.visible ? 0.85 : 0;
    R.age[0] = 0;
    R.write();
  }
  if (asleep && !show) {
    U.zT -= dt;
    if (U.zT <= 0) {
      U.zT = 0.75;
      U.frame.toWorld(U.v.set(4.5, 11, 2), U.w);
      const c = U.zc[U.rnd() * 3 | 0];
      U.q[0] = 0;
      U.q[1] = 0;
      U.q[2] = Math.sin(0.15);
      U.q[3] = Math.cos(0.15);
      U.zs.spawn((__s3["x"] = U.w.x, __s3["y"] = U.w.y, __s3["z"] = U.w.z, __s3["vx"] = 4 + U.rnd() * 2, __s3["vy"] = 6, __s3["vz"] = 1.5, __s3["life"] = 2.6, __s3["s"] = 0.6, __s3["s1"] = 2, __s3["color"] = c, __s3["q"] = U.q, __s3["wz"] = (U.rnd() - 0.5) * 0.8, __s3["flut"] = 2.5, __s3["drag"] = 0.2, __s3));
    }
    if (U.rnd() < dt * 4) {
      const a = U.rnd() * 6.28;
      U.frame.toWorld(U.v.set(Math.cos(a) * 12, 6 + Math.sin(a) * 9, 0), U.w);
      U.fx.spawn((__s4["x"] = U.w.x, __s4["y"] = U.w.y, __s4["z"] = U.w.z, __s4["life"] = 1.2, __s4["size"] = 0.8 + U.rnd() * 0.8, __s4["r"] = 1, __s4["g"] = 0.92, __s4["b"] = 0.6, __s4["a"] = 1, __s4["cell"] = U.atlas.cell.star, __s4["fadeIn"] = 0.4, __s4["fadeOut"] = 0.5, __s4["spin"] = 1, __s4));
    }
  }
  if (!show && U.demo) {
    U.zs.clear();
    U.demo = false;
  }
  if (show && U.zs.n === 0) {
    U.demo = true;
    for (let k = 0; k < 3; k++) {
      U.frame.toWorld(U.v.set(6 + k * 2.4, 12 + k * 3, 2), U.w);
      U.q[0] = 0;
      U.q[1] = 0;
      U.q[2] = Math.sin(0.15);
      U.q[3] = Math.cos(0.15);
      U.zs.spawn((__s5["x"] = U.w.x, __s5["y"] = U.w.y, __s5["z"] = U.w.z, __s5["life"] = 1e6, __s5["s"] = 1.1 + k * 0.45, __s5["color"] = U.zc[k], __s5["q"] = U.q, __s5));
    }
  }
  if (show) {
    shapeTip(U, U.restL);
  } else {
    const piv = U.c.copy(U.B0).addScaledVector(U.d0, 8.2);
    const pw = U.frame.toWorld(piv, U.w), rw = U.frame.dirToWorld(U.restL, U.v);
    U.dg.len = 11;
    const dw = U.dg.step(dt, pw, rw, U.down);
    U.frame.dirToLocal(dw, U.r).normalize();
    U.d.copy(U.r);
    shapeTip(U, U.d);
  }
  U.zs.update(dt, U.down.set(0, 0.15, 0));
  U.down.set(0, -1, 0);
  U.fx.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
