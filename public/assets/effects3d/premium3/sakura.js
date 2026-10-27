// Tiditalk — effetto viso 3D "sakura" (premium3). Codice originale, AGPL-3.0. GENERATO da _src/fx/sakura.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

// lib/core.js
var clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
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
var _RQ = [0, 0, 0, 1];
function randQuat(r = Math.random, out = _RQ) {
  const u1 = r(), u2 = r() * 6.2831853, u3 = r() * 6.2831853, a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
  out[0] = a * Math.sin(u2);
  out[1] = a * Math.cos(u2);
  out[2] = b * Math.sin(u3);
  out[3] = b * Math.cos(u3);
  return out;
}
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
function taperTube(THREE, curve, { segs = 48, radial = 12, r = () => 1, sx = 1, sy = 1, capStart = true, capEnd = true, twist = 0 } = {}) {
  const fr = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uv = [], idx = [];
  const P = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), n = new THREE.Vector3();
  const L = curve.getLength();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    T.copy(fr.tangents[i]);
    N.copy(fr.normals[i]);
    B.copy(fr.binormals[i]);
    const rr = r(t), dr = (r(Math.min(1, t + 0.01)) - r(Math.max(0, t - 0.01))) / (0.02 * L);
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2 + twist * t, c = Math.cos(a), s = Math.sin(a);
      n.set(0, 0, 0).addScaledVector(N, c * sx).addScaledVector(B, s * sy);
      pos.push(P.x + n.x * rr, P.y + n.y * rr, P.z + n.z * rr);
      n.set(0, 0, 0).addScaledVector(N, c / sx).addScaledVector(B, s / sy).normalize().addScaledVector(T, -dr).normalize();
      nor.push(n.x, n.y, n.z);
      uv.push(j / radial, t);
    }
  }
  const R = radial + 1;
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * R + j, b = (i + 1) * R + j, c = (i + 1) * R + j + 1, d = i * R + j + 1;
    idx.push(a, d, b, b, d, c);
  }
  const cap = (i, sign) => {
    const t = i / segs;
    curve.getPointAt(t, P);
    T.copy(fr.tangents[i]).multiplyScalar(sign);
    const c0 = pos.length / 3;
    pos.push(P.x, P.y, P.z);
    nor.push(T.x, T.y, T.z);
    uv.push(0.5, t);
    const base = pos.length / 3;
    for (let j = 0; j <= radial; j++) {
      const k = (i * R + j) * 3;
      pos.push(pos[k], pos[k + 1], pos[k + 2]);
      nor.push(T.x, T.y, T.z);
      uv.push(j / radial, t);
    }
    for (let j = 0; j < radial; j++) sign > 0 ? idx.push(c0, base + j, base + j + 1) : idx.push(c0, base + j + 1, base + j);
  };
  if (capStart && r(0) > 1e-3) cap(0, -1);
  if (capEnd && r(1) > 1e-3) cap(segs, 1);
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g2.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g2.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g2.setIndex(idx);
  return g2;
}
function merge(THREE, list) {
  const withColor = list.some((g2) => g2.attributes.color);
  const P = [], N = [], U = [], C = [], I = [];
  let off = 0;
  for (let g2 of list) {
    if (!g2.attributes.normal) g2.computeVertexNormals();
    const p = g2.attributes.position, n = g2.attributes.normal, u = g2.attributes.uv, c = g2.attributes.color;
    for (let i = 0; i < p.count; i++) {
      P.push(p.getX(i), p.getY(i), p.getZ(i));
      N.push(n.getX(i), n.getY(i), n.getZ(i));
      if (u) U.push(u.getX(i), u.getY(i));
      else U.push(0, 0);
      if (withColor) {
        if (c) C.push(c.getX(i), c.getY(i), c.getZ(i));
        else C.push(1, 1, 1);
      }
    }
    if (g2.index) for (let i = 0; i < g2.index.count; i++) I.push(g2.index.getX(i) + off);
    else for (let i = 0; i < p.count; i++) I.push(i + off);
    off += p.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  m.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  m.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  if (withColor) m.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  m.setIndex(off > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
  return m;
}
function paintVerts(THREE, g2, fn) {
  const p = g2.attributes.position, n = g2.attributes.normal, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const c = fn(p.getX(i), p.getY(i), p.getZ(i), n ? n.getX(i) : 0, n ? n.getY(i) : 0, n ? n.getZ(i) : 0);
    a[i * 3] = c[0];
    a[i * 3 + 1] = c[1];
    a[i * 3 + 2] = c[2];
  }
  g2.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g2;
}

// fx/sakura.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "s": void 0, "q": void 0, "wx": void 0, "wy": void 0, "wz": void 0, "drag": void 0, "grav": void 0, "flut": void 0, "color": void 0, "grow": void 0 };
var meta = { label: "Fiori di ciliegio", labelEn: "Cherry blossoms", labelFr: "Fleurs de cerisier", labelDe: "Kirschbl\xFCten", category: "divertenti", icon: "\u{1F338}" };
function petalGeo(THREE, cup = 0.35) {
  const s = new THREE.Shape(), N = 48;
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2, y0 = (1 - Math.cos(a)) / 2;
    let w = Math.sin(a) * 0.38 * Math.pow(Math.sin(Math.PI * Math.min(1, y0 * 0.92 + 0.04)), 0.7);
    const tip = clamp((y0 - 0.8) / 0.2);
    const y = y0 - 0.13 * tip * tip * clamp(1 - Math.abs(w) / 0.13);
    s[i ? "lineTo" : "moveTo"](w, y);
  }
  const g2 = new THREE.ShapeGeometry(s, 10);
  const p = g2.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, -cup * x * x * 3 + 0.18 * y * y);
  }
  g2.computeVertexNormals();
  paintVerts(THREE, g2, (x, y) => {
    const k = clamp(y * 1.3);
    return [0.98, 0.32 + 0.48 * k, 0.5 + 0.36 * k];
  });
  return g2;
}
function flowerGeo(THREE, petal2, open = 1) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const p = petal2.clone();
    p.rotateX(-0.25 - (1 - open) * 0.9);
    p.translate(0, 0.08, 0);
    p.rotateZ(i / 5 * Math.PI * 2 + 0.3);
    parts.push(p);
  }
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, r = 0.22 + i % 2 * 0.08;
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0.05), new THREE.Vector3(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 0.25), new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.42)]);
    parts.push(paintVerts(THREE, taperTube(THREE, c, { segs: 4, radial: 3, r: () => 0.018, capStart: false, capEnd: false }), () => [1, 0.75, 0.82]));
    const an = new THREE.SphereGeometry(0.045, 5, 4);
    an.translate(Math.cos(a) * r, Math.sin(a) * r, 0.44);
    parts.push(paintVerts(THREE, an, () => [1, 0.78, 0.15]));
  }
  const ctr = new THREE.SphereGeometry(0.12, 8, 6);
  ctr.scale(1, 1, 0.5);
  parts.push(paintVerts(THREE, ctr, () => [0.75, 0.12, 0.3]));
  return merge(THREE, parts);
}
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.expr = new Expr(["smile"]);
  U.rnd = rng(251);
  U.trig = new Trigger({ on: 0.55, off: 0.3, cooldown: 1.2 });
  const sprig = new THREE.Group();
  sprig.position.set(7.11, 7.66, 2.34);
  sprig.rotation.set(-0.35, -0.5, -0.55);
  sprig.scale.setScalar(1.45);
  g2.add(sprig);
  U.sprig = sprig;
  const bark = new THREE.MeshStandardMaterial({ color: 4860962, roughness: 0.85, transparent: true });
  const main = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.5, -2.2, 0), new THREE.Vector3(0, 0, 0.3), new THREE.Vector3(1.6, 2.6, 0.1), new THREE.Vector3(2.4, 5.4, -0.4), new THREE.Vector3(2.2, 8.2, -0.9)]);
  sprig.add(new THREE.Mesh(taperTube(THREE, main, { segs: 40, radial: 8, r: (t) => 0.42 - t * 0.3 }), bark));
  const twig = new THREE.CatmullRomCurve3([new THREE.Vector3(1.2, 2, 0.15), new THREE.Vector3(3.4, 3.4, 0.4), new THREE.Vector3(5.2, 4.1, 0.2)]);
  sprig.add(new THREE.Mesh(taperTube(THREE, twig, { segs: 20, radial: 6, r: (t) => 0.22 - t * 0.14 }), bark));
  const petal2 = petalGeo(THREE);
  const flowerMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(1, 0.6, 0.75), side: THREE.DoubleSide, transparent: true });
  const fOpen = flowerGeo(THREE, petal2, 1), fHalf = flowerGeo(THREE, petal2, 0.45);
  const SPOTS = [[0.1, 0.2, 0.6, 1.35, 1], [1.8, 2.9, 0.7, 1.2, 1], [2.6, 5, 0.3, 1.25, 1], [4, 3.9, 0.6, 1.05, 1], [5.4, 4.2, 0.4, 0.8, 0], [2.3, 7.4, -0.3, 0.75, 0], [-0.9, -1, 0.5, 1.1, 1]];
  U.flowers = [];
  for (const [x, y, z, s, open] of SPOTS) {
    const f = new THREE.Mesh(open ? fOpen : fHalf, flowerMat);
    f.position.set(x, y, z);
    f.scale.setScalar(s * 1.55);
    f.rotation.set(Math.sin(x * 3) * 0.4, Math.cos(y * 2) * 0.5, x * 0.7);
    sprig.add(f);
    U.flowers.push({ f, r0: f.rotation.clone(), sp: new Spring(0, 70, 5), ph: x + y });
  }
  const budMat = new THREE.MeshStandardMaterial({ color: 15755930, roughness: 0.5, transparent: true });
  for (const [x, y, z] of [[3, 6.3, -0.4], [5, 3.6, 0.6], [-1.3, -1.9, 0.3]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8).scale(0.8, 1.2, 0.8), budMat);
    b.position.set(x, y, z);
    sprig.add(b);
  }
  const world = worldRoot(THREE, g2, U.frame);
  U.world = world;
  const pm = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, sheen: 0.35, sheenColor: new THREE.Color(1, 0.6, 0.75), side: THREE.DoubleSide, transparent: true });
  U.petals = new Bodies(THREE, petal2, pm, 120);
  world.add(U.petals.mesh);
  const atlas = makeAtlas(THREE, ["glow", "spark"]);
  U.atlas = atlas;
  U.spr = new Sprites(THREE, { max: 40, atlas, blend: "add" });
  world.add(U.spr.mesh);
  U.cols = [new THREE.Color(1, 0.95, 0.97), new THREE.Color(1, 0.82, 0.9), new THREE.Color(1, 0.7, 0.82)];
  U.v = new THREE.Vector3();
  U.d = new THREE.Vector3();
  U.c = new THREE.Vector3();
  U.down = new THREE.Vector3(0, -1, 0);
  U.acc = 0;
  U.swirl = 0;
  U.showcase = false;
  return g2;
}
function petal(U, x, y, z, vx, vy, vz, big) {
  const r = U.rnd;
  U.petals.spawn((__s0["x"] = x, __s0["y"] = y, __s0["z"] = z, __s0["vx"] = vx, __s0["vy"] = vy, __s0["vz"] = vz, __s0["life"] = 5 + r() * 2, __s0["s"] = (big ? 2.2 : 1.7) + r() * 0.7, __s0["q"] = randQuat(r), __s0["wx"] = (r() - 0.5) * 6, __s0["wy"] = (r() - 0.5) * 6, __s0["wz"] = (r() - 0.5) * 6, __s0["drag"] = 2.6, __s0["grav"] = 22, __s0["flut"] = 7 + r() * 7, __s0["color"] = U.cols[r() * 3 | 0], __s0["grow"] = 0.03, __s0));
}
function swirl(U) {
  const r = U.rnd, cw = U.c;
  U.frame.toWorld(cw.set(0, 0, -3), cw);
  for (let i = 0; i < 46; i++) {
    const a = i / 46 * Math.PI * 2 + r() * 0.2, R = 13 + r() * 5;
    const p = U.v.set(Math.cos(a) * R, -10 + r() * 6, -3 + Math.sin(a) * R);
    U.frame.toWorld(p, p);
    const d = U.d.set(-Math.sin(a), 0, Math.cos(a));
    U.frame.dirToWorld(d, d);
    const sp = 30 + r() * 15;
    petal(U, p.x, p.y, p.z, d.x * sp, 22 + r() * 18, d.z * sp, true);
  }
  U.swirl = 1.6;
  for (const F of U.flowers) F.sp.v += 6 + r() * 4;
}
function update(g2, bs, t, h) {
  const U = g2.userData;
  if (!U.frame) return;
  const dt = U.tick.tick(t);
  U.frame.update(dt);
  U.world.userData.sync();
  const e = U.expr.update(bs, dt, h);
  if (!U.frame.attached && !U.showcase) {
    U.showcase = true;
    for (let k = 0; k < 24; k++) {
      const r = U.rnd;
      petal(U, (r() - 0.5) * 46, -12 + r() * 36, -4 + r() * 14, 0, -3, 0, r() < 0.5);
    }
    for (let k = 0; k < 5; k++) U.petals.update(1 / 30, U.down);
  }
  if (U.trig.update(e.smile, dt)) swirl(U);
  U.acc += dt * 6;
  while (U.acc >= 1) {
    U.acc -= 1;
    const r = U.rnd, p = U.v.set((r() - 0.5) * 60, 24 + r() * 8, -12 + r() * 24);
    U.frame.toWorld(p, p);
    petal(U, p.x, p.y, p.z, (r() - 0.5) * 5, -5, (r() - 0.5) * 4, false);
  }
  U.swirl = Math.max(0, U.swirl - dt);
  if (U.swirl > 0) {
    const P = U.petals, c = U.c, k = Math.min(1, U.swirl) * 60 * dt;
    for (let i = 0; i < P.n; i++) {
      const dx = P.p[i * 3] - c.x, dz = P.p[i * 3 + 2] - c.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
      if (d > 30) continue;
      P.v[i * 3] += -dz / d * k;
      P.v[i * 3 + 2] += dx / d * k;
    }
  }
  for (let i = 0; i < U.flowers.length; i++) {
    const F = U.flowers[i], w = F.sp.step(dt, 0);
    F.f.rotation.set(F.r0.x + w * 0.1, F.r0.y + Math.sin(t * 1.3 + F.ph) * 0.04, F.r0.z + w * 0.12);
  }
  U.sprig.rotation.z = -0.55 + Math.sin(t * 0.9) * 0.02;
  U.petals.update(dt, U.down);
  U.spr.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
