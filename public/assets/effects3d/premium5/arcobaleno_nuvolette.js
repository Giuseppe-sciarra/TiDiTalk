// Tiditalk — effetto viso 3D "arcobaleno_nuvolette" (premium5). Codice originale, AGPL-3.0. GENERATO da _src/fx/arcobaleno_nuvolette.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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

// lib/geo.js
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
    let far = false, sg = 0;
    for (let c = 0; c < 8; c++) {
      const v = cb[bi + (c & 1) + (nb + 1) * (bj + (c >> 1 & 1) + (nb + 1) * (bk + (c >> 2)))];
      if (Math.abs(v) > diag) far = true;
      sg = v;
    }
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

// fx/arcobaleno_nuvolette.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "aspect": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s1 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "spin": void 0 };
var meta = { label: "Arcobaleno tra le nuvolette", labelEn: "Rainbow & little clouds", category: "divertenti", icon: "\u{1F308}" };
var COLS = [16726869, 16747050, 16765742, 5230430, 3842815, 10120191];
var CY = 5.6;
var CZ = -1.6;
var R0 = 11.7;
var DR = 0.68;
function cloudSdf(x, y, z) {
  let d = sd.ellipsoid(x, y, z, 0, -0.4, 0, 3.9, 1.6, 2.3);
  d = sd.smin(d, sd.sphere(x, y, z, -1.6, 0.6, 0.1, 1.75), 0.9);
  d = sd.smin(d, sd.sphere(x, y, z, 0.6, 1.1, 0, 2.05), 0.9);
  d = sd.smin(d, sd.sphere(x, y, z, 2.6, 0.2, 0, 1.45), 0.8);
  d = sd.smin(d, sd.sphere(x, y, z, -3.2, -0.5, 0, 1.2), 0.8);
  return d;
}
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  const M = new Mats(THREE);
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.expr = new Expr(["smile", "jaw", "frown"]);
  U.rnd = rng(27);
  const arc = new THREE.Group();
  arc.position.set(0, CY, CZ);
  arc.rotation.x = -0.12;
  g2.add(arc);
  U.arc = arc;
  U.bands = [];
  COLS.forEach((c, k) => {
    const m = M.candy(c, { roughness: 0.25, emissive: new THREE.Color(c), emissiveIntensity: 0.2 });
    const t = new THREE.Mesh(new THREE.TorusGeometry(R0 - k * DR, 0.36, 12, 96, Math.PI), m);
    arc.add(t);
    U.bands.push(m);
  });
  const geo = surfaceNets(THREE, cloudSdf, [-5, -2.6, -3], [5, 3.6, 3], 34, (x, y, z) => {
    const k = Math.min(1, Math.max(0, (y + 1.5) / 4));
    const c = new THREE.Color().setRGB(0.72 + 0.2 * k, 0.78 + 0.16 * k, 0.93 + 0.06 * k, THREE.SRGBColorSpace);
    return [c.r, c.g, c.b];
  }, "p5cloud");
  U.cloudMat = M.satin(16777215, { vertexColors: true, roughness: 0.75, clearcoat: 0, sheen: 0.6, sheenColor: new THREE.Color(0.9, 0.95, 1), envMapIntensity: 0.55 });
  U.clouds = [];
  for (const s of [-1, 1]) {
    const cg = new THREE.Group();
    const x = s * (R0 - 2.5 * DR);
    cg.position.set(x, CY - 0.8, CZ + 0.8);
    g2.add(cg);
    const m = new THREE.Mesh(geo, U.cloudMat);
    m.scale.set(s * 1, 1, 1);
    cg.add(m);
    if (s < 0) m.material = U.cloudMat;
    const face = new KFace(THREE, M, {
      eyeR: 0.34,
      gap: 0.95,
      eyeY: 0.35,
      tall: 1.15,
      mouthY: -0.45,
      mouthW: 0.28,
      blushR: 0.42,
      blushX: 1.75,
      blushY: -0.15,
      blushColor: 16744346,
      blushOp: 0.7,
      surf: (px, py) => Math.max(0, Math.sqrt(Math.max(0, 1 - px * px / 14 - (py + 0.2) * (py + 0.2) / 5)) * 2.35)
    });
    face.g.position.set(s * 0.2, 0, 0.05);
    cg.add(face.g);
    U.clouds.push({ s, cg, face, y0: cg.position.y });
  }
  const world = worldRoot(THREE, g2, U.frame);
  U.world = world;
  U.atlas = makeAtlas(THREE, ["spark", "glow", "drop", "star"]);
  U.gl = new Sprites(THREE, { max: 80, atlas: U.atlas, blend: "add", renderOrder: 6 });
  U.rain = new Sprites(THREE, { max: 60, atlas: U.atlas, blend: "normal", renderOrder: 5 });
  world.add(U.gl.mesh, U.rain.mesh);
  U.smileT = new Trigger({ on: 0.5, off: 0.3, cooldown: 0.4 });
  U.relFr = new Rel();
  U.happy = 0;
  U.sad = 0;
  U.v = new THREE.Vector3();
  U.w = new THREE.Vector3();
  U.down = new THREE.Vector3(0, -1, 0);
  update(g2, {}, 0, h);
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
  U.sad = damp(U.sad, show ? 0 : smooth(0.3, 0.75, U.relFr.update(e.frown, dt, U.expr.ready && !show)) * (1 - U.happy), 3, dt);
  const fired = !show && U.smileT.update(e.smile, dt);
  for (let k = 0; k < U.bands.length; k++) {
    const m = U.bands[k];
    m.emissiveIntensity = 0.15 + 0.45 * U.happy * (0.6 + 0.4 * Math.sin(t * 5 - k * 0.8));
    m.opacity = 1 - 0.6 * U.sad;
  }
  U.cloudMat.color.setRGB(1 - 0.3 * U.sad, 1 - 0.26 * U.sad, 1 - 0.18 * U.sad);
  const blink = show ? 0 : ((bs.eyeBlinkLeft || 0) + (bs.eyeBlinkRight || 0)) / 2;
  for (const C of U.clouds) {
    C.cg.position.y = C.y0 + Math.sin(t * 1.5 + C.s) * 0.3;
    C.cg.rotation.z = Math.sin(t * 1.1 + C.s * 2) * 0.04;
    C.face.set(blink, U.happy, show ? 0 : clamp(e.jaw * 1.4));
    C.face.smile.rotation.z = U.sad > 0.5 ? Math.PI : 0;
    C.face.smile.position.y = U.sad > 0.5 ? -0.05 : 0.13;
    if (!show && U.sad > 0.4 && U.rnd() < dt * 10 * U.sad) {
      U.frame.toWorld(U.v.set(C.cg.position.x + (U.rnd() - 0.5) * 6, C.cg.position.y - 1.8, C.cg.position.z + (U.rnd() - 0.5) * 2), U.w);
      U.rain.spawn((__s0["x"] = U.w.x, __s0["y"] = U.w.y, __s0["z"] = U.w.z, __s0["vx"] = 0, __s0["vy"] = -26, __s0["vz"] = 0, __s0["life"] = 0.5, __s0["size"] = 0.7, __s0["r"] = 0.55, __s0["g"] = 0.75, __s0["b"] = 1, __s0["a"] = 0.9, __s0["cell"] = U.atlas.cell.drop, __s0["aspect"] = 1.6, __s0["fadeIn"] = 0.05, __s0["fadeOut"] = 0.3, __s0));
    }
  }
  if (!show && (fired || U.happy > 0.5) && U.rnd() < (fired ? 1 : dt * 14 * U.happy)) {
    const a = U.rnd() * Math.PI, rr = R0 - U.rnd() * 5 * DR;
    U.frame.toWorld(U.v.set(Math.cos(a) * rr, CY + Math.sin(a) * rr, CZ + 0.8), U.w);
    U.gl.spawn((__s1["x"] = U.w.x, __s1["y"] = U.w.y, __s1["z"] = U.w.z, __s1["vx"] = (U.rnd() - 0.5) * 3, __s1["vy"] = 2, __s1["vz"] = 0, __s1["life"] = 0.9, __s1["size"] = 1 + U.rnd() * 0.9, __s1["size1"] = 0.1, __s1["r"] = 1, __s1["g"] = 0.95, __s1["b"] = 0.8, __s1["a"] = 1, __s1["cell"] = U.rnd() < 0.5 ? U.atlas.cell.spark : U.atlas.cell.star, __s1["spin"] = 3, __s1));
  }
  U.gl.update(dt, U.down);
  U.rain.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
