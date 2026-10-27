// Tiditalk — effetto viso 3D "berretto_orsetto" (premium5). Codice originale, AGPL-3.0. GENERATO da _src/fx/berretto_orsetto.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

// lib/core.js
var clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
var smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
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
    this.v = clamp((x - this.b) / Math.max(0.3, 1 - this.b));
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
function knitNormal(THREE, repeat = [16, 10], strength = 4) {
  const H = heightField(64, 64, (u, v) => {
    const cx = u * 2 % 1, row = v * 2 % 1;
    const side = cx < 0.5 ? cx * 2 : (1 - cx) * 2;
    const lean = Math.abs((row + (cx < 0.5 ? cx : 1 - cx) * 0.9) % 1 - 0.5) * 2;
    return Math.pow(Math.sin(side * Math.PI * 0.5), 0.7) * (1 - 0.6 * Math.pow(lean, 3));
  });
  return normalFromHeight(THREE, H, 64, 64, strength, repeat);
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

// lib/geo.js
function taperTube(THREE, curve, { segs = 48, radial = 12, r = () => 1, sx = 1, sy = 1, capStart = true, capEnd = true, twist = 0, rf = null } = {}) {
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
      const a = j / radial * Math.PI * 2 + twist * t, c = Math.cos(a), s = Math.sin(a), k = rf ? rf(a, t) : 1;
      n.set(0, 0, 0).addScaledVector(N, c * sx).addScaledVector(B, s * sy);
      pos.push(P.x + n.x * rr * k, P.y + n.y * rr * k, P.z + n.z * rr * k);
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
var Band = class {
  constructor({ R = 9.3, top = 14.9, y0 = 5, z0 = -3.2, zt = 0.9 } = {}) {
    Object.assign(this, { R, top, y0, z0, zt });
  }
  at(a, out) {
    return out.set(Math.sin(a) * this.R, this.y0 + Math.cos(a) * (this.top - this.y0), this.z0 - Math.cos(a) * this.zt);
  }
  // normale verso fuori (nel piano dell'arco)
  nrm(a, out) {
    return out.set(Math.sin(a) / this.R, Math.cos(a) / (this.top - this.y0), 0).normalize();
  }
  mesh(THREE, mat, { r = 0.42, sx = 1.9, sy = 0.62, a0 = 1.5, segs = 90 } = {}) {
    const P = [];
    for (let i = 0; i <= 44; i++) {
      const a = -a0 + i / 44 * 2 * a0;
      P.push(this.at(a, new THREE.Vector3()));
    }
    const geo = taperTube(THREE, new THREE.CatmullRomCurve3(P), { segs, radial: 12, r: (t) => r * (t < 0.04 ? 0.6 + t * 10 : t > 0.96 ? 0.6 + (1 - t) * 10 : 1), sx, sy });
    return new THREE.Mesh(geo, mat);
  }
};
var Swing = class {
  constructor(THREE, obj, { len = 4, stiff = 300, damping = 0.86, grav = 400 } = {}) {
    this.obj = obj;
    this.qBase = obj.quaternion.clone();
    this.d = new Dangle(THREE, len, { damping, stiff, grav });
    this.pw = new THREE.Vector3();
    this.rw = new THREE.Vector3();
    this.rl = new THREE.Vector3();
    this.dl = new THREE.Vector3();
    this.q = new THREE.Quaternion();
    this.Y = new THREE.Vector3(0, 1, 0);
    this.off = new THREE.Vector3();
  }
  // frame: HeadFrame; down: gravità nel mondo; pivotLocal: posizione del perno nello spazio del gruppo
  step(dt, frame, down, pivotLocal) {
    this.rl.copy(this.Y).applyQuaternion(this.qBase);
    frame.toWorld(pivotLocal, this.pw);
    frame.dirToWorld(this.rl, this.rw);
    const dw = this.d.step(dt, this.pw, this.rw, down);
    frame.dirToLocal(dw, this.dl).normalize();
    this.q.setFromUnitVectors(this.rl, this.dl);
    this.obj.quaternion.copy(this.qBase).premultiply(this.q);
  }
  // nelle miniature (nessun genitore): posa di riposo, senza gravità
  rest() {
    this.obj.quaternion.copy(this.qBase);
    this.d.init = false;
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

// lib/earband.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "rot": void 0, "drag": void 0, "wob": void 0, "wf": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s1 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "spin": void 0 };
function buildEarband(THREE, h, spec) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  const M = new Mats(THREE);
  U.spec = spec;
  U.M = M;
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.expr = new Expr(["smile", "browUp", "frown"]);
  U.rnd = rng(spec.seed || 17);
  const band = U.band = new Band(spec.bandGeo || {});
  let mount = null;
  if (spec.base) mount = spec.base(THREE, M, g2, U);
  else {
    const bandMat = spec.band.mat || M.plush(spec.band.color, spec.band.opt || {});
    const bm = band.mesh(THREE, bandMat, { r: spec.band.r || 0.42, sx: spec.band.sx || 1.9, sy: spec.band.sy || 0.62, a0: spec.band.a0 || 1.62 });
    g2.add(bm);
    U.bandMesh = bm;
  }
  const Y = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3(), p = new THREE.Vector3();
  U.ears = [];
  for (const side of [-1, 1]) {
    if (mount) mount(side, p, n);
    else {
      const a = side * (spec.earA ?? 0.62);
      band.at(a, p);
      band.nrm(a, n);
    }
    const piv = new THREE.Group();
    piv.position.copy(p).addScaledVector(n, spec.earSink ?? -0.1);
    if (spec.earZ) piv.position.z += spec.earZ;
    const tilt = new THREE.Vector3().copy(n);
    tilt.x *= spec.earSplay ?? 1;
    tilt.normalize();
    piv.quaternion.setFromUnitVectors(Y, tilt);
    if (spec.earYaw) piv.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(Y, -side * spec.earYaw));
    const ear = spec.earFactory(THREE, M, side, U);
    piv.add(ear.obj);
    g2.add(piv);
    const sw = new Swing(THREE, piv, Object.assign({ len: 2.6, stiff: 520, damping: 0.86, grav: 140 }, spec.swing || {}));
    U.ears.push({ side, piv, ear, sw, q0: piv.quaternion.clone(), pos: piv.position.clone(), tw: new Spring(0, 320, 7), next: 0.8 + U.rnd() * 2.5 });
  }
  const world = worldRoot(THREE, g2, U.frame);
  U.world = world;
  U.atlas = makeAtlas(THREE, spec.sprites || ["heart", "spark", "glow", "star"], { extra: spec.atlasExtra || {} });
  U.sp = new Sprites(THREE, { max: 60, atlas: U.atlas, blend: "normal", renderOrder: 5 });
  U.gl = new Sprites(THREE, { max: 40, atlas: U.atlas, blend: "add", renderOrder: 6 });
  world.add(U.sp.mesh, U.gl.mesh);
  U.tmp = { e: new THREE.Euler(), q: new THREE.Quaternion(), v: new THREE.Vector3(), w: new THREE.Vector3() };
  if (spec.deco) spec.deco(THREE, M, g2, band, U);
  U.smileT = new Trigger({ on: 0.5, off: 0.3, cooldown: 0.6 });
  U.relUp = new Rel();
  U.relFr = new Rel();
  U.perk = 0;
  U.sad = 0;
  U.happy = 0;
  U.wig = new Spring(0, 260, 5);
  U.down = new THREE.Vector3(0, -1, 0);
  U.showcase = false;
  U.heartT = 0;
  return g2;
}
var HC = [[1, 0.42, 0.62], [1, 0.62, 0.75], [1, 0.3, 0.45], [1, 0.78, 0.4]];
function updateEarband(g2, bs, t, h) {
  const U = g2.userData;
  if (!U.frame) return;
  const S = U.spec, dt = U.tick.tick(t);
  U.frame.update(dt);
  U.world.userData.sync();
  const e = U.expr.update(bs, dt, h);
  const show = !U.frame.attached;
  const rUp = U.relUp.update(e.browUp, dt, U.expr.ready && !show), rFr = U.relFr.update(e.frown, dt, U.expr.ready && !show);
  const perkT = show ? 0 : smooth(0.25, 0.7, rUp);
  const sadT = show ? 0 : smooth(0.3, 0.75, rFr) * (1 - perkT);
  U.perk = damp(U.perk, perkT, 7, dt);
  U.sad = damp(U.sad, sadT, 3.5, dt);
  U.happy = damp(U.happy, show ? 0 : smooth(0.35, 0.75, e.smile), 5, dt);
  if (U.smileT.update(e.smile, dt)) {
    U.wig.v += 9;
    U.heartT = 0.9;
  }
  const wig = U.wig.step(dt, 0);
  const { e: E, q, v } = U.tmp;
  for (const R of U.ears) {
    R.next -= dt;
    if (R.next <= 0) {
      R.next = 1.4 + U.rnd() * 3.2;
      R.tw.v += (S.twitch ?? 5) * (0.6 + U.rnd() * 0.6);
    }
    const tw = R.tw.step(dt, 0);
    const s = R.side;
    const rz = -s * ((S.droop ?? 0.75) * U.sad - (S.perk ?? 0.22) * U.perk) + s * (tw * 0.12) + s * wig * 0.09 * Math.sin(t * 22);
    const rx = (S.droopFwd ?? 0.45) * U.sad - (S.perkBack ?? 0.1) * U.perk + tw * 0.05;
    E.set(rx, s * U.happy * 0.1, rz, "XYZ");
    q.setFromEuler(E);
    R.sw.qBase.copy(R.q0).multiply(q);
    if (show) {
      R.sw.rest();
    } else R.sw.step(dt, U.frame, U.down, R.pos);
    const k = 1 + 0.07 * U.perk - 0.04 * U.sad;
    R.ear.obj.scale.setScalar(k);
    if (R.ear.update) R.ear.update(U, R, dt, t);
  }
  if (S.decoUpdate) S.decoUpdate(U, dt, t, e);
  if (U.heartT > 0 && !show) {
    U.heartT -= dt;
    if (U.rnd() < dt * 9) {
      const R = U.ears[U.rnd() < 0.5 ? 0 : 1];
      U.frame.toWorld(v.set(R.pos.x * 1.05, R.pos.y + 2.5, R.pos.z + 1), U.tmp.w);
      const c = HC[U.rnd() * HC.length | 0];
      U.sp.spawn((__s0["x"] = U.tmp.w.x, __s0["y"] = U.tmp.w.y, __s0["z"] = U.tmp.w.z, __s0["vx"] = (U.rnd() - 0.5) * 4, __s0["vy"] = 8, __s0["vz"] = (U.rnd() - 0.5) * 3, __s0["life"] = 1.3, __s0["size"] = 1.1 + U.rnd() * 0.6, __s0["size1"] = 1.6, __s0["r"] = c[0], __s0["g"] = c[1], __s0["b"] = c[2], __s0["a"] = 1, __s0["cell"] = U.atlas.cell.heart, __s0["rot"] = (U.rnd() - 0.5) * 0.6, __s0["drag"] = 1.2, __s0["wob"] = 1.5, __s0["wf"] = 5, __s0["fadeIn"] = 0.1, __s0["fadeOut"] = 0.4, __s0));
      U.gl.spawn((__s1["x"] = U.tmp.w.x, __s1["y"] = U.tmp.w.y, __s1["z"] = U.tmp.w.z, __s1["vx"] = (U.rnd() - 0.5) * 6, __s1["vy"] = 5, __s1["vz"] = 0, __s1["life"] = 0.6, __s1["size"] = 1.2, __s1["size1"] = 0.2, __s1["r"] = 1, __s1["g"] = 0.9, __s1["b"] = 0.6, __s1["a"] = 0.9, __s1["cell"] = U.atlas.cell.spark, __s1["spin"] = 3, __s1));
    }
  }
  U.sp.update(dt, U.down);
  U.gl.update(dt, U.down);
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
function knitMats(THREE, base, { stripes = null, rep = [26, 9], ribRep = [70, 2] } = {}) {
  const c = canvas(128, 128), x = c.getContext("2d");
  x.fillStyle = base;
  x.fillRect(0, 0, 128, 128);
  if (stripes) stripes(x, 128);
  for (let i = 0; i < 400; i++) {
    x.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${0.03 + Math.random() * 0.04})`;
    x.fillRect(Math.random() * 128, Math.random() * 128, 2, 4);
  }
  const map = texFrom(THREE, c, { repeat: rep });
  const nrm = knitNormal(THREE, rep, 3.5);
  const ribN = knitNormal(THREE, ribRep, 4);
  return { map, nrm, ribN };
}

// fx/berretto_orsetto.js
var meta = { label: "Berretto orsetto", labelEn: "Teddy bear beanie", category: "accessori", icon: "\u{1F9F8}" };
function build(THREE, h) {
  const dome = new Dome();
  return buildEarband(THREE, h, {
    seed: 91,
    base(THREE2, M, g2, U) {
      const K = knitMats(THREE2, "#8c5a38");
      const knit = new THREE2.MeshStandardMaterial({ map: K.map, normalMap: K.nrm, normalScale: new THREE2.Vector2(0.9, 0.9), roughness: 0.95, envMapIntensity: 0.5, transparent: true, side: THREE2.FrontSide });
      g2.add(new THREE2.Mesh(dome.geo(THREE2, { ws: 64, hs: 24 }), knit), dome.lining(THREE2, { color: 2759184 }));
      const K2 = knitMats(THREE2, "#7d4f31", { rep: [60, 2] });
      const rib = new THREE2.MeshStandardMaterial({ map: K2.map, normalMap: K2.ribN, normalScale: new THREE2.Vector2(1.2, 1.2), roughness: 0.95, envMapIntensity: 0.5, transparent: true });
      g2.add(new THREE2.Mesh(dome.rim(THREE2, { r: 1.35, off: 0.55, sy: 1.25, rib: 1, theta: dome.thetaMax - 0.03 }), rib));
      const patch = new THREE2.Group();
      const felt = (c) => M.felt(c, { roughness: 1 });
      const head = new THREE2.Mesh(new THREE2.CircleGeometry(1.15, 28), felt(14262378));
      patch.add(head);
      for (const s of [-1, 1]) {
        const e = new THREE2.Mesh(new THREE2.CircleGeometry(0.42, 18), felt(14262378));
        e.position.set(s * 0.85, 0.85, -0.02);
        patch.add(e);
        const ei = new THREE2.Mesh(new THREE2.CircleGeometry(0.22, 14), felt(15910043));
        ei.position.set(s * 0.85, 0.85, 0.01);
        patch.add(ei);
      }
      const mz = new THREE2.Mesh(new THREE2.CircleGeometry(0.5, 20), felt(16178368));
      mz.scale.set(1.15, 0.85, 1);
      mz.position.set(0, -0.35, 0.02);
      patch.add(mz);
      const nose = new THREE2.Mesh(new THREE2.SphereGeometry(0.17, 12, 8), M.eye());
      nose.scale.set(1.3, 0.9, 0.5);
      nose.position.set(0, -0.2, 0.06);
      patch.add(nose);
      for (const s of [-1, 1]) {
        const ey = new THREE2.Mesh(new THREE2.SphereGeometry(0.12, 10, 8), M.eye());
        ey.scale.z = 0.5;
        ey.position.set(s * 0.42, 0.2, 0.05);
        patch.add(ey);
      }
      const ph = -0.42, th = dome.thetaMax - 0.03, pp = dome.at(th, ph, new THREE2.Vector3()), nn = dome.nrm(th, ph, new THREE2.Vector3());
      patch.position.copy(pp).addScaledVector(nn, 0.55 + 1.45);
      patch.lookAt(patch.position.clone().add(nn));
      patch.scale.setScalar(1.2);
      g2.add(patch);
      const pomP = dome.at(0.05, 0, new THREE2.Vector3());
      const pom = new THREE2.Group();
      pom.position.copy(pomP);
      const fluff = new THREE2.Mesh(blob(THREE2, 2.1, { amp: 0.16, freq: 2.2, seed: 5, ws: 36, hs: 26 }), M.plush(14207156, { normalScale: new THREE2.Vector2(1, 1) }));
      fluff.position.y = 1.6;
      pom.add(fluff);
      g2.add(pom);
      U.pom = new Swing(THREE2, pom, { len: 1.8, stiff: 300, damping: 0.85, grav: 300 });
      U.pomPos = pom.position.clone();
      U.pomHop = new Spring(0, 200, 7);
      U.pomObj = fluff;
      return (side, p, n) => {
        const th2 = 0.72, ph2 = side * 1.05;
        dome.at(th2, ph2, p);
        dome.nrm(th2, ph2, n);
      };
    },
    earSink: -0.4,
    earSplay: 1,
    earFactory(THREE2, M, side) {
      const o = new THREE2.Group();
      const outer = new THREE2.Mesh(blob(THREE2, 2.45, { sx: 1, sy: 0.94, sz: 0.55, amp: 0.03, seed: 4 + side }), M.plush(8211502));
      outer.position.y = 1.9;
      const inner = new THREE2.Mesh(blob(THREE2, 1.5, { sx: 1.05, sy: 0.92, sz: 0.34, ws: 22, hs: 14 }), M.plush(14261368, { sheenRoughness: 0.6 }));
      inner.position.set(0, 1.8, 1.05);
      o.add(outer, inner);
      return { obj: o };
    },
    droop: 0.8,
    droopFwd: 0.5,
    perk: 0.25,
    decoUpdate(U, dt, t) {
      if (U.smileT.fired) U.pomHop.v += 9;
      const hop = U.pomHop.step(dt, 0);
      U.pomObj.position.y = 1.6 + Math.max(0, hop) * 0.8;
      U.pomObj.scale.set(1 + hop * 0.06, 1 - hop * 0.08, 1 + hop * 0.06);
      if (!U.frame.attached) {
        U.pom.rest();
        return;
      }
      U.pom.step(dt, U.frame, U.down, U.pomPos);
    }
  });
}
var update = updateEarband;
export {
  build as default,
  meta,
  update
};
