// Tiditalk — effetto viso 3D "pie_face" (premium3). Codice originale, AGPL-3.0. GENERATO da _src/fx/pie_face.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

// lib/core.js
var clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
var easeOutBack = (t, s = 1.70158) => {
  const u = t - 1;
  return 1 + u * u * ((s + 1) * u + s);
};
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
function smoothLathe(THREE, pts, segs = 48, sub = 6) {
  const v = pts.map(([x, y]) => new THREE.Vector2(x, y));
  const out = [];
  for (let i = 0; i < v.length - 1; i++) {
    const p0 = v[Math.max(0, i - 1)], p1 = v[i], p2 = v[i + 1], p3 = v[Math.min(v.length - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push(new THREE.Vector2(Math.max(0, f(p0.x, p1.x, p2.x, p3.x)), f(p0.y, p1.y, p2.y, p3.y)));
    }
  }
  out.push(v[v.length - 1].clone());
  return new THREE.LatheGeometry(out, segs);
}
var _snCache = /* @__PURE__ */ new Map();
function surfaceNets(THREE, sdf, min, max, res = 48, colorFn = null, key = null) {
  if (key && _snCache.has(key)) {
    const c = _snCache.get(key), g3 = new THREE.BufferGeometry();
    g3.setAttribute("position", new THREE.BufferAttribute(c.pos, 3));
    g3.setAttribute("normal", new THREE.BufferAttribute(c.nor, 3));
    if (c.col) g3.setAttribute("color", new THREE.BufferAttribute(c.col, 3));
    g3.setIndex(new THREE.BufferAttribute(c.idx, 1));
    return g3;
  }
  const nx = res + 1, ny = res + 1, nz = res + 1;
  const dx = (max[0] - min[0]) / res, dy = (max[1] - min[1]) / res, dz = (max[2] - min[2]) / res;
  const F = new Float32Array(nx * ny * nz), real = new Uint8Array(nx * ny * nz);
  const B = 4, nb = Math.ceil(res / B), diag = B * Math.sqrt(dx * dx + dy * dy + dz * dz) * 1.6;
  const at = (i, j, k) => sdf(min[0] + i * dx, min[1] + j * dy, min[2] + k * dz);
  const cb = new Float32Array((nb + 1) ** 3);
  for (let k = 0; k <= nb; k++) for (let j = 0; j <= nb; j++) for (let i = 0; i <= nb; i++) cb[i + (nb + 1) * (j + (nb + 1) * k)] = at(Math.min(i * B, res), Math.min(j * B, res), Math.min(k * B, res));
  for (let bk = 0; bk < nb; bk++) for (let bj = 0; bj < nb; bj++) for (let bi = 0; bi < nb; bi++) {
    let far = true, sg = 0, neg = 0;
    for (let c = 0; c < 8; c++) {
      const v = cb[bi + (c & 1) + (nb + 1) * (bj + (c >> 1 & 1) + (nb + 1) * (bk + (c >> 2)))];
      if (!(Math.abs(v) > diag)) far = false;
      if (v < 0) neg++;
      sg = v;
    }
    if (neg !== 0 && neg !== 8) far = false;
    const i0 = bi * B, j0 = bj * B, k0 = bk * B, i1 = Math.min(i0 + B, res), j1 = Math.min(j0 + B, res), k1 = Math.min(k0 + B, res);
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const id = i + nx * (j + ny * k);
      if (real[id]) continue;
      if (far) F[id] = sg < 0 ? -1e3 : 1e3;
      else {
        F[id] = at(i, j, k);
        real[id] = 1;
      }
    }
  }
  const vid = new Int32Array(res * res * res).fill(-1);
  const pos = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const val = new Float32Array(8);
  for (let k = 0; k < res; k++) for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    let m = 0;
    for (let c = 0; c < 8; c++) {
      const v = F[i + corner[c][0] + nx * (j + corner[c][1] + ny * (k + corner[c][2]))];
      val[c] = v;
      if (v < 0) m |= 1 << c;
    }
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of edges) {
      const va = val[a], vb = val[b];
      if (va < 0 === vb < 0) continue;
      const t = va / (va - vb);
      sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t;
      sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t;
      sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t;
      cnt++;
    }
    vid[i + res * (j + res * k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / cnt) * dx, min[1] + (j + sy / cnt) * dy, min[2] + (k + sz / cnt) * dz);
  }
  const idx = [];
  const cell = (i, j, k) => i < 0 || j < 0 || k < 0 || i >= res || j >= res || k >= res ? -1 : vid[i + res * (j + res * k)];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, b, c, a, c, d);
    else idx.push(a, d, c, a, c, b);
  };
  for (let k = 0; k < res; k++) for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const v0 = F[i + nx * (j + ny * k)] < 0;
    if (j > 0 && k > 0) {
      const v1 = F[i + 1 + nx * (j + ny * k)] < 0;
      if (v0 !== v1) quad(cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k), v0);
    }
    if (i > 0 && k > 0) {
      const v1 = F[i + nx * (j + 1 + ny * k)] < 0;
      if (v0 !== v1) quad(cell(i - 1, j, k - 1), cell(i - 1, j, k), cell(i, j, k), cell(i, j, k - 1), v0);
    }
    if (i > 0 && j > 0) {
      const v1 = F[i + nx * (j + ny * (k + 1))] < 0;
      if (v0 !== v1) quad(cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k), v0);
    }
  }
  const nor = new Float32Array(pos.length), e = Math.min(dx, dy, dz) * 0.5;
  for (let v = 0; v < pos.length; v += 3) {
    const x = pos[v], y = pos[v + 1], z = pos[v + 2];
    let gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const L = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    nor[v] = gx / L;
    nor[v + 1] = gy / L;
    nor[v + 2] = gz / L;
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g2.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  if (colorFn) {
    const c = new Float32Array(pos.length);
    for (let v = 0; v < pos.length; v += 3) {
      const k = colorFn(pos[v], pos[v + 1], pos[v + 2], nor[v], nor[v + 1], nor[v + 2]);
      c[v] = k[0];
      c[v + 1] = k[1];
      c[v + 2] = k[2];
    }
    g2.setAttribute("color", new THREE.BufferAttribute(c, 3));
  }
  g2.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  if (key) _snCache.set(key, { pos: g2.attributes.position.array.slice(), nor: nor.slice(), col: g2.attributes.color ? g2.attributes.color.array.slice() : null, idx: g2.index.array.slice() });
  return g2;
}
var sd = {
  sphere: (x, y, z, cx, cy, cz, r) => {
    const a = x - cx, b = y - cy, c = z - cz;
    return Math.sqrt(a * a + b * b + c * c) - r;
  },
  ellipsoid: (x, y, z, cx, cy, cz, rx, ry, rz) => {
    const a = (x - cx) / rx, b = (y - cy) / ry, c = (z - cz) / rz, k0 = Math.sqrt(a * a + b * b + c * c), d = a / rx, e = b / ry, f = c / rz, k1 = Math.sqrt(d * d + e * e + f * f);
    return k0 * (k0 - 1) / (k1 || 1e-9);
  },
  capsule: (x, y, z, ax, ay, az, bx, by, bz, r) => {
    const px = x - ax, py = y - ay, pz = z - az, ex = bx - ax, ey = by - ay, ez = bz - az;
    const h = Math.max(0, Math.min(1, (px * ex + py * ey + pz * ez) / (ex * ex + ey * ey + ez * ez)));
    const a = px - ex * h, b = py - ey * h, c = pz - ez * h;
    return Math.sqrt(a * a + b * b + c * c) - r;
  },
  smin: (a, b, k) => {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  },
  smax: (a, b, k) => -sd.smin(-a, -b, k)
};

// fx/pie_face.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "drag": void 0, "grav": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s1 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "rot": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s2 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "s": void 0, "q": void 0, "wx": void 0, "wy": void 0, "wz": void 0, "drag": void 0, "grav": void 0 };
var meta = { label: "Torta in faccia", labelEn: "Pie in the face", labelFr: "Tarte \xE0 la cr\xE8me", labelDe: "Torte ins Gesicht", category: "divertenti", icon: "\u{1F967}" };
var BLOBS = [
  [1, 0, 0.3, 0.8, 1.9, 0.2],
  [50, -0.4, 0.3, 0.7, 1.7, -0.5],
  [280, 0.5, 0, 0.7, 1.75, 0.6],
  [10, -1.4, -0.4, 0.8, 1.55, 0.3],
  [152, 0.6, 0.6, 0.8, 1.35, -0.2],
  [205, -0.8, -0.6, 0.7, 1.25, 1.1],
  [425, 0.7, 0.4, 0.7, 1.2, -1],
  [108, 1.8, -1, 0.7, 1.1, 0.4]
];
function creamSdf(x, y, z) {
  let d = sd.ellipsoid(x, y, z, 0, 0, 0, 1.25, 1.25, 0.55);
  for (let i = 0; i < 6; i++) {
    const a2 = i * 1.047;
    d = sd.smin(d, sd.sphere(x, y, z, Math.cos(a2) * 0.8, Math.sin(a2) * 0.8, 0.25, 0.55), 0.35);
  }
  const r = Math.hypot(x, y), a = Math.atan2(y, x);
  const peak = sd.capsule(x, y, z, 0, 0, 0.2, 0.25, 0.3, 1.25, 0.42 - 0.05 * z);
  d = sd.smin(d, peak, 0.4);
  return d + 0.06 * Math.sin(a * 8 + r * 4 - z * 3);
}
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.expr = new Expr(["jaw"]);
  U.rnd = rng(301);
  U.trig = new Trigger({ on: 0.58, off: 0.3, hold: 0.12, cooldown: 0.5 });
  const cream = new THREE.MeshPhysicalMaterial({ color: 16776178, roughness: 0.42, sheen: 0.7, sheenColor: new THREE.Color(1, 0.97, 0.9), clearcoat: 0.25, clearcoatRoughness: 0.4, transparent: true });
  const creamG = surfaceNets(THREE, creamSdf, [-2.2, -2.2, -0.9], [2.2, 2.2, 1.9], 19, null, "p3cream");
  const pie = new THREE.Group();
  pie.rotation.order = "YXZ";
  U.pie = pie;
  g2.add(pie);
  const tinG = smoothLathe(THREE, [[0, 0], [3.6, 0], [4.4, 1.1], [4.75, 1.25], [4.8, 1.1]], 64, 3);
  {
    const p = tinG.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
      if (r > 3.7) {
        const a = Math.atan2(z, x), k = 1 + 0.025 * Math.sin(a * 48);
        p.setX(i, x * k);
        p.setZ(i, z * k);
      }
    }
    tinG.computeVertexNormals();
  }
  const tin = new THREE.Mesh(tinG, new THREE.MeshStandardMaterial({ color: 14211806, metalness: 0.95, roughness: 0.32, side: THREE.DoubleSide, transparent: true }));
  pie.add(tin);
  const crust = new THREE.Mesh(new THREE.TorusGeometry(4.15, 0.5, 10, 48), new THREE.MeshStandardMaterial({ color: 14260814, roughness: 0.7, transparent: true }));
  crust.rotation.x = Math.PI / 2;
  crust.position.y = 1.25;
  pie.add(crust);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), cream);
  dome.scale.set(1, 0.42, 1);
  dome.position.y = 1.2;
  pie.add(dome);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2, b = new THREE.Mesh(creamG, cream);
    b.position.set(Math.cos(a) * 2.9, 1.9, Math.sin(a) * 2.9);
    b.rotation.x = -Math.PI / 2;
    b.scale.setScalar(0.62);
    pie.add(b);
  }
  const top = new THREE.Mesh(creamG, cream);
  top.position.y = 2.6;
  top.rotation.x = -Math.PI / 2;
  top.scale.setScalar(0.95);
  pie.add(top);
  const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), new THREE.MeshPhysicalMaterial({ color: 12582942, roughness: 0.15, clearcoat: 1, transparent: true }));
  cherry.position.y = 4;
  pie.add(cherry);
  U.wait = new THREE.Vector3(15.5, 4.5, 4);
  U.hit = new THREE.Vector3(0, 0.5, 9.5);
  U.blobs = [];
  for (const [lm, dx, dy, dz, s, rz] of BLOBS) {
    const p = h.lm(lm);
    const m = new THREE.Mesh(creamG, cream);
    m.position.set(p.x + dx, p.y + dy, p.z + dz);
    m.rotation.z = rz;
    m.visible = false;
    g2.add(m);
    let drip = null;
    if (U.blobs.length % 2 === 0) {
      drip = new THREE.Mesh(U.dripG || (U.dripG = new THREE.CapsuleGeometry(0.32, 1, 4, 10).translate(0, -0.8, 0)), cream);
      drip.visible = false;
      g2.add(drip);
    }
    U.blobs.push({ m, y0: m.position.y, s, slide: 0.4 + lm % 5 * 0.12, drip, dx: (lm % 3 - 1) * 0.5 });
  }
  const world = worldRoot(THREE, g2, U.frame);
  U.world = world;
  const atlas = makeAtlas(THREE, ["dot", "smoke", "star", "glow"]);
  U.atlas = atlas;
  U.spl = new Sprites(THREE, { max: 160, atlas, blend: "normal", renderOrder: 6 });
  world.add(U.spl.mesh);
  U.tinB = new Bodies(THREE, tinG, tin.material, 2);
  world.add(U.tinB.mesh);
  U.state = "wait";
  U.k = 0;
  U.mess = 0;
  U.pop = new Spring(1, 120, 9);
  U.v = new THREE.Vector3();
  U.d = new THREE.Vector3();
  U.q = new THREE.Quaternion();
  U.q4 = [0, 0, 0, 1];
  U.eu = new THREE.Euler();
  U.down = new THREE.Vector3(0, -1, 0);
  U.showcase = false;
  return g2;
}
function splat(U) {
  const r = U.rnd, p = U.v.copy(U.hit);
  p.z -= 2;
  U.frame.toWorld(p, p);
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2, sp = 25 + r() * 55, d = U.d.set(Math.cos(a), Math.sin(a) * 0.8 + 0.2, 0.3 + r() * 0.5);
    U.frame.dirToWorld(d, d);
    U.spl.spawn((__s0["x"] = p.x, __s0["y"] = p.y, __s0["z"] = p.z, __s0["vx"] = d.x * sp, __s0["vy"] = d.y * sp, __s0["vz"] = d.z * sp, __s0["life"] = 0.6 + r() * 0.5, __s0["size"] = 0.6 + r() * 1.1, __s0["size1"] = 0.5, __s0["r"] = 1, __s0["g"] = 0.98, __s0["b"] = 0.93, __s0["a"] = 1, __s0["cell"] = U.atlas.cell.dot, __s0["drag"] = 1.5, __s0["grav"] = 240, __s0["fadeIn"] = 0.02, __s0["fadeOut"] = 0.4, __s0));
  }
  for (let i = 0; i < 6; i++) U.spl.spawn((__s1["x"] = p.x + (r() - 0.5) * 6, __s1["y"] = p.y + (r() - 0.5) * 6, __s1["z"] = p.z + 1, __s1["vx"] = (r() - 0.5) * 20, __s1["vy"] = (r() - 0.5) * 20, __s1["life"] = 0.5, __s1["size"] = 4, __s1["size1"] = 10, __s1["r"] = 1, __s1["g"] = 0.98, __s1["b"] = 0.94, __s1["a"] = 0.6, __s1["cell"] = U.atlas.cell.smoke, __s1["rot"] = r() * 6, __s1["fadeIn"] = 0.02, __s1["fadeOut"] = 0.8, __s1));
  U.eu.set(-1.2, 0, 0.3);
  U.q.setFromEuler(U.eu).premultiply(U.frame.q);
  const q4 = U.q4;
  q4[0] = U.q.x;
  q4[1] = U.q.y;
  q4[2] = U.q.z;
  q4[3] = U.q.w;
  U.tinB.spawn((__s2["x"] = p.x, __s2["y"] = p.y, __s2["z"] = p.z + 2, __s2["vx"] = (r() - 0.5) * 20, __s2["vy"] = 10, __s2["vz"] = 18, __s2["life"] = 1.4, __s2["s"] = 1, __s2["q"] = q4, __s2["wx"] = 3 + r() * 3, __s2["wy"] = (r() - 0.5) * 4, __s2["wz"] = (r() - 0.5) * 6, __s2["drag"] = 0.4, __s2["grav"] = 260, __s2));
}
function update(g2, bs, t, h) {
  const U = g2.userData;
  if (!U.frame) return;
  const dt = U.tick.tick(t);
  U.frame.update(dt);
  U.world.userData.sync();
  const e = U.expr.update(bs, dt, h);
  const fire = U.trig.update(e.jaw, dt);
  if (!U.frame.attached && !U.showcase) {
    U.showcase = true;
    U.state = "mess";
    U.mess = 0.6;
  }
  if (U.state === "wait" && fire) {
    U.state = "fly";
    U.k = 0;
  }
  const P = U.pie;
  if (U.state === "wait") {
    const s = Math.max(1e-3, U.pop.step(dt, 1));
    P.visible = true;
    P.scale.setScalar(s * 0.95);
    P.position.set(U.wait.x + Math.sin(t * 1.3) * 0.4, U.wait.y + Math.sin(t * 2.1) * 0.6, U.wait.z);
    P.rotation.set(1.25 + Math.sin(t * 1.7) * 0.06, -0.55, 0.25 + Math.sin(t * 1.1) * 0.05);
  } else if (U.state === "fly") {
    U.k += dt / 0.32;
    const k = Math.min(1, U.k), e2 = k * k;
    P.position.lerpVectors(U.wait, U.hit, e2);
    P.position.y += Math.sin(k * Math.PI) * 2.5;
    P.rotation.set(1.25 + 0.32 * k, -0.55 - (Math.PI - 0.55) * e2, 0.25 * (1 - k));
    P.scale.setScalar(0.95 + 0.25 * k);
    if (k >= 1) {
      U.state = "mess";
      U.mess = 0;
      splat(U);
    }
  } else if (U.state === "mess") {
    U.mess += dt;
    const m = U.mess;
    P.visible = m < 0.12;
    P.scale.set(1.3, 1.3 * (1 - m * 5), 1.3);
    if (m > 3.6) {
      U.state = "wait";
      U.pop.x = 0;
      U.pop.v = 0;
    }
  }
  const on = U.state === "mess";
  for (let i = 0; i < U.blobs.length; i++) {
    const B = U.blobs[i];
    B.m.visible = on;
    if (B.drip && !on) B.drip.visible = false;
    if (!on) continue;
    const m = U.mess, inS = easeOutBack(clamp(m / 0.18)), out = clamp((m - 2.9) / 0.6);
    const s = B.s * inS * (1 - out * out);
    B.m.scale.set(s, s * (1 + Math.min(0.35, m * 0.08)), s);
    B.m.position.y = B.y0 - m * B.slide;
    if (B.drip) {
      B.drip.visible = s > 0.05;
      B.drip.position.set(B.m.position.x + B.dx, B.m.position.y - s * 0.6, B.m.position.z + 0.2);
      B.drip.scale.set(s * 0.9, (0.4 + Math.min(2.2, m * 1.4)) * inS * (1 - out), s * 0.9);
    }
  }
  U.spl.update(dt, U.down);
  U.tinB.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
