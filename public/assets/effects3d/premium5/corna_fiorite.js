// Tiditalk — effetto viso 3D "corna_fiorite" (premium5). Codice originale, AGPL-3.0. GENERATO da _src/fx/corna_fiorite.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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
function puffy(THREE, shape, { depth = 0.2, bevel = 0.5, seg = 6, curveSeg = 24, size = null } = {}) {
  const g2 = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: size ?? bevel * 0.9, bevelSegments: seg, curveSegments: curveSeg });
  g2.translate(0, 0, -depth / 2);
  g2.computeVertexNormals();
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
function vcolor(THREE, geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal, a = new Float32Array(p.count * 3), c = new THREE.Color(), o = [1, 1, 1];
  for (let i = 0; i < p.count; i++) {
    o[0] = o[1] = o[2] = 1;
    fn(p.getX(i), p.getY(i), p.getZ(i), n ? n.getX(i) : 0, n ? n.getY(i) : 0, n ? n.getZ(i) : 0, o);
    c.setRGB(o[0], o[1], o[2], THREE.SRGBColorSpace);
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return geo;
}
function triEar(THREE, { w = 3, hgt = 3.6, depth = 0.5, bevel = 0.45, round = 0.5, cup = 0.12, lean = 0.25, tipRound = 0.35, seg = 4, leaf = 0 } = {}) {
  const s = new THREE.Shape(), hw = w / 2;
  if (leaf) {
    s.moveTo(0, 0);
    s.bezierCurveTo(hw * 1.25, hgt * 0.2, hw * 0.9, hgt * 0.75, 0, hgt);
    s.bezierCurveTo(-hw * 0.9, hgt * 0.75, -hw * 1.25, hgt * 0.2, 0, 0);
  } else {
    s.moveTo(-hw, 0);
    s.quadraticCurveTo(-hw * 0.95 + round * 0.2, hgt * 0.55, -tipRound, hgt - tipRound * 0.6);
    s.quadraticCurveTo(0, hgt + tipRound * 0.25, tipRound, hgt - tipRound * 0.6);
    s.quadraticCurveTo(hw * 0.95 - round * 0.2, hgt * 0.55, hw, 0);
    s.quadraticCurveTo(0, -round * 0.6, -hw, 0);
  }
  const g2 = puffy(THREE, s, { depth, bevel, size: bevel * 0.85, seg, curveSeg: 20 });
  const p = g2.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), u = Math.max(0, y / hgt);
    p.setZ(i, z - cup * x * x * (1 - u * 0.6) - lean * u * u * hgt * 0.3);
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

// fx/corna_fiorite.js
var __s02 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "rot": void 0, "spin": void 0, "drag": void 0, "grav": void 0, "wob": void 0, "wf": void 0 };
var meta = { label: "Corna fiorite", labelEn: "Blossom antlers", category: "accessori", icon: "\u{1F98C}" };
function petalDraw(x, s) {
  x.save();
  x.translate(s / 2, s / 2);
  const g2 = x.createRadialGradient(0, -s * 0.05, 0, 0, 0, s * 0.45);
  g2.addColorStop(0, "rgba(255,255,255,1)");
  g2.addColorStop(1, "rgba(255,255,255,.75)");
  x.fillStyle = g2;
  x.beginPath();
  x.moveTo(0, s * 0.42);
  x.bezierCurveTo(s * 0.38, s * 0.1, s * 0.3, -s * 0.38, 0, -s * 0.3);
  x.bezierCurveTo(-s * 0.3, -s * 0.38, -s * 0.38, s * 0.1, 0, s * 0.42);
  x.fill();
  x.restore();
}
function build(THREE, h) {
  return buildEarband(THREE, h, {
    seed: 81,
    band: { color: 8016438, r: 0.36 },
    earA: 1,
    earSplay: 1,
    earSink: -0.6,
    earZ: 0.4,
    earFactory(THREE2, M, side) {
      const o = new THREE2.Group();
      const geo = triEar(THREE2, { w: 2.5, hgt: 4.2, depth: 0.35, bevel: 0.35, cup: 0.22, lean: 0.1, leaf: 1 });
      vcolor(THREE2, geo, (x, y, z, nx, ny, nz, c) => {
        const k = Math.min(1, y / 4);
        c[0] = 0.72 - 0.12 * k;
        c[1] = 0.47 - 0.1 * k;
        c[2] = 0.3 - 0.08 * k;
      });
      const outer = new THREE2.Mesh(geo, M.plush(16777215, { vertexColors: true }));
      const ig = triEar(THREE2, { w: 1.5, hgt: 3, depth: 0.06, bevel: 0.15, cup: 0.3, lean: 0.08, leaf: 1 });
      const inner = new THREE2.Mesh(ig, M.plush(15980232, { sheenRoughness: 0.6 }));
      inner.position.set(0, 0.45, 0.38);
      o.add(outer, inner);
      o.rotation.z = -side * 0.35;
      return { obj: o };
    },
    swing: { len: 2.6, stiff: 420, damping: 0.85, grav: 160 },
    droop: 0.7,
    droopFwd: 0.3,
    perk: 0.35,
    twitch: 8,
    sprites: ["heart", "spark", "glow", "star", "petal"],
    deco(THREE2, M, g2, band, U) {
      const velvet = M.plush(13081202, { sheenRoughness: 0.35 });
      const V = (x, y, z) => new THREE2.Vector3(x, y, z);
      for (const s of [-1, 1]) {
        const p = band.at(s * 0.36, new THREE2.Vector3());
        const ant = new THREE2.Group();
        ant.position.copy(p);
        ant.position.y -= 0.2;
        const beam = new THREE2.CatmullRomCurve3([V(0, 0, 0), V(s * 0.5, 2, -0.3), V(s * 1.6, 3.9, -0.4), V(s * 2, 5.6, 0.2)]);
        ant.add(new THREE2.Mesh(taperTube(THREE2, beam, { segs: 28, radial: 10, r: (t) => 0.5 - 0.22 * t }), velvet));
        const t1 = new THREE2.CatmullRomCurve3([V(s * 0.75, 2.4, -0.3), V(s * 0.25, 3.4, 0.2), V(-s * 0.05, 4.2, 0.5)]);
        ant.add(new THREE2.Mesh(taperTube(THREE2, t1, { segs: 14, radial: 8, r: (t) => 0.34 - 0.12 * t }), velvet));
        const t2 = new THREE2.CatmullRomCurve3([V(s * 1.6, 3.8, -0.4), V(s * 2.6, 4.4, -0.5), V(s * 3.1, 5.2, -0.3)]);
        ant.add(new THREE2.Mesh(taperTube(THREE2, t2, { segs: 14, radial: 8, r: (t) => 0.32 - 0.1 * t }), velvet));
        g2.add(ant);
      }
      const pet = new THREE2.Shape();
      pet.moveTo(0, 0);
      pet.bezierCurveTo(0.42, 0.25, 0.48, 0.95, 0, 1.1);
      pet.bezierCurveTo(-0.48, 0.95, -0.42, 0.25, 0, 0);
      const pg = puffy(THREE2, pet, { depth: 0.04, bevel: 0.08, size: 0.06, seg: 2, curveSeg: 8 });
      const ps = [];
      for (let k = 0; k < 5; k++) {
        const q = pg.clone();
        q.rotateX(-0.25);
        q.rotateZ(k * Math.PI * 2 / 5);
        ps.push(q);
      }
      const flowerG = merge(THREE2, ps);
      const centerG = new THREE2.SphereGeometry(0.34, 12, 8);
      const cols = [16746157, 16756860, 12162303, 16773592, 16740241, 16765806];
      const leafS = new THREE2.Shape();
      leafS.moveTo(0, 0);
      leafS.quadraticCurveTo(0.5, 0.55, 0, 1.3);
      leafS.quadraticCurveTo(-0.5, 0.55, 0, 0);
      const leafG = puffy(THREE2, leafS, { depth: 0.03, bevel: 0.05, size: 0.04, seg: 1, curveSeg: 6 });
      const leafM = M.satin(6068808), cM = M.matte(16171324, { roughness: 0.6 });
      U.flowers = [];
      const spots = [-0.95, -0.72, -0.52, -0.18, 0.02, 0.2, 0.55, 0.75, 0.97];
      spots.forEach((a, i) => {
        const p = band.at(a, new THREE2.Vector3()), nn = band.nrm(a, new THREE2.Vector3());
        const f = new THREE2.Group();
        f.position.copy(p).addScaledVector(nn, 0.25);
        f.position.z += 0.55;
        const fl = new THREE2.Mesh(flowerG, M.satin(cols[i % cols.length]));
        f.add(fl);
        const c = new THREE2.Mesh(centerG, cM);
        c.scale.z = 0.6;
        c.position.z = 0.12;
        f.add(c);
        const s = (i % 3 === 1 ? 1.25 : 0.95) * (Math.abs(a) > 0.9 ? 0.85 : 1);
        f.scale.setScalar(s);
        f.rotation.set(-0.45 + nn.y * 0.2, 0, -a * 0.8 + (i % 2 ? 0.4 : -0.3));
        g2.add(f);
        U.flowers.push({ f, s, fl });
        for (const d of [-1, 1]) {
          const l = new THREE2.Mesh(leafG, leafM);
          l.position.copy(f.position);
          l.position.z -= 0.15;
          l.rotation.set(-0.3, 0, -a + d * 1.9 + i % 2 * 0.3);
          l.scale.setScalar(0.95);
          g2.add(l);
        }
      });
      U.bloom = 0;
      U.petT = 0;
      U.atlasPetal = U.atlas.cell.petal;
    },
    decoUpdate(U, dt, t) {
      U.bloom = damp(U.bloom, U.happy, 4, dt);
      for (let i = 0; i < U.flowers.length; i++) {
        const F = U.flowers[i];
        F.f.scale.setScalar(F.s * (1 + 0.18 * U.bloom + 0.03 * Math.sin(t * 2 + i)));
        F.fl.rotation.z = U.bloom * 0.25;
      }
      if (U.happy > 0.4 && U.frame.attached && U.rnd() < dt * 14 * U.happy) {
        const a = (U.rnd() - 0.5) * 2.2, p = U.band.at(a, U.tmp.v);
        p.z += 1;
        U.frame.toWorld(p, U.tmp.w);
        const pink = U.rnd();
        U.sp.spawn((__s02["x"] = U.tmp.w.x, __s02["y"] = U.tmp.w.y, __s02["z"] = U.tmp.w.z, __s02["vx"] = (U.rnd() - 0.5) * 10, __s02["vy"] = 3 + U.rnd() * 4, __s02["vz"] = 2 + U.rnd() * 5, __s02["life"] = 2.2, __s02["size"] = 0.8 + U.rnd() * 0.5, __s02["r"] = 1, __s02["g"] = 0.62 + pink * 0.3, __s02["b"] = 0.75 + pink * 0.15, __s02["a"] = 1, __s02["cell"] = U.atlasPetal, __s02["rot"] = U.rnd() * 6, __s02["spin"] = (U.rnd() - 0.5) * 6, __s02["drag"] = 1.5, __s02["grav"] = 6, __s02["wob"] = 3, __s02["wf"] = 3, __s02));
      }
    },
    atlasExtra: { petal: petalDraw }
  });
}
var update = updateEarband;
export {
  build as default,
  meta,
  update
};
