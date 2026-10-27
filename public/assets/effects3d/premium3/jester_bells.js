// Tiditalk — effetto viso 3D "jester_bells" (premium3). Codice originale, AGPL-3.0. GENERATO da _src/fx/jester_bells.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

// lib/core.js
var clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
var smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
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
function hatOccluder(THREE, scale = [8, 10.2, 9.3], center = [0, 2.3, -4.4]) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ colorWrite: false }));
  o.scale.set(scale[0], scale[1], scale[2]);
  o.position.set(center[0], center[1], center[2]);
  o.renderOrder = -1;
  o.name = "hatOccluder";
  return o;
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
function tint(THREE, g2, color) {
  const c = new THREE.Color(color), n = g2.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  }
  g2.setAttribute("color", new THREE.BufferAttribute(a, 3));
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

// fx/jester_bells.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s1 = { "x": void 0, "y": void 0, "z": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s2 = { "x": void 0, "y": void 0, "z": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "rot": void 0, "spin": void 0, "cell": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s3 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "spin": void 0, "drag": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s4 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "rot": void 0, "cell": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s5 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "rot": void 0, "spin": void 0, "cell": void 0, "wob": void 0, "wf": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var meta = { label: "Giullare con sonagli", labelEn: "Jingle-bell jester", labelFr: "Bouffon \xE0 grelots", labelDe: "Narr mit Schellen", category: "costumi", icon: "\u{1F0CF}" };
var CR = "#8e1129";
var PU = "#43206d";
var MU = "#d59a1d";
var GD = "#e9bf4f";
var DK = "#2a0d16";
var NS = 11;
var SUB = 3;
var NR = (NS - 1) * SUB + 1;
var TILT = -0.3;
var B0 = [0, 6.2, -3.3];
function domeTex(THREE) {
  const W = 512, H = 256, c = canvas(W, H), x = c.getContext("2d");
  x.fillStyle = CR;
  x.fillRect(0, 0, W / 2, H);
  x.fillStyle = PU;
  x.fillRect(W / 2, 0, W / 2, H);
  for (let i = 0; i < 16; i++) {
    const cx = (i + 0.5) * W / 16, g2 = x.createLinearGradient(cx - 16, 0, cx + 16, 0);
    g2.addColorStop(0, "rgba(0,0,0,0.10)");
    g2.addColorStop(0.5, "rgba(255,255,255,0.05)");
    g2.addColorStop(1, "rgba(0,0,0,0.10)");
    x.fillStyle = g2;
    x.fillRect(cx - 16, 0, 32, H);
  }
  x.fillStyle = GD;
  for (const u of [0, 0.5, 1]) x.fillRect(u * W - 4, 0, 8, H);
  x.fillStyle = "rgba(60,30,0,0.55)";
  for (const u of [0, 0.5, 1]) {
    x.fillRect(u * W - 5, 0, 1.5, H);
    x.fillRect(u * W + 3.5, 0, 1.5, H);
  }
  return texFrom(THREE, c, { wrap: true });
}
function bandTex(THREE) {
  const W = 1024, H = 96, c = canvas(W, H), x = c.getContext("2d"), n = 22, dw = W / n;
  x.fillStyle = DK;
  x.fillRect(0, 0, W, H);
  for (let i = 0; i < n; i++) {
    const cx = (i + 0.5) * dw, top = 18, bot = H - 18, mid = H / 2;
    x.fillStyle = i % 2 ? MU : CR;
    x.beginPath();
    x.moveTo(cx, top);
    x.lineTo(cx + dw / 2, mid);
    x.lineTo(cx, bot);
    x.lineTo(cx - dw / 2, mid);
    x.closePath();
    x.fill();
    x.strokeStyle = "rgba(20,5,10,0.8)";
    x.lineWidth = 2;
    x.stroke();
    x.fillStyle = PU;
    x.beginPath();
    x.moveTo(cx - dw / 2, top);
    x.lineTo(cx, top);
    x.lineTo(cx - dw / 2, mid);
    x.closePath();
    x.fill();
    x.beginPath();
    x.moveTo(cx - dw / 2, bot);
    x.lineTo(cx, bot);
    x.lineTo(cx - dw / 2, mid);
    x.closePath();
    x.fill();
  }
  x.fillStyle = GD;
  x.fillRect(0, 6, W, 10);
  x.fillRect(0, H - 16, W, 10);
  x.fillStyle = "rgba(70,35,0,0.6)";
  x.fillRect(0, 15, W, 2);
  x.fillRect(0, H - 17, W, 2);
  return texFrom(THREE, c, { wrap: true });
}
function hornTex(THREE, col) {
  const c = canvas(128, 64), x = c.getContext("2d");
  x.fillStyle = col;
  x.fillRect(0, 0, 128, 64);
  x.fillStyle = GD;
  x.fillRect(30, 0, 5, 64);
  x.fillRect(93, 0, 5, 64);
  x.fillStyle = "rgba(70,35,0,0.55)";
  x.fillRect(29, 0, 1, 64);
  x.fillRect(35, 0, 1, 64);
  x.fillRect(92, 0, 1, 64);
  x.fillRect(98, 0, 1, 64);
  return texFrom(THREE, c, { wrap: true });
}
function drawLines(x, s) {
  x.save();
  x.translate(s * 0.22, s / 2);
  x.lineCap = "round";
  x.strokeStyle = "#fff";
  for (let k = 0; k < 3; k++) {
    const r = s * (0.2 + k * 0.13);
    x.lineWidth = s * (0.065 - k * 0.012);
    x.beginPath();
    x.arc(0, 0, r, -0.62, 0.62);
    x.stroke();
  }
  x.restore();
}
function bellGeo(THREE) {
  const body = smoothLathe(THREE, [[0, 1], [0.42, 0.92], [0.78, 0.64], [0.96, 0.2], [1.04, 0.04], [1.04, -0.04], [0.95, -0.22], [0.8, -0.6], [0.46, -0.9], [0, -1]], 22, 3);
  tint(THREE, body, 16777215);
  const slot = new THREE.BoxGeometry(1.55, 0.16, 0.36);
  slot.translate(0, -0.84, 0);
  const pts = slot.attributes.position;
  for (let i = 0; i < pts.count; i++) {
    const xx = pts.getX(i);
    const yy = -Math.sqrt(Math.max(0, 1 - xx * xx * 0.42)) * 0.92 + (pts.getY(i) + 0.84);
    pts.setY(i, yy);
  }
  slot.computeVertexNormals();
  tint(THREE, slot, 1707267);
  const holes = [];
  for (const sx of [-1, 1]) {
    const hgeo = new THREE.SphereGeometry(0.17, 10, 8);
    hgeo.translate(sx * 0.66, -0.62, 0);
    tint(THREE, hgeo, 1707267);
    holes.push(hgeo);
  }
  const loop = new THREE.TorusGeometry(0.3, 0.09, 8, 18);
  loop.translate(0, 1.18, 0);
  tint(THREE, loop, 16777215);
  const g2 = merge(THREE, [body, slot, ...holes, loop]);
  g2.scale(1.3, 1.3, 1.3);
  return g2;
}
function collarGeo(THREE, n, R, len, tilt) {
  const parts = [], balls = [];
  const w = 2 * R * Math.sin(Math.PI / n) * 1.18;
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.bezierCurveTo(-w * 0.5, -len * 0.45, -w * 0.12, -len * 0.8, 0, -len);
  s.bezierCurveTo(w * 0.12, -len * 0.8, w * 0.5, -len * 0.45, w / 2, 0);
  s.lineTo(-w / 2, 0);
  const m = new THREE.Matrix4(), rx = new THREE.Matrix4(), ry = new THREE.Matrix4(), tr = new THREE.Matrix4();
  for (let k = 0; k < n; k++) {
    const phi = (k + 0.5) * Math.PI * 2 / n;
    const gg = puffy(THREE, s, { depth: 0.12, bevel: 0.34, size: 0.3, seg: 3, curveSeg: 10 });
    const p = gg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const yy = p.getY(i), xx = p.getX(i);
      p.setZ(i, p.getZ(i) + yy / len * (yy / len) * 0.9 - xx / w * (xx / w) * 0.6);
    }
    gg.computeVertexNormals();
    const col = new THREE.Color(k % 2 ? PU : CR), dark = col.clone().multiplyScalar(0.55), tmp = new THREE.Color();
    const pc = gg.attributes.position, ca = new Float32Array(pc.count * 3);
    for (let i = 0; i < pc.count; i++) {
      const f = clamp(-pc.getY(i) / (len * 0.35));
      tmp.copy(dark).lerp(col, 0.35 + 0.65 * f);
      ca[i * 3] = tmp.r;
      ca[i * 3 + 1] = tmp.g;
      ca[i * 3 + 2] = tmp.b;
    }
    gg.setAttribute("color", new THREE.BufferAttribute(ca, 3));
    rx.makeRotationX(-tilt);
    ry.makeRotationY(phi);
    tr.makeTranslation(Math.sin(phi) * R, 0, Math.cos(phi) * R);
    m.copy(tr).multiply(ry).multiply(rx);
    gg.applyMatrix4(m);
    parts.push(gg);
    const b = new THREE.SphereGeometry(0.48, 10, 8);
    b.translate(0, -len - 0.2, 0.1);
    b.applyMatrix4(m);
    balls.push(b);
  }
  return { dags: merge(THREE, parts), balls: merge(THREE, balls) };
}
var SHAPES = {
  L: {
    rest: [[-3, 4, 0.2], [-7.5, 7.6, 0.5], [-11.6, 9.2, 0.9], [-14.6, 7.6, 1.3], [-15.6, 4.4, 1.6], [-15.3, 1.6, 1.8]],
    up: [[-3, 4, 0.2], [-7.2, 8.4, 0.4], [-10.8, 11.8, 0.6], [-13.6, 14.2, 0.8], [-15.6, 15.6, 1], [-17.2, 16, 1.1]]
  },
  C: {
    rest: [[0, 5, -0.6], [-0.3, 9.4, -0.7], [0.6, 12.8, 0.1], [2.8, 14.4, 1.1], [5, 13.6, 1.7], [6, 11.6, 2]],
    up: [[0, 5, -0.6], [-0.2, 9.6, -0.6], [0.2, 13.6, -0.2], [0.9, 16.8, 0.3], [1.9, 19.2, 0.7], [3, 20.6, 1]]
  }
};
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  U.frame = new HeadFrame(THREE, g2);
  U.up3 = [0, 0, 1];
  U.tick = new Ticker();
  U.rnd = rng(141);
  U.expr = new Expr(["smile", "browUp"]);
  U.trig = new Trigger({ on: 0.55, off: 0.3, cooldown: 0.9 });
  const felt = feltNormal(THREE, 13, [6, 3], 1.6);
  const satin = (opt) => new THREE.MeshPhysicalMaterial(Object.assign({ roughness: 0.56, sheen: 0.4, sheenRoughness: 0.3, sheenColor: new THREE.Color(9068624), normalMap: felt, normalScale: new THREE.Vector2(0.45, 0.45), transparent: true }, opt));
  const hat = new THREE.Group();
  hat.position.set(...B0);
  hat.rotation.x = TILT;
  g2.add(hat);
  U.hat = hat;
  const dome = smoothLathe(THREE, [[9.05, -0.6], [9.2, 0.8], [9.1, 2.6], [8.6, 4.5], [7.5, 6.4], [5.6, 8], [3, 9.1], [0, 9.45]], 60, 5);
  {
    const p = dome.attributes.position, uv = dome.attributes.uv, ca = new Float32Array(p.count * 3);
    const exits = [[-7.6, 6.2, 0.4], [7.6, 6.2, 0.4], [0, 9.1, -0.5]];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      uv.setY(i, clamp((y + 0.6) / 10));
      let f = 0.72 + 0.28 * smooth(-0.6, 1.6, y);
      for (const [ex, ey, ez] of exits) {
        const d = Math.hypot(x - ex, y - ey, z - ez);
        f *= 0.55 + 0.45 * smooth(2.6, 5.2, d);
      }
      ca[i * 3] = ca[i * 3 + 1] = ca[i * 3 + 2] = f;
    }
    dome.setAttribute("color", new THREE.BufferAttribute(ca, 3));
  }
  hat.add(new THREE.Mesh(dome, satin({ map: domeTex(THREE), vertexColors: true, side: THREE.DoubleSide })));
  const band = new THREE.LatheGeometry([[9.15, -1.25], [9.5, -1.05], [9.68, -0.5], [9.72, 0.2], [9.62, 0.85], [9.3, 1.25]].map(([r, y]) => new THREE.Vector2(r, y)), 96);
  {
    const uv = band.attributes.uv, p = band.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setY(i, clamp((p.getY(i) + 1.25) / 2.5));
  }
  hat.add(new THREE.Mesh(band, satin({ map: bandTex(THREE), roughness: 0.45, side: THREE.DoubleSide })));
  const studs = [];
  for (let k = 0; k < 22; k++) {
    const a = k / 22 * Math.PI * 2;
    const s = new THREE.SphereGeometry(0.26, 8, 6);
    s.scale(1, 1, 0.6);
    s.lookAt(new THREE.Vector3(Math.sin(a), 0, Math.cos(a)));
    s.translate(Math.sin(a) * 9.74, 0.02, Math.cos(a) * 9.74);
    studs.push(s);
  }
  const gold = new THREE.MeshStandardMaterial({ color: 15778906, metalness: 1, roughness: 0.24, transparent: true });
  hat.add(new THREE.Mesh(merge(THREE, studs), gold));
  hat.updateMatrix();
  U.hatY = B0[1];
  const world = worldRoot(THREE, g2, U.frame);
  U.world = world;
  const bg = bellGeo(THREE);
  U.horns = [];
  const defs = [["L", 1, CR], ["R", -1, PU], ["C", 1, MU]];
  for (const [key, sx, col2] of defs) {
    const S = SHAPES[key === "R" ? "L" : key];
    const mk = (pts) => new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x * (key === "R" ? -1 : 1), y, z)), false, "centripetal").getSpacedPoints(NS - 1);
    const restA = mk(S.rest), restB = mk(S.up);
    const lenA = restA[0].distanceTo(restA[1]), lenB = restB[0].distanceTo(restB[1]);
    const tube = new DynTube(THREE, NR, 14, { r: (s) => (key === "C" ? 3 : 3.5) * Math.pow(1 - s, 0.95) + 0.32, capEnd: true });
    const ca = new Float32Array(tube.geo.attributes.position.count * 3);
    for (let i = 0; i < NR; i++) {
      const s = i / (NR - 1), f = 0.5 + 0.5 * smooth(0.12, 0.34, s);
      for (let j = 0; j <= 14; j++) {
        const k = (i * 15 + j) * 3;
        ca[k] = ca[k + 1] = ca[k + 2] = f;
      }
    }
    for (let k = NR * 15 * 3; k < ca.length; k++) ca[k] = 1;
    tube.geo.setAttribute("color", new THREE.BufferAttribute(ca, 3));
    const mesh = new THREE.Mesh(tube.geo, satin({ map: hornTex(THREE, col2), vertexColors: true, side: THREE.DoubleSide }));
    mesh.frustumCulled = false;
    world.add(mesh);
    const bm = new THREE.MeshStandardMaterial({ vertexColors: true, color: 15910748, metalness: 1, roughness: 0.22, emissive: 16756782, emissiveIntensity: 0, transparent: true });
    const bell = new THREE.Mesh(bg, bm);
    world.add(bell);
    U.horns.push({
      key,
      restA,
      restB,
      lenA,
      lenB,
      tube,
      bell,
      bm,
      x: new Float32Array(NS * 3),
      xp: new Float32Array(NS * 3),
      rest: new Float32Array(NS * 3),
      restP: new Float32Array(3),
      pts: new Float32Array(NR * 3),
      init: false,
      ph: U.rnd() * 6.28,
      cool: 0,
      shake: 0,
      glint: 0,
      spin: new Spring(0, 520, 9),
      side: key === "C" ? 0 : key === "L" ? -1 : 1
    });
  }
  const col = collarGeo(THREE, 12, 5.2, 4.4, 0.95);
  const collar = new THREE.Group();
  collar.position.set(0, -11, -1.2);
  g2.add(collar);
  collar.add(new THREE.Mesh(col.dags, satin({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.55 })));
  collar.add(new THREE.Mesh(col.balls, gold));
  const neckband = new THREE.Mesh(new THREE.TorusGeometry(5.25, 0.55, 10, 64), satin({ color: MU, roughness: 0.45 }));
  neckband.rotation.x = Math.PI / 2;
  collar.add(neckband);
  const atlas = makeAtlas(THREE, ["ring", "spark", "glow", "note", "lines", "star"], { extra: { lines: drawLines } });
  U.atlas = atlas;
  U.fx = new Sprites(THREE, { max: 140, atlas, blend: "add", renderOrder: 6 });
  world.add(U.fx.mesh);
  U.ink = new Sprites(THREE, { max: 70, atlas, blend: "normal", renderOrder: 7 });
  world.add(U.ink.mesh);
  U.noteCols = [new THREE.Color(1, 0.78, 0.2), new THREE.Color(0.95, 0.32, 0.38), new THREE.Color(0.72, 0.52, 1)];
  U.hop = new Spring(0, 170, 9);
  U.perk = 0;
  U.twitch = 2 + U.rnd() * 2;
  U.T = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), up: new THREE.Vector3(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1), m: new THREE.Matrix4() };
  U.down = new THREE.Vector3(0, -1, 0);
  U.showcase = false;
  g2.add(hatOccluder(THREE));
  return g2;
}
function restWorld(U, H, t) {
  const { a, b, m } = U.T;
  m.multiplyMatrices(U.frame.M, U.hat.matrix);
  for (let i = 0; i < NS; i++) {
    const s = i / (NS - 1), A = H.restA[i], B = H.restB[i];
    a.copy(A).lerp(B, U.perk);
    const w = s * s;
    a.x += Math.sin(t * 1.15 + H.ph) * 0.55 * w;
    a.y += Math.sin(t * 0.83 + H.ph * 1.7) * 0.35 * w;
    a.z += Math.sin(t * 0.7 + H.ph * 0.6) * 0.4 * w;
    b.copy(a).applyMatrix4(m);
    H.rest[i * 3] = b.x;
    H.rest[i * 3 + 1] = b.y;
    H.rest[i * 3 + 2] = b.z;
  }
}
function jingle(U, H, k) {
  const r = U.rnd, A = U.atlas.cell, p = U.T.c.copy(H.bell.position);
  H.cool = 0.16 + r() * 0.08;
  H.glint = Math.max(H.glint, 0.5 + 0.5 * k);
  H.spin.v += (r() < 0.5 ? -1 : 1) * (22 + 30 * k);
  const c = U.T.d.set(0, 4, 0);
  U.frame.toWorld(c, c);
  let ox = p.x - c.x, oy = p.y - c.y;
  const L = Math.hypot(ox, oy) || 1;
  ox /= L;
  oy /= L;
  U.fx.spawn((__s0["x"] = p.x, __s0["y"] = p.y, __s0["z"] = p.z + 0.5, __s0["life"] = 0.3, __s0["size"] = 2.6, __s0["size1"] = 6 + 2.5 * k, __s0["r"] = 1, __s0["g"] = 0.78, __s0["b"] = 0.3, __s0["a"] = 0.22 + 0.25 * k, __s0["cell"] = A.ring, __s0["fadeIn"] = 0, __s0["fadeOut"] = 0.9, __s0));
  U.fx.spawn((__s1["x"] = p.x, __s1["y"] = p.y, __s1["z"] = p.z + 0.6, __s1["life"] = 0.28, __s1["size"] = 3.2 + 2 * k, __s1["size1"] = 1.5, __s1["r"] = 1, __s1["g"] = 0.8, __s1["b"] = 0.45, __s1["a"] = 0.55, __s1["cell"] = A.glow, __s1["fadeIn"] = 0, __s1["fadeOut"] = 0.9, __s1));
  U.fx.spawn((__s2["x"] = p.x, __s2["y"] = p.y, __s2["z"] = p.z + 0.7, __s2["life"] = 0.32, __s2["size"] = 2.4 + 1.6 * k, __s2["size1"] = 0.6, __s2["r"] = 1, __s2["g"] = 0.92, __s2["b"] = 0.7, __s2["a"] = 0.9, __s2["rot"] = r() * 3, __s2["spin"] = 5, __s2["cell"] = A.spark, __s2["fadeIn"] = 0, __s2["fadeOut"] = 0.7, __s2));
  for (let i = 0; i < 2 + Math.round(3 * k); i++) {
    const a = Math.atan2(oy, ox) + (r() - 0.5) * 2.2, sp = 14 + r() * 18;
    U.fx.spawn((__s3["x"] = p.x, __s3["y"] = p.y, __s3["z"] = p.z + 0.5, __s3["vx"] = Math.cos(a) * sp, __s3["vy"] = Math.sin(a) * sp, __s3["vz"] = (r() - 0.5) * 6, __s3["life"] = 0.4 + r() * 0.3, __s3["size"] = 0.9 + r() * 0.8, __s3["size1"] = 0.2, __s3["r"] = 1, __s3["g"] = 0.86, __s3["b"] = 0.5, __s3["a"] = 1, __s3["cell"] = A.spark, __s3["spin"] = 4, __s3["drag"] = 3, __s3["fadeIn"] = 0.05, __s3["fadeOut"] = 0.6, __s3));
  }
  for (let sgn = -1; sgn <= 1; sgn += 2) {
    const a = Math.atan2(oy, ox) + sgn * 0.6, d = 2.6;
    U.ink.spawn((__s4["x"] = p.x + Math.cos(a) * d, __s4["y"] = p.y + Math.sin(a) * d, __s4["z"] = p.z + 0.8, __s4["vx"] = Math.cos(a) * 7, __s4["vy"] = Math.sin(a) * 7, __s4["life"] = 0.42, __s4["size"] = 3.2 + 1.6 * k, __s4["size1"] = 4.4 + 1.8 * k, __s4["r"] = 1, __s4["g"] = 0.78, __s4["b"] = 0.16, __s4["a"] = 1, __s4["rot"] = a, __s4["cell"] = A.lines, __s4["fadeIn"] = 0.06, __s4["fadeOut"] = 0.5, __s4));
  }
  if (k > 0.55 && r() < 0.7) note(U, p, ox, oy);
}
function note(U, p, ox, oy) {
  const r = U.rnd, c = U.noteCols[Math.floor(r() * 3)];
  U.ink.spawn((__s5["x"] = p.x + ox * 1.5, __s5["y"] = p.y + oy * 1.5 + 1, __s5["z"] = p.z + 1, __s5["vx"] = ox * 5 + (r() - 0.5) * 4, __s5["vy"] = 9 + r() * 6, __s5["life"] = 1.5, __s5["size"] = 3 + r() * 1.2, __s5["size1"] = 3.6, __s5["r"] = c.r, __s5["g"] = c.g, __s5["b"] = c.b, __s5["a"] = 1, __s5["rot"] = (r() - 0.5) * 0.6, __s5["spin"] = (r() - 0.5) * 1.2, __s5["cell"] = U.atlas.cell.note, __s5["wob"] = 3, __s5["wf"] = 3, __s5["fadeIn"] = 0.1, __s5["fadeOut"] = 0.4, __s5));
}
function update(g2, bs, t, h) {
  const U = g2.userData;
  if (!U.frame) return;
  const dt = U.tick.tick(t);
  U.frame.update(dt);
  U.world.userData.sync();
  const e = U.expr.update(bs, dt, h);
  const T = U.T;
  U.perk += (smooth(0.25, 0.8, e.browUp) - U.perk) * Math.min(1, dt * 7);
  const fired = U.trig.update(e.smile, dt);
  if (fired) U.hop.v += 34;
  U.hop.step(dt, 0);
  U.hat.position.set(B0[0], B0[1] + U.hop.x * 0.955, B0[2] - U.hop.x * 0.295);
  U.hat.rotation.z = U.hop.x * 0.02;
  U.hat.updateMatrix();
  const gw = T.a.set(0, -1, 0), gr = T.b.set(0, -1, 0);
  U.frame.dirToWorld(gr, gr);
  const G = 650, gx = (gw.x - gr.x) * G, gy = (gw.y - gr.y) * G, gz = (gw.z - gr.z) * G;
  const upW = T.d.set(0, 1, 0);
  U.frame.dirToWorld(upW, upW);
  const show = !U.frame.attached && !U.showcase;
  if (show) U.showcase = true;
  U.twitch -= dt;
  const twitchHorn = U.twitch <= 0 ? Math.floor(U.rnd() * 3) : -1;
  if (U.twitch <= 0) U.twitch = 3.5 + U.rnd() * 3.5;
  for (let hi = 0; hi < U.horns.length; hi++) {
    const H = U.horns[hi];
    const tipPrev = T.c.set(H.rest[(NS - 1) * 3], H.rest[(NS - 1) * 3 + 1], H.rest[(NS - 1) * 3 + 2]);
    H.restP[0] = tipPrev.x;
    H.restP[1] = tipPrev.y;
    H.restP[2] = tipPrev.z;
    restWorld(U, H, t);
    const X = H.x, XP = H.xp, R = H.rest;
    if (!H.init || dt <= 0) {
      X.set(R);
      XP.set(R);
      H.init = true;
      H.arm = 0;
    }
    H.arm++;
    const seg = H.lenA + (H.lenB - H.lenA) * U.perk;
    const sub = dt > 1 / 45 ? 2 : 1, hh = dt / sub, damp = Math.pow(0.885, hh * 60);
    if (fired || hi === twitchHorn) {
      const kk = fired ? 0.75 : 0.3, sd = H.side || (U.rnd() < 0.5 ? -1 : 1);
      for (let i = 3; i < NS; i++) {
        const s = i / (NS - 1);
        XP[i * 3] -= (upW.x * 0.55 + sd * 0.25) * s * kk * 1.4;
        XP[i * 3 + 1] -= upW.y * 0.55 * s * kk * 1.4;
        XP[i * 3 + 2] -= upW.z * 0.55 * s * kk * 1.4;
      }
    }
    for (let k = 0; k < sub; k++) {
      for (let i = 0; i < 3; i++) {
        for (let c = 0; c < 3; c++) {
          XP[i * 3 + c] = X[i * 3 + c];
          X[i * 3 + c] = R[i * 3 + c];
        }
      }
      for (let i = 3; i < NS; i++) {
        const s = i / (NS - 1), kS = 150 * Math.pow(1 - s, 1.5) + 30 + U.perk * 60, i3 = i * 3;
        for (let c = 0; c < 3; c++) {
          const x = X[i3 + c], v = (x - XP[i3 + c]) * damp;
          const acc = (c === 0 ? gx : c === 1 ? gy : gz) * s + kS * (R[i3 + c] - x);
          XP[i3 + c] = x;
          X[i3 + c] = x + v + acc * hh * hh;
        }
      }
      for (let it = 0; it < 2; it++) for (let i = 3; i < NS; i++) {
        const i3 = i * 3, j3 = i3 - 3;
        let dx = X[i3] - X[j3], dy = X[i3 + 1] - X[j3 + 1], dz = X[i3 + 2] - X[j3 + 2];
        const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, f = seg / L;
        X[i3] = X[j3] + dx * f;
        X[i3 + 1] = X[j3 + 1] + dy * f;
        X[i3 + 2] = X[j3 + 2] + dz * f;
      }
    }
    const P = H.pts;
    for (let i = 0; i < NS - 1; i++) {
      const i0 = Math.max(0, i - 1) * 3, i1 = i * 3, i2 = (i + 1) * 3, i3 = Math.min(NS - 1, i + 2) * 3;
      for (let q = 0; q < SUB; q++) {
        const u = q / SUB, u2 = u * u, u32 = u2 * u, o = (i * SUB + q) * 3;
        for (let c = 0; c < 3; c++) {
          const p0 = X[i0 + c], p1 = X[i1 + c], p2 = X[i2 + c], p3 = X[i3 + c];
          P[o + c] = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u32);
        }
      }
    }
    {
      const o = (NR - 1) * 3, e32 = (NS - 1) * 3;
      P[o] = X[e32];
      P[o + 1] = X[e32 + 1];
      P[o + 2] = X[e32 + 2];
    }
    const u3 = U.up3;
    u3[0] = upW.x;
    u3[1] = upW.y;
    u3[2] = upW.z;
    H.tube.update(P, u3);
    const e3 = (NS - 1) * 3, d3 = (NS - 2) * 3;
    const dir = T.a.set(X[e3] - X[d3], X[e3 + 1] - X[d3 + 1], X[e3 + 2] - X[d3 + 2]).normalize();
    H.bell.position.set(X[e3], X[e3 + 1], X[e3 + 2]).addScaledVector(dir, 1.45);
    const ang = H.spin.step(dt, 0) * 0.02;
    T.q.setFromUnitVectors(T.Y, dir.negate());
    T.q2.setFromAxisAngle(T.Z, ang);
    H.bell.quaternion.copy(T.q).multiply(T.q2);
    if (dt > 0) {
      const vx = (X[e3] - XP[e3] - (R[e3] - H.restP[0]) / sub) / hh, vy = (X[e3 + 1] - XP[e3 + 1] - (R[e3 + 1] - H.restP[1]) / sub) / hh, vz = (X[e3 + 2] - XP[e3 + 2] - (R[e3 + 2] - H.restP[2]) / sub) / hh;
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
      H.shake = Math.max(sp, H.shake * Math.exp(-6 * dt));
      H.cool -= dt;
      if (H.arm > 4 && H.cool <= 0 && sp > 26) jingle(U, H, clamp((sp - 26) / 70));
    }
    if (fired || show) {
      jingle(U, H, 1);
      note(U, H.bell.position, H.side || 0.3, 1);
    }
    H.glint *= Math.exp(-5 * dt);
    H.bm.emissiveIntensity = 0.05 + H.glint * 0.9;
  }
  U.fx.update(dt, U.down);
  U.ink.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
