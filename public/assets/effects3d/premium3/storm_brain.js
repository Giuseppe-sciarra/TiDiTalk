// Tiditalk — effetto viso 3D "storm_brain" (premium3). Codice originale, AGPL-3.0. GENERATO da _src/fx/storm_brain.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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
var Bolt = class _Bolt {
  constructor(depth = 5, maxBranches = 2, branchDepth = 3) {
    this.depth = depth;
    this.bd = branchDepth;
    this.main = new Float32Array(((1 << depth) + 1) * 3);
    this.nMain = 0;
    this.br = [];
    for (let k = 0; k < maxBranches; k++) this.br.push(new Float32Array(((1 << branchDepth) + 1) * 3));
    this.nBr = 0;
    this.nBrPts = (1 << branchDepth) + 1;
  }
  static fill(P, depth, r, ax, ay, az, bx, by, bz, jag) {
    const N = (1 << depth) + 1;
    P[0] = ax;
    P[1] = ay;
    P[2] = az;
    P[(N - 1) * 3] = bx;
    P[(N - 1) * 3 + 1] = by;
    P[(N - 1) * 3 + 2] = bz;
    let amp = Math.hypot(bx - ax, by - ay, bz - az) * jag;
    for (let step = N - 1; step > 1; step >>= 1) {
      const h = step >> 1;
      for (let i = 0; i < N - 1; i += step) {
        const i0 = i * 3, i1 = (i + step) * 3, m = (i + h) * 3;
        P[m] = (P[i0] + P[i1]) / 2 + (r() - 0.5) * amp;
        P[m + 1] = (P[i0 + 1] + P[i1 + 1]) / 2 + (r() - 0.5) * amp * 0.5;
        P[m + 2] = (P[i0 + 2] + P[i1 + 2]) / 2 + (r() - 0.5) * amp * 0.6;
      }
      amp *= 0.55;
    }
    return N;
  }
  make(r, ax, ay, az, bx, by, bz, { jag = 0.22, branches = 2 } = {}) {
    const M = this.main;
    this.nMain = _Bolt.fill(M, this.depth, r, ax, ay, az, bx, by, bz, jag);
    this.nBr = Math.min(branches, this.br.length);
    for (let k = 0; k < this.nBr; k++) {
      const i = 2 + Math.floor(r() * (this.nMain * 0.6)), j = i + 1;
      const sx = M[i * 3], sy = M[i * 3 + 1], sz = M[i * 3 + 2];
      const dx = M[j * 3] - sx, dy = M[j * 3 + 1] - sy, dz = M[j * 3 + 2] - sz;
      const L = 3 + r() * 5;
      _Bolt.fill(this.br[k], this.bd, r, sx, sy, sz, sx + dx * 2 + (r() - 0.5) * L * 1.6, sy - L * (0.6 + r() * 0.5), sz + dz * 2 + (r() - 0.5) * L * 0.5, 0.3);
    }
    return this;
  }
};

// fx/storm_brain.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s1 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "drag": void 0, "grav": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s2 = { "x": void 0, "y": void 0, "z": void 0, "vy": void 0, "vx": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "rot": void 0, "spin": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s3 = { "x": void 0, "y": void 0, "z": void 0, "vy": void 0, "vx": void 0, "life": void 0, "size": void 0, "aspect": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "fadeIn": void 0, "fadeOut": void 0, "grav": void 0 };
var __s4 = { "x": void 0, "y": void 0, "z": void 0, "vy": void 0, "life": void 0, "size": void 0, "aspect": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "fadeIn": void 0, "fadeOut": void 0, "grav": void 0 };
var meta = { label: "Temporale in testa", labelEn: "Brainstorm", labelFr: "Orage dans la t\xEAte", labelDe: "Gewitter im Kopf", category: "divertenti", icon: "\u26C8\uFE0F" };
var PUFFS = [
  [0, 1.6, 0, 4.4],
  [-4.6, 0.3, 0.2, 3.3],
  [4.7, 0.5, 0.1, 3.5],
  [-8, -0.8, 0, 2.3],
  [8.2, -0.7, -0.1, 2.4],
  [-2.4, 3.9, -0.6, 3],
  [2.6, 3.4, 0.5, 2.9],
  [-1.2, 0.2, 2.4, 2.9],
  [1.8, 0.1, 2.3, 2.7],
  [0, 0.6, -2.6, 3.4],
  [-4.8, 1.6, -1.9, 2.5],
  [5, 1.4, -1.8, 2.6],
  [-6.2, -0.4, 1.7, 2.1],
  [6.4, -0.3, 1.6, 2.1],
  [0.4, 5.6, 0.2, 2.2]
];
var PF = new Float32Array(PUFFS.flat());
function cloudSdf(x, y, z) {
  let d = 1e9;
  for (let i = 0; i < PF.length; i += 4) {
    const a = x - PF[i], b = y - PF[i + 1], c = z - PF[i + 2];
    d = sd.smin(d, Math.sqrt(a * a + b * b + c * c) - PF[i + 3], 0.9);
  }
  d = sd.smax(d, -(y + 1.9), 1);
  return d + 0.07 * Math.sin(x * 2.9 + y * 1.7) * Math.sin(z * 2.5 - y * 1.9);
}
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.expr = new Expr(["browDown", "smile"]);
  U.sunT = new Trigger({ on: 0.55, off: 0.3, cooldown: 0.3 });
  U.trig = new Trigger({ on: 0.5, off: 0.25, hold: 0.1, cooldown: 0.3 });
  U.rnd = rng(9);
  const geo = surfaceNets(THREE, cloudSdf, [-11, -3.2, -6.6], [11, 8.4, 6.4], 44, (x, y, z, nx, ny, nz) => {
    const ao = clamp(cloudSdf(x + nx * 1.1, y + ny * 1.1, z + nz * 1.1) / 1.1);
    const k = clamp((y + 2) / 9), v = (0.6 + 0.4 * k) * (0.66 + 0.34 * ao);
    return [v, v, v * 1.02];
  }, "cloud");
  U.cmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, color: 16777215, emissive: 10470143, emissiveIntensity: 0, transparent: true });
  U.cloud = new THREE.Mesh(geo, U.cmat);
  U.cloudPos = new THREE.Vector3(0, 21, -2.5);
  U.cloud.position.copy(U.cloudPos);
  g2.add(U.cloud);
  U.bolts = new Strokes(THREE, { max: 220 });
  g2.add(U.bolts.mesh);
  U.bolt = new Bolt(5, 2, 3);
  U.boltHead = { jag: 0.25, branches: 1 };
  U.boltSide = { jag: 0.16, branches: 2 };
  U.bolts.mat.uniforms.uCore.value.setRGB(1, 1, 1);
  U.bolts.mat.uniforms.uGlow.value.setRGB(0.45, 0.62, 1);
  const world = worldRoot(THREE, g2, U.frame);
  U.world = world;
  const atlas = makeAtlas(THREE, ["drop", "glow", "spark", "smoke"]);
  U.atlas = atlas;
  U.rain = new Sprites(THREE, { max: 160, atlas, blend: "normal", renderOrder: 3 });
  U.glow = new Sprites(THREE, { max: 60, atlas, blend: "add", renderOrder: 6 });
  U.puff = new Sprites(THREE, { max: 30, atlas, blend: "normal", renderOrder: 4 });
  world.add(U.rain.mesh, U.glow.mesh, U.puff.mesh);
  const sun = new THREE.Group();
  U.sun = sun;
  g2.add(sun);
  const sunM = new THREE.MeshStandardMaterial({ color: 16763176, emissive: 16753664, emissiveIntensity: 0.85, roughness: 0.4, transparent: true });
  sun.add(new THREE.Mesh(new THREE.SphereGeometry(3.3, 32, 24), sunM));
  const rays = [];
  for (let i = 0; i < 12; i++) {
    const c = new THREE.ConeGeometry(0.75, 2.3, 12);
    c.translate(0, 5, 0);
    c.rotateZ(i / 12 * Math.PI * 2);
    rays.push(c);
  }
  U.rays = new THREE.Mesh(merge(THREE, rays), new THREE.MeshStandardMaterial({ color: 16757274, emissive: 16747008, emissiveIntensity: 0.7, roughness: 0.45, transparent: true }));
  sun.add(U.rays);
  const ink = new THREE.MeshBasicMaterial({ color: 5909e3, transparent: true });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.13, 8, 16, Math.PI), ink);
    eye.position.set(sx * 1.25, 0.55, 3.2);
    sun.add(eye);
    const ck = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ color: 16742992, transparent: true, opacity: 0.55 }));
    ck.position.set(sx * 2, -0.45, 2.85);
    ck.rotation.y = sx * 0.5;
    sun.add(ck);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.15, 8, 20, Math.PI), ink);
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -0.35, 3.25);
  sun.add(mouth);
  U.sunHome = new THREE.Vector3(7.5, 23.5, -4.5);
  sun.position.copy(U.sunHome);
  sun.scale.setScalar(1e-3);
  const rb = new THREE.Group();
  U.rainbow = rb;
  g2.add(rb);
  rb.position.set(-9.5, 10.5, -2.5);
  const RC = [16726832, 16749824, 16766474, 3458905, 689407, 9329911];
  U.rbMats = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.MeshBasicMaterial({ color: RC[i], transparent: true, opacity: 0, depthWrite: false });
    U.rbMats.push(m);
    rb.add(new THREE.Mesh(new THREE.TorusGeometry(8.6 - i * 0.55, 0.3, 8, 72, Math.PI), m));
  }
  U.sunK = 0;
  U.storm = 0;
  U.flash = 0;
  U.next = 0.6;
  U.boltLife = 0;
  U.lines = null;
  U.accR = 0;
  U.white = new THREE.Color(16777215);
  U.dark = new THREE.Color(4871016);
  U.grey = new THREE.Color(14541546);
  U.v = new THREE.Vector3();
  U.down = new THREE.Vector3(0, -1, 0);
  U.showcase = false;
  return g2;
}
function strike(U) {
  const r = U.rnd, c = U.cloud.position, s = U.cloud.scale.x;
  let ax = c.x + (r() - 0.5) * 9 * s, ay = c.y - 2.2 * s, az = c.z + 1 + r() * 2, bx, by, bz;
  const head = r() < 0.3;
  if (head) {
    bx = (r() - 0.5) * 6;
    by = 12.2;
    bz = -0.5 + r();
  } else {
    const side = r() < 0.5 ? -1 : 1;
    bx = side * (12.5 + r() * 4);
    by = -5 - r() * 9;
    bz = -1 + r() * 2;
    ax = c.x + side * (7 + r() * 2) * s;
    az = c.z + 1.5;
  }
  U.bolt.make(r, ax, ay, az, bx, by, bz, head ? U.boltHead : U.boltSide);
  U.lines = true;
  U.boltLife = 0.22 + r() * 0.12;
  U.boltAge = 0;
  U.flash = 1;
  const p = U.v.set(c.x, c.y - 1, c.z + 1);
  U.frame.toWorld(p, p);
  U.glow.spawn((__s0["x"] = p.x, __s0["y"] = p.y, __s0["z"] = p.z, __s0["life"] = 0.25, __s0["size"] = 26, __s0["size1"] = 30, __s0["r"] = 0.6, __s0["g"] = 0.75, __s0["b"] = 1, __s0["a"] = 0.5, __s0["cell"] = U.atlas.cell.glow, __s0["fadeIn"] = 0.02, __s0["fadeOut"] = 0.8, __s0));
  if (head) {
    const q = U.v.set(bx, by, bz);
    U.frame.toWorld(q, q);
    for (let i = 0; i < 16; i++) {
      const an = r() * 6.28, sp = 30 + r() * 60;
      U.glow.spawn((__s1["x"] = q.x, __s1["y"] = q.y, __s1["z"] = q.z, __s1["vx"] = Math.cos(an) * sp, __s1["vy"] = Math.abs(Math.sin(an)) * sp + 10, __s1["vz"] = (r() - 0.5) * 30, __s1["life"] = 0.4 + r() * 0.3, __s1["size"] = 1.2 + r(), __s1["size1"] = 0.2, __s1["r"] = 1, __s1["g"] = 0.9, __s1["b"] = 0.5, __s1["a"] = 1, __s1["cell"] = U.atlas.cell.spark, __s1["drag"] = 3, __s1["grav"] = 120, __s1["fadeIn"] = 0.02, __s1["fadeOut"] = 0.5, __s1));
    }
    for (let i = 0; i < 3; i++) U.puff.spawn((__s2["x"] = q.x + (r() - 0.5) * 3, __s2["y"] = q.y + 1, __s2["z"] = q.z, __s2["vy"] = 8 + r() * 6, __s2["vx"] = (r() - 0.5) * 6, __s2["life"] = 1.4, __s2["size"] = 4, __s2["size1"] = 9, __s2["r"] = 0.25, __s2["g"] = 0.24, __s2["b"] = 0.24, __s2["a"] = 0.5, __s2["cell"] = U.atlas.cell.smoke, __s2["rot"] = r() * 6, __s2["spin"] = 0.5, __s2["fadeIn"] = 0.1, __s2["fadeOut"] = 0.6, __s2));
  }
}
function update(g2, bs, t, h) {
  const U = g2.userData;
  if (!U.frame) return;
  const dt = U.tick.tick(t);
  U.frame.update(dt);
  U.world.userData.sync();
  const e = U.expr.update(bs, dt, h);
  U.trig.update(e.browDown, dt);
  let target = U.trig.active ? 1 : 0;
  if (!U.frame.attached && !U.showcase) {
    U.showcase = true;
    U.storm = 1;
    target = 1;
    U.next = 0;
    U.prefill = true;
  }
  U.sunT.update(e.smile, dt);
  if (U.trig.active) U.sunT.active = false;
  let sunTarget = U.sunT.active ? 1 : 0;
  if (U.showcase === true && !U.frame.attached) sunTarget = 0;
  U.storm = damp(U.storm, target, target > U.storm ? 3.5 : 0.8, dt);
  U.sunK = damp(U.sunK, sunTarget, sunTarget > U.sunK ? 3 : 1.5, dt);
  const s = U.storm, sk = U.sunK;
  const sb = Math.max(1e-3, sk);
  U.sun.scale.setScalar(sb);
  U.sun.position.set(U.sunHome.x + (1 - sk) * -3, U.sunHome.y - (1 - sk) * 4 + Math.sin(t * 1.5) * 0.3, U.sunHome.z);
  U.sun.visible = sk > 0.01;
  U.rays.rotation.z = -t * 0.6;
  U.rainbow.visible = sk > 0.01;
  for (let i = 0; i < 6; i++) U.rbMats[i].opacity = clamp(sk * 1.4 - i * 0.06) * 0.8;
  U.cmat.color.copy(U.grey).lerp(U.white, sk).lerp(U.dark, s);
  const sc = 1 + 0.16 * s + Math.sin(t * 1.3) * 0.015;
  U.cloud.scale.set(sc, sc * (1 + Math.sin(t * 2.1) * 0.01), sc);
  const rum = s > 0.5 ? (s - 0.5) * 0.5 : 0;
  U.cloud.position.set(U.cloudPos.x + Math.sin(t * 0.9) * 0.6 + Math.sin(t * 37) * rum, U.cloudPos.y + Math.sin(t * 1.4) * 0.5 + Math.cos(t * 41) * rum * 0.6, U.cloudPos.z);
  U.cloud.rotation.y = Math.sin(t * 0.5) * 0.12;
  U.next -= dt;
  if (s > 0.6 && U.next <= 0) {
    strike(U);
    U.next = 0.45 + U.rnd() * 1.1;
    if (U.rnd() < 0.25) U.next = 0.12;
  }
  U.flash = Math.max(0, U.flash - dt * 5);
  U.cmat.emissiveIntensity = U.flash * 0.9;
  U.bolts.begin();
  if (U.lines && U.boltAge < U.boltLife) {
    U.boltAge += dt;
    const fl = (Math.sin(U.boltAge * 90) > -0.3 ? 1 : 0.35) * (1 - U.boltAge / U.boltLife * 0.6);
    const B = U.bolt;
    U.bolts.line(B.main, 2, fl, B.nMain);
    for (let k = 0; k < B.nBr; k++) U.bolts.line(B.br[k], 1.1, fl * 0.75, B.nBrPts);
  }
  U.bolts.end();
  U.accR += dt * (150 * clamp((s - 0.25) / 0.6) + 18 * (1 - sk) * (1 - clamp(s * 3)));
  while (U.accR >= 1) {
    U.accR -= 1;
    const r = U.rnd, c = U.cloud.position;
    const p = U.v.set(c.x + (r() - 0.5) * 18 * sc, c.y - 2.4 * sc, c.z - 2 + r() * 10);
    U.frame.toWorld(p, p);
    U.rain.spawn((__s3["x"] = p.x, __s3["y"] = p.y, __s3["z"] = p.z, __s3["vy"] = -120 - r() * 50, __s3["vx"] = 0, __s3["life"] = 0.6, __s3["size"] = 1.3, __s3["aspect"] = 3.5, __s3["r"] = 0.85, __s3["g"] = 0.93, __s3["b"] = 1, __s3["a"] = 0.9, __s3["cell"] = U.atlas.cell.drop, __s3["fadeIn"] = 0.1, __s3["fadeOut"] = 0.25, __s3["grav"] = 300, __s3));
  }
  if (U.prefill) {
    U.prefill = false;
    for (let k = 0; k < 20; k++) {
      U.accR += 2;
      while (U.accR >= 1) {
        U.accR -= 1;
        const r = U.rnd, c = U.cloud.position;
        const p = U.v.set(c.x + (r() - 0.5) * 17 * sc, c.y - 2.4 * sc, c.z + (r() - 0.5) * 9);
        U.rain.spawn((__s4["x"] = p.x, __s4["y"] = p.y, __s4["z"] = p.z, __s4["vy"] = -140, __s4["life"] = 0.55, __s4["size"] = 1.4, __s4["aspect"] = 4, __s4["r"] = 0.85, __s4["g"] = 0.93, __s4["b"] = 1, __s4["a"] = 0.9, __s4["cell"] = U.atlas.cell.drop, __s4["fadeIn"] = 0.1, __s4["fadeOut"] = 0.25, __s4["grav"] = 300, __s4));
      }
      U.rain.update(0.03, U.down);
    }
  }
  U.rain.update(dt, U.down);
  U.glow.update(dt, U.down);
  U.puff.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
