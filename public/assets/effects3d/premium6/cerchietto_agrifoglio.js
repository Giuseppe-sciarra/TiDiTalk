// Tiditalk — effetto viso 3D "cerchietto_agrifoglio" (premium6). Codice originale, AGPL-3.0. GENERATO da _src/fx/cerchietto_agrifoglio.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

// lib/head.js
var HULL = { c: [0, 2.4, -4], r: [8.1, 11.6, 9.9] };
var clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
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
function arcAt(a, tau, off, P, N) {
  const c = HULL.c, r = HULL.r;
  const dx = Math.sin(a), dy = Math.cos(a) * Math.cos(tau), dz = Math.cos(a) * Math.sin(tau);
  N.set(dx / r[0], dy / r[1], dz / r[2]).normalize();
  P.set(c[0] + r[0] * dx, c[1] + r[1] * dy, c[2] + r[2] * dz);
  if (off) P.addScaledVector(N, off);
  return P;
}
function arcBand(THREE, { a0 = 1.42, tau = 0.12, off = 0.3, w = 1.2, t = 0.35, segs = 90, sec = 16, taper = 0.06, wFn = null } = {}) {
  const P = new THREE.Vector3(), N = new THREE.Vector3(), Q = new THREE.Vector3(), N2 = new THREE.Vector3(), T = new THREE.Vector3(), B = new THREE.Vector3();
  const geo = grid(THREE, sec, segs, (i, j, out) => {
    const u = j / segs, a = -a0 + 2 * a0 * u;
    arcAt(a, tau, off, P, N);
    arcAt(a + 0.01, tau, off, Q, N2);
    T.subVectors(Q, P).normalize();
    B.crossVectors(N, T).normalize();
    const end = Math.min(u, 1 - u), k = taper > 0 ? Math.sqrt(clamp(end / taper)) : 1;
    const ww = (wFn ? wFn(u) : w) * (0.35 + 0.65 * k), tt = t * (0.6 + 0.4 * k);
    const ang = i / sec * Math.PI * 2, cs = Math.cos(ang), sn = Math.sin(ang), e = 0.45;
    const sx = Math.sign(cs) * Math.pow(Math.abs(cs), e), sy = Math.sign(sn) * Math.pow(Math.abs(sn), e);
    out.copy(P).addScaledVector(B, sx * ww / 2).addScaledVector(N, sy * tt / 2 + tt / 2);
  }, { uRep: 1, vRep: 1, flip: true });
  return geo;
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

// lib/mats.js
function metal(THREE, color = 13936202, o = {}) {
  return new THREE.MeshPhysicalMaterial(Object.assign({ color: new THREE.Color(color), metalness: 1, roughness: 0.22, envMapIntensity: 1.2, transparent: true }, o));
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

// fx/cerchietto_agrifoglio.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "rot": void 0, "spin": void 0, "cell": void 0, "wob": void 0, "wf": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var meta = { label: "Cerchietto di agrifoglio", labelEn: "Holly headband", labelFr: "Serre-t\xEAte de houx", labelDe: "Stechpalmen-Haarreif", category: "accessori", icon: "\u{1F384}" };
function hollyGeo(THREE, L = 4.6, W = 2.1) {
  const s = new THREE.Shape();
  const sp = 4;
  const half = (side) => {
    const pts = [];
    for (let i = 0; i <= sp; i++) {
      const t = i / sp, y = -L / 2 + t * L, w = W / 2 * Math.sin(Math.min(1, t * 1.05 + 0.08) * Math.PI) * (i === 0 ? 0.15 : 1);
      pts.push([side * w * (i === sp ? 0 : 1.08), y + (i === sp ? 0.25 : 0)]);
    }
    return pts;
  };
  const R = half(1), Lh = half(-1).reverse();
  s.moveTo(0, -L / 2 - 0.3);
  let prev = [0, -L / 2];
  for (const p2 of R) {
    const mx = (prev[0] + p2[0]) / 2, my = (prev[1] + p2[1]) / 2;
    s.quadraticCurveTo(mx * 0.62, my, p2[0], p2[1]);
    prev = p2;
  }
  for (const p2 of Lh) {
    const mx = (prev[0] + p2[0]) / 2, my = (prev[1] + p2[1]) / 2;
    s.quadraticCurveTo(mx * 0.62, my, p2[0], p2[1]);
    prev = p2;
  }
  s.quadraticCurveTo(0, -L / 2 + 0.1, 0, -L / 2 - 0.3);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 6, steps: 1 });
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const fold = 0.28 * Math.abs(x), curl = -0.06 * y * y, wav = 0.18 * Math.sin(y * 3.1) * Math.abs(x) / (W / 2);
    p.setZ(i, z + fold + curl + wav);
    const c = Math.abs(x) < 0.07 ? 1.6 : 0.78 + 0.22 * (1 - Math.abs(x) / (W / 2));
    col[i * 3] = c * 0.95;
    col[i * 3 + 1] = c;
    col[i * 3 + 2] = c * 0.9;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}
async function build(THREE, h) {
  const g2 = new THREE.Group();
  g2.name = "cerchietto_agrifoglio";
  const TAU2 = 0.5;
  const velvet = new THREE.MeshPhysicalMaterial({ color: 1455391, roughness: 0.75, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(6262626), envMapIntensity: 0.5, transparent: true });
  g2.add(new THREE.Mesh(arcBand(THREE, { a0: 1.4, tau: TAU2, off: 0.22, w: 1.6, t: 0.5 }), velvet));
  const leafM = new THREE.MeshPhysicalMaterial({ color: 1919012, vertexColors: true, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.9, side: THREE.DoubleSide, transparent: true });
  const berryM = new THREE.MeshPhysicalMaterial({ color: 11538716, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true });
  const dotM = new THREE.MeshStandardMaterial({ color: 1707272, roughness: 0.8, transparent: true });
  const needleM = new THREE.MeshStandardMaterial({ color: 2310954, roughness: 0.7, transparent: true });
  const twigM = new THREE.MeshStandardMaterial({ color: 5913122, roughness: 0.9, transparent: true });
  const leafG = hollyGeo(THREE), leafS = hollyGeo(THREE, 3.6, 1.7);
  const berryG = new THREE.SphereGeometry(0.42, 18, 12), dotG = new THREE.SphereGeometry(0.075, 6, 4);
  const P = new THREE.Vector3(), N = new THREE.Vector3(), Q = new THREE.Vector3(), N2 = new THREE.Vector3();
  const cluster = (a, items) => {
    arcAt(a, TAU2, 0.55, P, N);
    arcAt(a + 0.02, TAU2, 0.55, Q, N2);
    const grp = new THREE.Group();
    grp.position.copy(P);
    const Nf = N.clone().lerp(new THREE.Vector3(Math.sign(a) * 0.45, 0, 1).normalize(), 0.45).normalize();
    const up = Q.clone().sub(P).projectOnPlane(Nf).normalize(), side = new THREE.Vector3().crossVectors(up, Nf).normalize();
    grp.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, Nf));
    grp.scale.setScalar(1.35);
    for (const it of items) {
      if (it.t === "leaf") {
        const m = new THREE.Mesh(it.s ? leafS : leafG, leafM);
        m.position.set(it.x, it.y, it.z || 0.1);
        m.rotation.set(it.rx || -0.25, it.ry || 0, it.a);
        grp.add(m);
      } else if (it.t === "berry") {
        const m = new THREE.Mesh(berryG, berryM);
        m.position.set(it.x, it.y, it.z || 0.65);
        grp.add(m);
        const d = new THREE.Mesh(dotG, dotM);
        d.position.set(it.x + 0.05, it.y + 0.08, (it.z || 0.65) + 0.4);
        grp.add(d);
      } else if (it.t === "pine") {
        const len = it.len || 4.5;
        const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, len, 5), twigM);
        twig.position.set(it.x, it.y, 0.05);
        twig.rotation.z = it.a;
        grp.add(twig);
        const ng = new THREE.CylinderGeometry(0.03, 0.035, 1.05, 4);
        ng.translate(0, 0.52, 0);
        const inst = new THREE.InstancedMesh(ng, needleM, 70);
        const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), pp = new THREE.Vector3();
        for (let i = 0; i < 70; i++) {
          const tt = (i / 70 - 0.5) * len * 0.95, side2 = i % 2 ? 1 : -1;
          pp.set(it.x - Math.sin(it.a) * tt, it.y + Math.cos(it.a) * tt, 0.08 + i % 3 * 0.05);
          e.set((i % 3 - 1) * 0.5, 0, it.a + side2 * (0.9 + 0.25 * Math.sin(i)));
          q.setFromEuler(e);
          sc.set(1, 0.75 + 0.3 * Math.sin(i * 1.7) * (1 - Math.abs(tt) / len), 1);
          M4.compose(pp, q, sc);
          inst.setMatrixAt(i, M4);
        }
        grp.add(inst);
      }
    }
    g2.add(grp);
    return grp;
  };
  const main = cluster(0.5, [
    { t: "pine", x: 0.2, y: 0.2, a: 0.9, len: 5 },
    { t: "pine", x: -0.3, y: -0.2, a: -0.7, len: 4.2 },
    { t: "leaf", x: 1.3, y: 1.2, a: -0.85 },
    { t: "leaf", x: -1.4, y: 1, a: 0.95 },
    { t: "leaf", x: 1.1, y: -1.3, a: -2.3 },
    { t: "leaf", x: -1.2, y: -1.2, a: 2.25 },
    { t: "leaf", s: 1, x: 0.1, y: 1.75, a: 0.1, rx: -0.5 },
    { t: "berry", x: 0, y: 0.1 },
    { t: "berry", x: 0.62, y: -0.35, z: 0.55 },
    { t: "berry", x: -0.55, y: -0.28, z: 0.58 },
    { t: "berry", x: 0.15, y: -0.75, z: 0.5 }
  ]);
  cluster(-0.58, [{ t: "leaf", s: 1, x: 0.8, y: 0.3, a: -1.1 }, { t: "leaf", s: 1, x: -0.8, y: 0.2, a: 1.15 }, { t: "berry", x: 0, y: 0, z: 0.5 }]);
  const bellM = metal(THREE, 13936192, { roughness: 0.18 });
  const bellPiv = new THREE.Group();
  bellPiv.position.set(0.3, -1.6, 0.6);
  main.add(bellPiv);
  const bell = new THREE.Group();
  bellPiv.add(bell);
  const bg = new THREE.LatheGeometry([[0.05, 0], [0.32, -0.05], [0.5, -0.25], [0.6, -0.6], [0.66, -0.95], [0.78, -1.15], [0.8, -1.22], [0, -1.22]].reverse().map(([x, y]) => new THREE.Vector2(x, y)), 24);
  const b = new THREE.Mesh(bg, bellM);
  b.position.y = -0.55;
  bell.add(b);
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 16), bellM);
  ringM.position.y = -0.35;
  bell.add(ringM);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4), new THREE.MeshStandardMaterial({ color: 9050650, transparent: true }));
  cord.position.y = -0.15;
  bell.add(cord);
  const U = g2.userData;
  U.frame = new HeadFrame(THREE, bellPiv);
  U.root = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.ex = new Expr(["smile"]);
  U.trig = new Trigger({ on: 0.58, off: 0.3, hold: 0.1, cooldown: 1.2 });
  U.bell = bell;
  U.d = new Dangle(THREE, 1.4, { damping: 0.93, stiff: 30, grav: 900 });
  U.ring = new Spring(0, 400, 3);
  U.world = worldRoot(THREE, g2, U.root);
  U.atlas = makeAtlas(THREE, ["flake", "dot"]);
  U.snow = new Sprites(THREE, { max: 90, atlas: U.atlas, blend: "normal", renderOrder: 5 });
  U.world.add(U.snow.mesh);
  U.snowT = 0;
  U.pw = new THREE.Vector3();
  U.rw = new THREE.Vector3();
  U.dl = new THREE.Vector3();
  U.down = new THREE.Vector3(0, -1, 0);
  U.zero = new THREE.Vector3();
  U.rest = new THREE.Vector3(0, -1, 0);
  U.Ym = new THREE.Vector3(0, -1, 0);
  U.sp = new THREE.Vector3();
  return g2;
}
function update(g2, bs, t, h) {
  const U = g2.userData, dt = U.tick.tick(t);
  const v = U.ex.update(bs, dt, h);
  U.frame.update(dt);
  U.root.update(dt);
  U.world.userData.sync();
  if (U.trig.update(v.smile, dt)) {
    U.ring.v += 30;
    U.snowT = 4;
  }
  U.frame.toWorld(U.zero, U.pw);
  U.frame.dirToWorld(U.rest, U.rw);
  const dw = U.d.step(dt, U.pw, U.down, U.down);
  U.frame.dirToLocal(dw, U.dl);
  U.bell.quaternion.setFromUnitVectors(U.Ym, U.dl);
  const r = U.ring.step(dt, 0);
  U.bell.rotateZ(r * 0.05);
  U.bell.rotateX(r * 0.02);
  if (U.snowT > 0) {
    U.snowT -= dt;
    if (Math.random() < dt * 22) {
      U.sp.set((Math.random() - 0.5) * 34, 22 + Math.random() * 4, (Math.random() - 0.3) * 14);
      U.root.toWorld(U.sp, U.pw);
      U.snow.spawn((__s0["x"] = U.pw.x, __s0["y"] = U.pw.y, __s0["z"] = U.pw.z, __s0["vx"] = (Math.random() - 0.5) * 2, __s0["vy"] = -5 - Math.random() * 3, __s0["vz"] = 0, __s0["life"] = 4.5, __s0["size"] = 0.6 + Math.random() * 0.7, __s0["r"] = 1, __s0["g"] = 1, __s0["b"] = 1, __s0["a"] = 0.9, __s0["rot"] = Math.random() * 6, __s0["spin"] = (Math.random() - 0.5) * 2, __s0["cell"] = Math.random() < 0.7 ? U.atlas.cell.flake : U.atlas.cell.dot, __s0["wob"] = 1.6, __s0["wf"] = 2, __s0["fadeIn"] = 0.15, __s0["fadeOut"] = 0.3, __s0));
    }
  }
  U.snow.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
