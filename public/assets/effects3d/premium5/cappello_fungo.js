// Tiditalk — effetto viso 3D "cappello_fungo" (premium5). Codice originale, AGPL-3.0. GENERATO da _src/fx/cappello_fungo.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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
var Kick = class {
  constructor({ rise = 0.45, level = 0.55, win = 0.3, cooldown = 1.2 } = {}) {
    Object.assign(this, { rise, level, win, cooldown });
    this.ts = new Float32Array(32);
    this.vs = new Float32Array(32);
    this.n = 0;
    this.i = 0;
    this.time = 0;
    this.cool = 0;
    this.fired = false;
  }
  update(v, dt) {
    this.time += dt;
    this.cool -= dt;
    this.fired = false;
    this.ts[this.i] = this.time;
    this.vs[this.i] = v;
    this.i = (this.i + 1) % 32;
    this.n = Math.min(32, this.n + 1);
    if (this.cool > 0 || v < this.level) return false;
    let mn = 1;
    for (let k = 0; k < this.n; k++) if (this.time - this.ts[k] <= this.win) mn = Math.min(mn, this.vs[k]);
    if (v - mn >= this.rise) {
      this.fired = true;
      this.cool = this.cooldown;
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
var _blushTex = null;
function softDisc(THREE) {
  if (_blushTex && _blushTex.__three === THREE) return _blushTex;
  const c = canvas(64, 64), x = c.getContext("2d"), g2 = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g2.addColorStop(0, "rgba(255,255,255,1)");
  g2.addColorStop(0.55, "rgba(255,255,255,.75)");
  g2.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g2;
  x.fillRect(0, 0, 64, 64);
  _blushTex = texFrom(THREE, c, { wrap: false });
  _blushTex.__three = THREE;
  return _blushTex;
}
var KFace = class {
  constructor(THREE, M, o = {}) {
    const {
      eyeR = 0.32,
      gap = 1,
      eyeY = 0.25,
      tall = 1.15,
      mouthY = -0.35,
      mouthW = 0.32,
      blush = true,
      blushX = null,
      blushY = null,
      blushR = 0.42,
      blushColor = 16740239,
      blushOp = 0.6,
      surf = () => 0,
      ink = 2364954,
      mouthCol = 8005171,
      cat = false,
      hl = true,
      lift = 0.02,
      mouth = true
    } = o;
    this.g = new THREE.Group();
    this.o = o;
    const sf = (x, y) => surf(x, y) + lift;
    const eyeMat = M.eye(ink), inkMat = M.matte(ink, { roughness: 0.5 }), hlMat = new THREE.MeshBasicMaterial({ color: 16777215, transparent: true });
    this.eyes = [];
    const sph = new THREE.SphereGeometry(eyeR, 20, 14);
    const arcU = new THREE.TorusGeometry(eyeR * 0.85, eyeR * 0.2, 6, 18, Math.PI);
    const arcD = arcU.clone();
    arcD.rotateZ(Math.PI);
    const hl1 = new THREE.CircleGeometry(eyeR * 0.34, 12), hl2 = new THREE.CircleGeometry(eyeR * 0.16, 10);
    for (const s of [-1, 1]) {
      const x = s * gap, y = eyeY, z = sf(x, y);
      const e = new THREE.Group();
      e.position.set(x, y, z);
      const open = new THREE.Group();
      const ball = new THREE.Mesh(sph, eyeMat);
      ball.scale.set(1, tall, 0.5);
      open.add(ball);
      if (hl) {
        const a = new THREE.Mesh(hl1, hlMat);
        a.position.set(eyeR * 0.32, eyeR * 0.42 * tall, eyeR * 0.47);
        open.add(a);
        const b = new THREE.Mesh(hl2, hlMat);
        b.position.set(-eyeR * 0.3, -eyeR * 0.38 * tall, eyeR * 0.46);
        open.add(b);
      }
      const happy = new THREE.Mesh(arcU, inkMat);
      happy.position.y = -eyeR * 0.25;
      happy.scale.set(1, 0.9, 0.6);
      const shut = new THREE.Mesh(arcD, inkMat);
      shut.position.y = eyeR * 0.3;
      shut.scale.set(1, 0.7, 0.6);
      e.add(open, happy, shut);
      this.g.add(e);
      this.eyes.push({ e, open, happy, shut });
    }
    const mz = sf(0, mouthY);
    this.mouth = new THREE.Group();
    this.mouth.position.set(0, mouthY, mz);
    this.g.add(this.mouth);
    if (cat) {
      const w1 = new THREE.TorusGeometry(mouthW * 0.5, mouthW * 0.13, 6, 14, Math.PI);
      w1.rotateZ(Math.PI);
      const a = new THREE.Mesh(w1, inkMat);
      a.position.x = -mouthW * 0.5;
      const b = new THREE.Mesh(w1, inkMat);
      b.position.x = mouthW * 0.5;
      this.smile = new THREE.Group();
      this.smile.add(a, b);
    } else {
      const sg = new THREE.TorusGeometry(mouthW, mouthW * 0.16, 6, 18, Math.PI);
      sg.rotateZ(Math.PI);
      this.smile = new THREE.Mesh(sg, inkMat);
      this.smile.position.y = mouthW * 0.45;
      this.smile.scale.set(1, 0.85, 0.6);
    }
    this.mouth.add(this.smile);
    const sh = new THREE.Shape();
    sh.moveTo(-1, 0);
    sh.quadraticCurveTo(-1, -1.25, 0, -1.25);
    sh.quadraticCurveTo(1, -1.25, 1, 0);
    sh.quadraticCurveTo(0, 0.18, -1, 0);
    const og = new THREE.ShapeGeometry(sh, 10);
    this.open = new THREE.Group();
    const om = new THREE.Mesh(og, M.matte(mouthCol, { roughness: 0.6 }));
    this.open.add(om);
    const tg = new THREE.CircleGeometry(0.55, 14);
    const tongue = new THREE.Mesh(tg, M.matte(16743823, { roughness: 0.6 }));
    tongue.position.set(0, -0.95, 0.01);
    tongue.scale.set(1.1, 0.5, 1);
    this.open.add(tongue);
    this.open.scale.setScalar(1e-4);
    this.open.position.y = mouthW * 0.3;
    this.openW = mouthW * 1.05;
    this.mouth.add(this.open);
    if (!mouth) this.mouth.visible = false;
    this.blush = [];
    if (blush) {
      const bm = new THREE.MeshBasicMaterial({ color: blushColor, map: softDisc(THREE), transparent: true, opacity: blushOp, depthWrite: false });
      const bg = new THREE.CircleGeometry(blushR, 18);
      for (const s of [-1, 1]) {
        const x = s * (blushX ?? gap * 1.45), y = blushY ?? eyeY - eyeR * 1.7;
        const m = new THREE.Mesh(bg, bm);
        m.position.set(x, y, sf(x, y) + 0.01);
        m.scale.set(1.45, 0.9, 1);
        m.renderOrder = 2;
        this.g.add(m);
        this.blush.push(m);
      }
      this.blushMat = bm;
      this.blushOp = blushOp;
    }
    this.set(0, 0, 0);
  }
  // blink 0..1, happy 0..1 (occhi ^^ e sorriso più largo), open 0..1 (bocca aperta)
  set(blink, happy, open) {
    const closed = blink > 0.55, hap = !closed && happy > 0.5;
    for (const E of this.eyes) {
      E.open.visible = !closed && !hap;
      E.happy.visible = hap;
      E.shut.visible = closed;
      if (E.open.visible) E.open.scale.set(1, Math.max(0.12, 1 - blink * 1.3), 1);
    }
    const o = clamp(open);
    this.smile.visible = o < 0.25;
    this.smile.scale.x = 1 + happy * 0.35;
    const s = o < 0.25 ? 1e-4 : this.openW * (0.55 + 0.45 * o);
    this.open.scale.set(s * (1 + happy * 0.2), s * (0.5 + 0.8 * o), 1);
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
function occluder(THREE, geo) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }));
  m.renderOrder = -1;
  return m;
}
function realHead(THREE, k = 1) {
  const o = occluder(THREE, new THREE.SphereGeometry(1, 32, 20));
  o.scale.set(7.6 * k, 10.1 * k, 9.3 * k);
  o.position.set(0, 2.3, -4.6);
  o.name = "realHead";
  return o;
}

// fx/cappello_fungo.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "wob": void 0, "wf": void 0, "flicker": void 0 };
var __s1 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "drag": void 0, "rot": void 0, "spin": void 0 };
var __s2 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "drag": void 0, "spin": void 0 };
var meta = { label: "Cappello a fungo", labelEn: "Toadstool hat", category: "costumi", icon: "\u{1F344}" };
function capProfile(R, H) {
  return [[0.01, H], [R * 0.3, H * 0.97], [R * 0.58, H * 0.86], [R * 0.8, H * 0.62], [R * 0.94, H * 0.32], [R, H * 0.06], [R * 0.985, -H * 0.06], [R * 0.93, -H * 0.1]];
}
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  const M = new Mats(THREE);
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.expr = new Expr(["smile", "jaw", "eyesClosed"]);
  U.rnd = rng(13);
  const cap = new THREE.Group();
  cap.position.set(0, 8.9, -2.4);
  cap.rotation.x = -0.2;
  g2.add(cap);
  U.cap = cap;
  const R = 12.2, H = 7.4;
  const top = smoothLathe(THREE, capProfile(R, H), 72, 6);
  vcolor(THREE, top, (x, y, z, nx, ny, nz, o) => {
    const k = 0.82 + 0.18 * Math.min(1, y / H + 0.2);
    o[0] = 0.8 * k;
    o[1] = 0.1 * k;
    o[2] = 0.12 * k;
  });
  cap.add(new THREE.Mesh(top, M.satin(16777215, { vertexColors: true, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.25, sheen: 0.3, side: THREE.DoubleSide })));
  const gl = new THREE.RingGeometry(3.5, R * 0.93, 120, 6);
  {
    const p = gl.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y), a = Math.atan2(y, x);
      const ridge = Math.pow(Math.abs(Math.sin(a * 60)), 0.6) * 0.18 * Math.min(1, (r - 3.5) / 2);
      p.setXYZ(i, x, y, -0.6 + r / R * 0.2 - ridge);
    }
    gl.rotateX(Math.PI / 2);
    gl.computeVertexNormals();
  }
  vcolor(THREE, gl, (x, y, z, nx, ny, nz, o) => {
    const r = Math.hypot(x, z) / R, k = 0.42 + 0.5 * r;
    o[0] = 0.9 * k;
    o[1] = 0.78 * k;
    o[2] = 0.64 * k;
  });
  const gills = new THREE.Mesh(gl, M.matte(16777215, { vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
  gills.position.y = -H * 0.07;
  cap.add(gills);
  const dots = [];
  const r0 = rng(5);
  const spots = [[0, 0, 1.5], [0.42, 0.3, 1.25], [0.45, 2.4, 1.2], [0.5, 4.3, 1.3], [0.62, 1.15, 1.05], [0.72, 5.5, 0.95], [0.7, 3.3, 0.9], [0.82, 0.25, 0.85], [0.85, 2, 0.75], [0.88, 6, 0.7], [0.8, 4, 0.8], [0.35, 5.6, 0.9]];
  for (const [u, a, s] of spots) {
    const ry = H * (1 - u * u * 0.92), rr = R * Math.sin(u * 1.38);
    const d = blob(THREE, s, { sx: 1, sy: 0.32, sz: 0.85 + r0() * 0.3, ws: 18, hs: 10, amp: 0.1, seed: a * 10 | 0 });
    const nrm = new THREE.Vector3(Math.sin(a) * Math.sin(u * 1.5), Math.cos(u * 1.5), Math.cos(a) * Math.sin(u * 1.5)).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm);
    d.applyQuaternion(q);
    d.translate(Math.sin(a) * rr, ry - 0.05, Math.cos(a) * rr);
    dots.push(d);
  }
  cap.add(new THREE.Mesh(merge(THREE, dots), M.satin(15985112, { roughness: 0.6, clearcoat: 0.2 })));
  U.babies = [];
  for (const [x, z, s, rot] of [[-2.8, 1, 1, 0.25], [2.4, 2.2, 0.8, -0.3]]) {
    const b = new THREE.Group();
    b.position.set(x, H * 0.93 - Math.abs(x) * 0.08, z);
    b.rotation.z = rot;
    b.scale.setScalar(s);
    const stem = new THREE.Mesh(smoothLathe(THREE, [[0.01, 0], [1.25, 0.05], [1.35, 0.9], [1.15, 2], [0.01, 2.2]], 28, 4), M.satin(16049874, { roughness: 0.55 }));
    const bc = new THREE.Mesh(smoothLathe(THREE, capProfile(2.3, 1.7), 32, 4), M.satin(14165039, { roughness: 0.4, clearcoat: 0.5 }));
    bc.position.y = 1.9;
    const sp = new THREE.Mesh(blob(THREE, 0.38, { sy: 0.3, ws: 12, hs: 8 }), M.satin(15985112));
    sp.position.set(0.5, 1.9 + 1.55, 0.6);
    sp.rotation.x = 0.5;
    const sp2 = sp.clone();
    sp2.position.set(-0.7, 1.9 + 1.4, -0.2);
    const face = new KFace(THREE, M, { eyeR: 0.2, gap: 0.42, eyeY: 0.95, mouthY: 0.55, mouthW: 0.16, blushR: 0.22, surf: (px, py) => 1.33 - px * px * 0.45 });
    b.add(stem, bc, sp, sp2, face.g);
    cap.add(b);
    U.babies.push({ b, face, y0: b.position.y, hop: new Spring(0, 200, 7), s });
  }
  const world = worldRoot(THREE, g2, U.frame);
  U.world = world;
  U.atlas = makeAtlas(THREE, ["glow", "spark", "dot", "smoke"]);
  U.gl = new Sprites(THREE, { max: 120, atlas: U.atlas, blend: "add", renderOrder: 6 });
  U.puff = new Sprites(THREE, { max: 40, atlas: U.atlas, blend: "normal", renderOrder: 5 });
  world.add(U.puff.mesh, U.gl.mesh);
  U.smileT = new Trigger({ on: 0.5, off: 0.3, cooldown: 0.5 });
  U.kick = new Kick({ rise: 0.4, level: 0.5, win: 0.35, cooldown: 1 });
  U.happy = 0;
  U.v = new THREE.Vector3();
  U.w = new THREE.Vector3();
  U.down = new THREE.Vector3(0, -1, 0);
  U.sq = new Spring(0, 180, 9);
  update(g2, {}, 0, h);
  g2.add(realHead(THREE));
  return g2;
}
function update(g2, bs, t, h) {
  const U = g2.userData;
  if (!U.frame) return;
  const dt = U.tick.tick(t);
  U.frame.update(dt);
  U.world.userData.sync();
  const e = U.expr.update(bs, dt, h);
  const show = !U.frame.attached;
  U.happy = damp(U.happy, show ? 1 : smooth(0.35, 0.75, e.smile), 5, dt);
  const fired = !show && U.smileT.update(e.smile, dt);
  const puff = !show && U.kick.update(e.jaw, dt);
  if (puff) U.sq.v -= 6;
  const sq = U.sq.step(dt, 0);
  U.cap.scale.set(1 - sq * 0.05, 1 + sq * 0.08, 1 - sq * 0.05);
  const blink = show ? 0 : (bs && (bs.eyeBlinkLeft || 0) + (bs.eyeBlinkRight || 0)) / 2;
  for (let i = 0; i < U.babies.length; i++) {
    const B = U.babies[i];
    if (fired || puff) B.hop.v += 7 + i * 2;
    const hp = B.hop.step(dt, 0);
    B.b.position.y = B.y0 + Math.max(0, hp) * 1.2;
    B.b.rotation.x = Math.sin(t * 2.2 + i * 2) * 0.05;
    B.face.set(blink, U.happy, show ? 0 : clamp(e.jaw * 1.4));
  }
  if (!show) {
    const n = (U.happy > 0.3 ? U.happy * 10 : 0.8) * dt;
    if (U.rnd() < n) {
      const a = U.rnd() * 6.283, r = 3 + U.rnd() * 8;
      U.frame.toWorld(U.v.set(Math.sin(a) * r, 13 + U.rnd() * 3, -2.4 + Math.cos(a) * r), U.w);
      U.gl.spawn((__s0["x"] = U.w.x, __s0["y"] = U.w.y, __s0["z"] = U.w.z, __s0["vx"] = (U.rnd() - 0.5) * 2, __s0["vy"] = 2 + U.rnd() * 3, __s0["vz"] = (U.rnd() - 0.5) * 2, __s0["life"] = 2.2, __s0["size"] = 0.5 + U.rnd() * 0.5, __s0["r"] = 1, __s0["g"] = 0.85, __s0["b"] = 0.45, __s0["a"] = 0.9, __s0["cell"] = U.atlas.cell.glow, __s0["wob"] = 1.5, __s0["wf"] = 2, __s0["flicker"] = 0.4, __s0));
    }
    if (puff) for (let k = 0; k < 14; k++) {
      const a = U.rnd() * 6.283;
      U.frame.toWorld(U.v.set(Math.sin(a) * 10, 9, -2.4 + Math.cos(a) * 10), U.w);
      U.puff.spawn((__s1["x"] = U.w.x, __s1["y"] = U.w.y, __s1["z"] = U.w.z, __s1["vx"] = Math.sin(a) * 9, __s1["vy"] = 2 + U.rnd() * 3, __s1["vz"] = Math.cos(a) * 9, __s1["life"] = 1.4, __s1["size"] = 3, __s1["size1"] = 7, __s1["r"] = 1, __s1["g"] = 0.93, __s1["b"] = 0.8, __s1["a"] = 0.55, __s1["cell"] = U.atlas.cell.smoke, __s1["drag"] = 2.5, __s1["rot"] = U.rnd() * 6, __s1["spin"] = 1, __s1));
      U.gl.spawn((__s2["x"] = U.w.x, __s2["y"] = U.w.y, __s2["z"] = U.w.z, __s2["vx"] = Math.sin(a) * 12, __s2["vy"] = 3 + U.rnd() * 4, __s2["vz"] = Math.cos(a) * 12, __s2["life"] = 1.2, __s2["size"] = 0.6, __s2["r"] = 1, __s2["g"] = 0.9, __s2["b"] = 0.5, __s2["a"] = 1, __s2["cell"] = U.atlas.cell.spark, __s2["drag"] = 2, __s2["spin"] = 3, __s2));
    }
  }
  U.gl.update(dt, U.down);
  U.puff.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
