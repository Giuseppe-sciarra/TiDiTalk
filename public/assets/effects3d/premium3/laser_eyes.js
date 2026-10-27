// Tiditalk — effetto viso 3D "laser_eyes" (premium3). Codice originale, AGPL-3.0. GENERATO da _src/fx/laser_eyes.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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

// fx/laser_eyes.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "life": void 0, "size": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s1 = { "x": void 0, "y": void 0, "z": void 0, "life": void 0, "size": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s2 = { "x": void 0, "y": void 0, "z": void 0, "life": void 0, "size": void 0, "aspect": void 0, "rot": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s3 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "size1": void 0, "aspect": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "drag": void 0, "grav": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s4 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "rot": void 0, "spin": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s5 = { "x": void 0, "y": void 0, "z": void 0, "vy": void 0, "vx": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "wob": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var meta = { label: "Occhi laser", labelEn: "Laser eyes", labelFr: "Yeux laser", labelDe: "Laseraugen", category: "divertenti", icon: "\u{1F534}" };
var NB = 10;
var EYE = [3.05, 2.62, 4.95];
var W_CORE = (i, m) => 1.7 + i / (m - 1) * 1.6;
var W_HAZE = (i, m) => 5.5 + i / (m - 1) * 6;
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.expr = new Expr(["browUp", "wide"]);
  U.rnd = rng(221);
  U.trig = new Trigger({ on: 0.55, off: 0.32, hold: 0.08, cooldown: 0.25 });
  U.haze = new Strokes(THREE, { max: NB * 2 + 2, renderOrder: 6 });
  U.haze.mat.uniforms.uCore.value.setRGB(1, 0.1, 0.05);
  U.haze.mat.uniforms.uGlow.value.setRGB(0.9, 0.02, 0.02);
  U.haze.mat.uniforms.uK.value = 4;
  U.beam = new Strokes(THREE, { max: NB * 2 + 2, renderOrder: 7 });
  U.beam.mat.uniforms.uCore.value.setRGB(1, 0.9, 0.85);
  U.beam.mat.uniforms.uGlow.value.setRGB(1, 0.15, 0.08);
  U.beam.mat.uniforms.uK.value = 30;
  U.haze.mat.depthTest = U.beam.mat.depthTest = false;
  g2.add(U.haze.mesh, U.beam.mesh);
  const world = worldRoot(THREE, g2, U.frame);
  U.world = world;
  const atlas = makeAtlas(THREE, ["glow", "core", "spark", "smoke"]);
  U.atlas = atlas;
  U.eyeFx = new Sprites(THREE, { max: 16, atlas, blend: "add", renderOrder: 7, depthTest: false });
  U.spr = new Sprites(THREE, { max: 140, atlas, blend: "add", renderOrder: 7 });
  U.smoke = new Sprites(THREE, { max: 30, atlas, blend: "normal", renderOrder: 4 });
  world.add(U.eyeFx.mesh, U.spr.mesh, U.smoke.mesh);
  U.eyes = [];
  for (const sx of [-1, 1]) {
    const o = new THREE.Vector3(EYE[0] * sx, EYE[1], EYE[2]);
    const d = new THREE.Vector3(sx * 0.42, -0.16, 1).normalize();
    U.eyes.push({ sx, o, d, pts: new Float32Array(NB * 3), haze: new Float32Array(NB * 3) });
  }
  U.on = 0;
  U.hold = 0;
  U.charge = 0;
  U.acc = 0;
  U.ember = 0;
  U.v = new THREE.Vector3();
  U.w = new THREE.Vector3();
  U.down = new THREE.Vector3(0, -1, 0);
  U.showcase = false;
  return g2;
}
function update(g2, bs, t, h) {
  const U = g2.userData;
  if (!U.frame) return;
  const dt = U.tick.tick(t);
  U.frame.update(dt);
  U.world.userData.sync();
  const e = U.expr.update(bs, dt, h);
  const x = Math.max(e.browUp, e.wide * 1.1);
  if (U.trig.update(x, dt)) {
    U.hold = 0.7;
    U.flash = 1;
  }
  if (U.trig.active) U.hold = Math.max(U.hold, 0.25);
  if (!U.frame.attached && !U.showcase) {
    U.showcase = true;
    U.hold = 1;
    U.on = 1;
    U.flash = 0.6;
  }
  U.hold -= dt;
  const target = U.hold > 0 ? 1 : 0;
  const was = U.on;
  U.on = damp(U.on, target, target ? 22 : 7, dt);
  U.flash = Math.max(0, (U.flash || 0) - dt * 3);
  const on = U.on, r = U.rnd;
  const pulse = 0.5 + 0.5 * Math.sin(t * 4.2);
  U.beam.begin();
  U.haze.begin();
  if (on > 0.02) {
    for (const E of U.eyes) {
      const P = E.pts, Q = E.haze, L = 80 * Math.min(1, on * 1.4);
      for (let i = 0; i < NB; i++) {
        const s = i / (NB - 1), j = i ? 0.06 + s * 0.12 : 0;
        const x0 = E.o.x + E.d.x * L * s, y0 = E.o.y + E.d.y * L * s, z0 = E.o.z + E.d.z * L * s;
        P[i * 3] = x0 + (r() - 0.5) * j;
        P[i * 3 + 1] = y0 + (r() - 0.5) * j;
        P[i * 3 + 2] = z0;
        Q[i * 3] = x0;
        Q[i * 3 + 1] = y0;
        Q[i * 3 + 2] = z0;
      }
      const fl = (0.85 + 0.15 * Math.sin(t * 61 + E.sx)) * on;
      U.haze.line(Q, W_HAZE, fl * 0.7);
      U.beam.line(P, W_CORE, fl);
    }
  }
  U.beam.end();
  U.haze.end();
  U.eyeFx.clear();
  for (const E of U.eyes) {
    const p = U.v.copy(E.o);
    U.frame.toWorld(p, p);
    const k = 0.18 + 0.12 * pulse + on * 0.9 + U.flash * 0.6;
    U.eyeFx.spawn((__s0["x"] = p.x, __s0["y"] = p.y, __s0["z"] = p.z, __s0["life"] = 1, __s0["size"] = 3.2 + k * 4.5, __s0["r"] = 1, __s0["g"] = 0.12, __s0["b"] = 0.08, __s0["a"] = Math.min(1, 0.35 + k * 0.6), __s0["cell"] = U.atlas.cell.glow, __s0["fadeIn"] = 0, __s0["fadeOut"] = 0, __s0));
    U.eyeFx.spawn((__s1["x"] = p.x, __s1["y"] = p.y, __s1["z"] = p.z, __s1["life"] = 1, __s1["size"] = 0.9 + k * 1.6, __s1["r"] = 1, __s1["g"] = 0.85, __s1["b"] = 0.8, __s1["a"] = Math.min(1, 0.25 + k), __s1["cell"] = U.atlas.cell.core, __s1["fadeIn"] = 0, __s1["fadeOut"] = 0, __s1));
    if (on > 0.05) U.eyeFx.spawn((__s2["x"] = p.x, __s2["y"] = p.y, __s2["z"] = p.z, __s2["life"] = 1, __s2["size"] = 9 + 9 * on + U.flash * 10, __s2["aspect"] = 0.07, __s2["rot"] = U.frame.attached ? 0 : 0, __s2["r"] = 1, __s2["g"] = 0.3, __s2["b"] = 0.25, __s2["a"] = 0.75 * on, __s2["cell"] = U.atlas.cell.glow, __s2["fadeIn"] = 0, __s2["fadeOut"] = 0, __s2));
  }
  U.eyeFx.write();
  if (on > 0.3) {
    U.acc += dt * 70 * on;
    while (U.acc >= 1) {
      U.acc -= 1;
      const E = U.eyes[r() < 0.5 ? 0 : 1], s = Math.pow(r(), 1.6) * 0.5;
      const p = U.v.copy(E.o).addScaledVector(E.d, 80 * s);
      U.frame.toWorld(p, p);
      const d = U.w.copy(E.d);
      U.frame.dirToWorld(d, d);
      const a = r() * 6.28, sp = 20 + r() * 40;
      U.spr.spawn((__s3["x"] = p.x, __s3["y"] = p.y, __s3["z"] = p.z, __s3["vx"] = d.x * 30 + Math.cos(a) * sp, __s3["vy"] = d.y * 30 + Math.sin(a) * sp, __s3["vz"] = d.z * 30, __s3["life"] = 0.25 + r() * 0.35, __s3["size"] = 0.6 + r() * 0.7, __s3["size1"] = 0.1, __s3["aspect"] = 3, __s3["r"] = 1, __s3["g"] = 0.55 + r() * 0.35, __s3["b"] = 0.3, __s3["a"] = 1, __s3["cell"] = U.atlas.cell.core, __s3["drag"] = 2, __s3["grav"] = 60, __s3["fadeIn"] = 0.02, __s3["fadeOut"] = 0.5, __s3));
    }
  } else U.acc = 0;
  if (was > 0.5 && on <= 0.5) for (const E of U.eyes) for (let k = 0; k < 3; k++) {
    const p = U.v.copy(E.o);
    p.y += 0.6;
    U.frame.toWorld(p, p);
    U.smoke.spawn((__s4["x"] = p.x + (r() - 0.5), __s4["y"] = p.y, __s4["z"] = p.z + 0.5, __s4["vx"] = (r() - 0.5) * 3, __s4["vy"] = 6 + r() * 4, __s4["life"] = 1.1, __s4["size"] = 1.2, __s4["size1"] = 4, __s4["r"] = 0.55, __s4["g"] = 0.52, __s4["b"] = 0.52, __s4["a"] = 0.35, __s4["cell"] = U.atlas.cell.smoke, __s4["rot"] = r() * 6, __s4["spin"] = 1, __s4["fadeIn"] = 0.1, __s4["fadeOut"] = 0.7, __s4));
  }
  U.ember -= dt;
  if (U.ember <= 0 && on < 0.1) {
    U.ember = 0.5 + r() * 0.7;
    const E = U.eyes[r() < 0.5 ? 0 : 1], p = U.v.copy(E.o);
    U.frame.toWorld(p, p);
    U.spr.spawn((__s5["x"] = p.x + (r() - 0.5) * 1.2, __s5["y"] = p.y + 0.3, __s5["z"] = p.z, __s5["vy"] = 4 + r() * 3, __s5["vx"] = (r() - 0.5) * 2, __s5["life"] = 0.9, __s5["size"] = 0.45 + r() * 0.3, __s5["size1"] = 0.1, __s5["r"] = 1, __s5["g"] = 0.3, __s5["b"] = 0.15, __s5["a"] = 0.9, __s5["cell"] = U.atlas.cell.core, __s5["wob"] = 1.5, __s5["fadeIn"] = 0.2, __s5["fadeOut"] = 0.6, __s5));
  }
  U.spr.update(dt, U.down);
  U.smoke.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
