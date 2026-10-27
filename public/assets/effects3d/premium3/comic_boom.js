// Tiditalk — effetto viso 3D "comic_boom" (premium3). Codice originale, AGPL-3.0. GENERATO da _src/fx/comic_boom.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

// lib/core.js
var clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
var easeOutElastic = (t) => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
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

// lib/stroke.js
var VS = (
  /* glsl */
  `
attribute vec3 aTan; attribute float aSide; attribute float aW; attribute float aA;
varying float vV; varying float vA;
void main() {
  vec4 wc = modelMatrix * vec4(position, 1.0);
  vec3 viewDir = normalize(cameraPosition - wc.xyz);
  vec3 t = normalize(mat3(modelMatrix) * aTan);
  vec3 sd = cross(t, viewDir); float L = length(sd); sd = L > 1e-4 ? sd / L : vec3(1.0, 0.0, 0.0);
  wc.xyz += sd * aSide * aW * 0.5;
  vV = aSide; vA = aA;
  gl_Position = projectionMatrix * viewMatrix * wc;
}`
);
var FS_GLOW = (
  /* glsl */
  `
uniform vec3 uCore; uniform vec3 uGlow; uniform float uK;
varying float vV; varying float vA;
void main() {
  float d = abs(vV);
  float core = exp(-d * d * uK);
  float glow = exp(-d * d * 3.0) * 0.6;
  vec3 c = uCore * core + uGlow * glow;
  float a = vA * max(core, glow);
  gl_FragColor = vec4(c * vA, a);
  #include <colorspace_fragment>
}`
);
var Strokes = class {
  constructor(THREE, { max = 256, fragmentShader = FS_GLOW, uniforms = null, blend = "add", renderOrder = 5 } = {}) {
    this.max = max;
    this.n = 0;
    this.ni = 0;
    const D = THREE.DynamicDrawUsage, geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 6), 3).setUsage(D);
    this.aTan = new THREE.BufferAttribute(new Float32Array(max * 6), 3).setUsage(D);
    this.aSide = new THREE.BufferAttribute(new Float32Array(max * 2), 1).setUsage(D);
    this.aW = new THREE.BufferAttribute(new Float32Array(max * 2), 1).setUsage(D);
    this.aA = new THREE.BufferAttribute(new Float32Array(max * 2), 1).setUsage(D);
    this.idx = new THREE.BufferAttribute(new Uint16Array(max * 6), 1).setUsage(D);
    geo.setAttribute("position", this.aPos);
    geo.setAttribute("aTan", this.aTan);
    geo.setAttribute("aSide", this.aSide);
    geo.setAttribute("aW", this.aW);
    geo.setAttribute("aA", this.aA);
    geo.setIndex(this.idx);
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      uniforms: uniforms || { uCore: { value: new THREE.Color(1, 1, 1) }, uGlow: { value: new THREE.Color(0.4, 0.6, 1) }, uK: { value: 40 } },
      vertexShader: VS,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: blend === "add" ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
  }
  begin() {
    this.n = 0;
    this.ni = 0;
  }
  // pts: array piatto [x,y,z, ...]; w: numero o funzione(i, n); a: alfa (numero o funzione)
  line(pts, w = 1, a = 1, count = pts.length / 3) {
    const m = count;
    if (m < 2 || this.n + m > this.max) return;
    const P = this.aPos.array, T = this.aTan.array, S = this.aSide.array, W = this.aW.array, A = this.aA.array, I = this.idx.array;
    const base = this.n;
    for (let i = 0; i < m; i++) {
      const p0 = Math.max(0, i - 1), p1 = Math.min(m - 1, i + 1);
      let tx = pts[p1 * 3] - pts[p0 * 3], ty = pts[p1 * 3 + 1] - pts[p0 * 3 + 1], tz = pts[p1 * 3 + 2] - pts[p0 * 3 + 2];
      const L = Math.hypot(tx, ty, tz) || 1;
      tx /= L;
      ty /= L;
      tz /= L;
      const ww = typeof w === "function" ? w(i, m) : w, aa = typeof a === "function" ? a(i, m) : a;
      for (let s = 0; s < 2; s++) {
        const v = (base + i) * 2 + s;
        P[v * 3] = pts[i * 3];
        P[v * 3 + 1] = pts[i * 3 + 1];
        P[v * 3 + 2] = pts[i * 3 + 2];
        T[v * 3] = tx;
        T[v * 3 + 1] = ty;
        T[v * 3 + 2] = tz;
        S[v] = s ? 1 : -1;
        W[v] = ww;
        A[v] = aa;
      }
      if (i < m - 1) {
        const q = (base + i) * 2, k = this.ni;
        I[k] = q;
        I[k + 1] = q + 1;
        I[k + 2] = q + 2;
        I[k + 3] = q + 1;
        I[k + 4] = q + 3;
        I[k + 5] = q + 2;
        this.ni += 6;
      }
    }
    this.n += m;
  }
  end() {
    this.geo.setDrawRange(0, this.ni);
    this.aPos.needsUpdate = this.aTan.needsUpdate = this.aSide.needsUpdate = this.aW.needsUpdate = this.aA.needsUpdate = this.idx.needsUpdate = true;
  }
};

// fx/comic_boom.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "spin": void 0, "drag": void 0, "grav": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var meta = { label: "Fumetto BOOM!", labelEn: "Comic BOOM!", labelFr: "BOUM de BD", labelDe: "Comic-BUMM!", category: "divertenti", icon: "\u{1F4A5}" };
var WORDS = ["BOOM!", "SBAM!", "WOW!", "POW!"];
var INK_FS = (
  /* glsl */
  `
uniform vec3 uCore; uniform vec3 uGlow; uniform float uK;
varying float vV; varying float vA;
void main() {
  float a = vA * (1.0 - smoothstep(0.7, 1.0, abs(vV))); if (a < 0.01) discard; gl_FragColor = vec4(uCore, a);
  #include <colorspace_fragment>
}`
);
function burstPoly(r, n = 15) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = i / (n * 2) * Math.PI * 2 + 0.1, rad = i % 2 ? 0.66 + r() * 0.06 : 0.95 + r() * 0.17;
    pts.push([Math.cos(a) * rad * 1.18, Math.sin(a) * rad * 0.9]);
  }
  return pts;
}
function burstTexture(THREE, poly, word, seed) {
  const S = 512, c = canvas(S), x = c.getContext("2d");
  const k = S / 2.6, cx = S / 2, cy = S / 2;
  const path = (scale) => {
    x.beginPath();
    poly.forEach(([px, py], i) => {
      const X = cx + px * k * scale, Y = cy - py * k * scale;
      i ? x.lineTo(X, Y) : x.moveTo(X, Y);
    });
    x.closePath();
  };
  x.fillStyle = "#ffd21f";
  path(1);
  x.fill();
  x.save();
  path(1);
  x.clip();
  for (let yy = 0; yy < S; yy += 13) for (let xx = yy / 13 % 2 ? 6 : 0; xx < S; xx += 13) {
    const d = Math.hypot(xx - cx, yy - cy) / (S * 0.5);
    x.fillStyle = "rgba(255,120,0,0.55)";
    x.beginPath();
    x.arc(xx, yy, 1.2 + d * 3.8, 0, 6.3);
    x.fill();
  }
  x.restore();
  x.fillStyle = "#ff3b1f";
  path(0.7);
  x.fill();
  x.lineWidth = 6;
  x.strokeStyle = "#7a1200";
  x.stroke();
  x.fillStyle = "rgba(255,255,255,0.25)";
  x.beginPath();
  x.ellipse(cx - 60, cy - 70, 90, 40, -0.4, 0, 6.3);
  x.fill();
  path(1);
  x.lineJoin = "round";
  x.lineWidth = 16;
  x.strokeStyle = "#111";
  x.stroke();
  x.save();
  x.translate(cx, cy + 8);
  x.rotate(-0.12);
  x.transform(1, 0, -0.18, 1, 0, 0);
  const FONT = (n) => `900 ${n}px "Arial Black", "Impact", "Helvetica Neue", Arial, sans-serif`;
  let fs = 130;
  x.font = FONT(fs);
  const mw = x.measureText(word).width;
  if (mw > 290) {
    fs = Math.floor(fs * 290 / mw);
    x.font = FONT(fs);
  }
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.lineJoin = "round";
  x.lineWidth = 30;
  x.strokeStyle = "#111";
  x.strokeText(word, 0, 0);
  x.lineWidth = 12;
  x.strokeStyle = "#fff";
  x.strokeText(word, 0, 0);
  const gr = x.createLinearGradient(0, -fs / 2, 0, fs / 2);
  gr.addColorStop(0, "#fff7c2");
  gr.addColorStop(0.5, "#ffe14a");
  gr.addColorStop(1, "#ff9a1a");
  x.fillStyle = gr;
  x.fillText(word, 0, 0);
  x.restore();
  const t = texFrom(THREE, c, { wrap: false });
  t.offset.set(0.5, 0.5);
  t.repeat.set(1 / 2.6, 1 / 2.6);
  return t;
}
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.expr = new Expr(["jaw"]);
  U.kick = new Kick({ rise: 0.5, level: 0.62, win: 0.3, cooldown: 1 });
  U.rnd = rng(51);
  const r = rng(77);
  const poly = burstPoly(r);
  const shape = new THREE.Shape();
  poly.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 2, curveSegments: 1 });
  geo.translate(0, 0, -0.08);
  U.texs = WORDS.map((w, i) => burstTexture(THREE, poly, w, i));
  U.face = new THREE.MeshStandardMaterial({ map: U.texs[0], roughness: 0.55, metalness: 0, transparent: true });
  const side = new THREE.MeshStandardMaterial({ color: 1710618, roughness: 0.6, transparent: true });
  U.burst = new THREE.Mesh(geo, [U.face, side]);
  U.burst.visible = false;
  U.burst.renderOrder = 6;
  U.holder = new THREE.Group();
  U.holder.add(U.burst);
  g2.add(U.holder);
  U.lines = new Strokes(THREE, { max: 64, fragmentShader: INK_FS, blend: "normal", renderOrder: 5 });
  U.lines.mat.uniforms.uCore.value.setRGB(0.06, 0.06, 0.06);
  g2.add(U.lines.mesh);
  U.rayA = new Float32Array(12);
  U.rayL = new Float32Array(12);
  U.nRays = 0;
  U.ray6 = new Float32Array(6);
  const world = worldRoot(THREE, g2, U.frame);
  U.world = world;
  const atlas = makeAtlas(THREE, ["star", "spark", "dot", "smoke"]);
  U.atlas = atlas;
  U.spr = new Sprites(THREE, { max: 80, atlas, blend: "normal", renderOrder: 7 });
  world.add(U.spr.mesh);
  U.age = 99;
  U.side = 1;
  U.word = 0;
  U.v = new THREE.Vector3();
  U.down = new THREE.Vector3(0, -1, 0);
  U.showcase = false;
  U.rays = [];
  return g2;
}
var rayW = (i) => i ? 0.15 : 0.7;
function fire(U) {
  const r = U.rnd;
  U.side = -U.side;
  U.word = (U.word + 1) % WORDS.length;
  if (U.first === void 0) {
    U.first = true;
    U.word = 0;
  }
  U.face.map = U.texs[U.word];
  U.face.needsUpdate = true;
  U.age = 0;
  U.burst.visible = true;
  U.holder.position.set(U.side * 14.5, 9.5, 4.5);
  U.holder.rotation.set(0, -U.side * 0.25, U.side * -0.18 + (r() - 0.5) * 0.1);
  U.nRays = 0;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + r() * 0.3;
    if (Math.cos(a) * U.side < -0.25) continue;
    U.rayA[U.nRays] = a;
    U.rayL[U.nRays] = 0.9 + r() * 0.5;
    U.nRays++;
  }
  const p = U.v.copy(U.holder.position);
  U.frame.toWorld(p, p);
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, sp = 50 + r() * 60, star = i < 10;
    U.spr.spawn((__s0["x"] = p.x, __s0["y"] = p.y, __s0["z"] = p.z + 1, __s0["vx"] = Math.cos(a) * sp, __s0["vy"] = Math.sin(a) * sp, __s0["vz"] = 10, __s0["life"] = star ? 0.7 : 0.9, __s0["size"] = star ? 1.4 + r() * 1.4 : 0.8 + r() * 0.8, __s0["size1"] = star ? 0.4 : 0.2, __s0["r"] = 1, __s0["g"] = star ? 0.85 : 0.35, __s0["b"] = star ? 0.15 : 0.15, __s0["a"] = 1, __s0["cell"] = star ? U.atlas.cell.star : U.atlas.cell.dot, __s0["spin"] = (r() - 0.5) * 8, __s0["drag"] = 4, __s0["grav"] = star ? 80 : -10, __s0["fadeIn"] = 0.05, __s0["fadeOut"] = 0.5, __s0));
  }
}
function update(g2, bs, t, h) {
  const U = g2.userData;
  if (!U.frame) return;
  const dt = U.tick.tick(t);
  U.frame.update(dt);
  U.world.userData.sync();
  const e = U.expr.update(bs, dt, h);
  if (U.kick.update(e.jaw, dt)) fire(U);
  if (!U.frame.attached && !U.showcase) {
    U.showcase = true;
    fire(U);
    U.age = 0.6;
    for (let k = 0; k < 8; k++) U.spr.update(0.03, U.down);
  }
  U.age += dt;
  const A = U.age, life = 1.45;
  U.lines.begin();
  if (A < life) {
    let s = A < 0.5 ? easeOutElastic(A / 0.5) : 1;
    if (A > life - 0.25) {
      const q = (A - (life - 0.25)) / 0.25;
      s *= 1 - q * q;
    }
    const sh = A < 1 ? 0.25 * (1 - A) : 0;
    const S = 6.6 * Math.max(s, 1e-3);
    U.burst.scale.set(S, S, S * 1.2);
    U.burst.position.set(Math.sin(t * 61) * sh, Math.cos(t * 53) * sh, 0);
    U.burst.rotation.z = Math.sin(t * 13) * 0.04 * (1 - Math.min(1, A));
    const hp = U.holder.position, grow = clamp(A / 0.25), fade = 1 - clamp((A - 0.6) / 0.5);
    if (fade > 0) for (let k = 0; k < U.nRays; k++) {
      const a = U.rayA[k], l = U.rayL[k], L6 = U.ray6;
      const r0 = 9.5 * Math.max(s, 0.3), r1 = r0 + 4.5 * l * grow, c = Math.cos(a), sn = Math.sin(a);
      L6[0] = hp.x + c * r0 * 1.15;
      L6[1] = hp.y + sn * r0 * 0.9;
      L6[2] = hp.z;
      L6[3] = hp.x + c * r1 * 1.15;
      L6[4] = hp.y + sn * r1 * 0.9;
      L6[5] = hp.z;
      U.lines.line(L6, rayW, fade);
    }
  } else U.burst.visible = false;
  U.lines.end();
  U.spr.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
