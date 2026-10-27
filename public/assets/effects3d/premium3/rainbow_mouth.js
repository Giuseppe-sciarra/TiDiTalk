// Tiditalk — effetto viso 3D "rainbow_mouth" (premium3). Codice originale, AGPL-3.0. GENERATO da _src/fx/rainbow_mouth.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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

// fx/rainbow_mouth.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "spin": void 0, "drag": void 0, "grav": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s1 = { "x": void 0, "y": void 0, "z": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s2 = { "x": void 0, "y": void 0, "z": void 0, "vy": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "spin": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var meta = { label: "Arcobaleno dalla bocca", labelEn: "Rainbow mouth", labelFr: "Arc-en-ciel buccal", labelDe: "Regenbogenmund", category: "divertenti", icon: "\u{1F308}" };
var N = 120;
var LIFE = 1.55;
var RIB_VS = (
  /* glsl */
  `
attribute vec3 aTan; attribute float aSide; attribute float aW; attribute float aA; attribute float aU;
varying float vV; varying float vA; varying float vU;
void main() {
  vec4 wc = modelMatrix * vec4(position, 1.0);
  vec3 viewDir = normalize(cameraPosition - wc.xyz);
  vec3 t = normalize(mat3(modelMatrix) * aTan);
  vec3 sd = cross(t, viewDir); float L = length(sd); sd = L > 1e-4 ? sd / L : vec3(1.0, 0.0, 0.0);
  wc.xyz += sd * aSide * aW * 0.5;
  vV = aSide; vA = aA; vU = aU;
  gl_Position = projectionMatrix * viewMatrix * wc;
}`
);
var RIB_FS = (
  /* glsl */
  `
uniform vec3 uCols[6]; uniform float uTime;
varying float vV; varying float vA; varying float vU;
vec3 col(float i) { return i < 0.5 ? uCols[0] : i < 1.5 ? uCols[1] : i < 2.5 ? uCols[2] : i < 3.5 ? uCols[3] : i < 4.5 ? uCols[4] : uCols[5]; }
void main() {
  float x = clamp(vV * 0.5 + 0.5, 0.0, 0.9999);
  float f = x * 6.0, i = floor(f), fr = fract(f);
  vec3 c = mix(col(i), col(min(i + 1.0, 5.0)), smoothstep(0.82, 1.0, fr) * step(i, 4.5));
  float nz = sqrt(max(0.0, 1.0 - vV * vV));
  vec3 o = c * (0.5 + 0.55 * nz);
  float sp = pow(max(0.0, 1.0 - abs(vV + 0.42) * 3.2), 3.0);
  float glint = 0.5 + 0.5 * sin(vU * 40.0 - uTime * 9.0);
  o += vec3(1.0) * sp * (0.35 + 0.25 * glint);
  o += c * 0.25 * (1.0 - smoothstep(0.0, 0.08, vU));            // pi\xF9 luminoso all'uscita
  float a = vA * (1.0 - smoothstep(0.86, 1.0, abs(vV)));
  if (a < 0.01) discard;
  gl_FragColor = vec4(o, a);
  #include <colorspace_fragment>
}`
);
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.expr = new Expr(["jaw"]);
  U.trig = new Trigger({ on: 0.55, off: 0.3, hold: 0.12, cooldown: 0.2 });
  U.rnd = rng(5);
  const world = worldRoot(THREE, g2, U.frame);
  U.world = world;
  U.P = new Float32Array(N * 3);
  U.V = new Float32Array(N * 3);
  U.age = new Float32Array(N);
  U.W = new Float32Array(N);
  U.n = 0;
  const geo = new THREE.BufferGeometry();
  const D = THREE.DynamicDrawUsage;
  U.aPos = new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3).setUsage(D);
  U.aTan = new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3).setUsage(D);
  U.aW = new THREE.BufferAttribute(new Float32Array(N * 2), 1).setUsage(D);
  U.aA = new THREE.BufferAttribute(new Float32Array(N * 2), 1).setUsage(D);
  U.aU = new THREE.BufferAttribute(new Float32Array(N * 2), 1).setUsage(D);
  const side = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    side[i * 2] = -1;
    side[i * 2 + 1] = 1;
  }
  geo.setAttribute("position", U.aPos);
  geo.setAttribute("aTan", U.aTan);
  geo.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  geo.setAttribute("aW", U.aW);
  geo.setAttribute("aA", U.aA);
  geo.setAttribute("aU", U.aU);
  const idx = [];
  for (let i = 0; i < N - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const cols = ["#ff3048", "#ff9a1f", "#ffe14a", "#3fd36b", "#2f9bff", "#9a5cff"].map((c) => new THREE.Color(c));
  U.mat = new THREE.ShaderMaterial({ uniforms: { uCols: { value: cols }, uTime: { value: 0 } }, vertexShader: RIB_VS, fragmentShader: RIB_FS, transparent: true, side: THREE.DoubleSide, depthWrite: true });
  U.rib = new THREE.Mesh(geo, U.mat);
  U.rib.frustumCulled = false;
  U.rib.renderOrder = 2;
  world.add(U.rib);
  U.geo = geo;
  const atlas = makeAtlas(THREE, ["spark", "star", "glow", "dot"]);
  U.atlas = atlas;
  U.spr = new Sprites(THREE, { max: 140, atlas, blend: "add" });
  world.add(U.spr.mesh);
  U.cols = cols;
  U.tmp = { m: new THREE.Vector3(), d: new THREE.Vector3(), a: new THREE.Vector3() };
  U.acc = 0;
  U.open = 0;
  U.down = new THREE.Vector3(0, -1, 0);
  U.showcase = false;
  U.idle = 0;
  return g2;
}
function emit(U, t, jaw) {
  const { m, d } = U.tmp, r = U.rnd;
  m.set(0, -4.4 - jaw * 1.9, 6.9);
  U.frame.toWorld(m, m);
  const wig = Math.sin(t * 3.1) * 0.22 + Math.sin(t * 7.3) * 0.06;
  d.set(wig, -0.42, 1).normalize();
  U.frame.dirToWorld(d, d);
  const n = Math.min(U.n + 1, N);
  for (let i = n - 1; i > 0; i--) {
    for (let k = 0; k < 3; k++) {
      U.P[i * 3 + k] = U.P[(i - 1) * 3 + k];
      U.V[i * 3 + k] = U.V[(i - 1) * 3 + k];
    }
    U.age[i] = U.age[i - 1];
    U.W[i] = U.W[i - 1];
  }
  U.n = n;
  const sp = 44 + jaw * 30;
  U.P[0] = m.x;
  U.P[1] = m.y;
  U.P[2] = m.z;
  U.V[0] = d.x * sp;
  U.V[1] = d.y * sp;
  U.V[2] = d.z * sp;
  U.age[0] = 0;
  U.W[0] = 2.2 + jaw * 4.2;
  if (r() < 0.45) U.spr.spawn((__s0["x"] = m.x + (r() - 0.5) * 3, __s0["y"] = m.y + (r() - 0.5) * 2, __s0["z"] = m.z + 0.5, __s0["vx"] = d.x * sp * 0.8 + (r() - 0.5) * 30, __s0["vy"] = d.y * sp * 0.8 + (r() - 0.5) * 30, __s0["vz"] = d.z * sp * 0.8, __s0["life"] = 0.6 + r() * 0.6, __s0["size"] = 1.2 + r() * 1.6, __s0["size1"] = 0.2, __s0["r"] = 1, __s0["g"] = 0.95, __s0["b"] = 0.7, __s0["a"] = 1, __s0["cell"] = r() < 0.7 ? U.atlas.cell.spark : U.atlas.cell.star, __s0["spin"] = (r() - 0.5) * 6, __s0["drag"] = 1.2, __s0["grav"] = 90, __s0["fadeIn"] = 0.05, __s0["fadeOut"] = 0.5, __s0));
}
function simulate(U, dt) {
  const G = 230;
  for (let i = 0; i < U.n; i++) {
    U.age[i] += dt;
    if (U.age[i] > LIFE) {
      U.n = i;
      break;
    }
    const k = i * 3, dk = Math.exp(-0.5 * dt);
    U.V[k + 1] -= G * dt;
    U.V[k] *= dk;
    U.V[k + 1] *= dk;
    U.V[k + 2] *= dk;
    U.P[k] += U.V[k] * dt;
    U.P[k + 1] += U.V[k + 1] * dt;
    U.P[k + 2] += U.V[k + 2] * dt;
  }
}
function writeRibbon(U, attached, mouthW) {
  const n = U.n, P = U.aPos.array, T = U.aTan.array, W = U.aW.array, A = U.aA.array, UU = U.aU.array;
  for (let i = 0; i < n; i++) {
    const k = i * 3;
    let x = U.P[k], y = U.P[k + 1], z = U.P[k + 2];
    if (i === 0 && mouthW) {
      x = mouthW.x;
      y = mouthW.y;
      z = mouthW.z;
    }
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let tx = U.P[b * 3] - U.P[a * 3], ty = U.P[b * 3 + 1] - U.P[a * 3 + 1], tz = U.P[b * 3 + 2] - U.P[a * 3 + 2];
    const L = Math.hypot(tx, ty, tz) || 1;
    tx /= L;
    ty /= L;
    tz /= L;
    const age = U.age[i] / LIFE, tail = i / Math.max(1, n - 1);
    const w = U.W[i] * (1 + age * 0.35) * (i === 0 ? 0.92 : 1);
    const al = (1 - Math.pow(age, 3)) * Math.min(1, (1 - tail) * 6);
    for (let s = 0; s < 2; s++) {
      const v = (i * 2 + s) * 3;
      P[v] = x;
      P[v + 1] = y;
      P[v + 2] = z;
      T[v] = tx;
      T[v + 1] = ty;
      T[v + 2] = tz;
      W[i * 2 + s] = w;
      A[i * 2 + s] = al;
      UU[i * 2 + s] = i / N;
    }
  }
  U.geo.setDrawRange(0, Math.max(0, n - 1) * 6);
  U.aPos.needsUpdate = U.aTan.needsUpdate = U.aW.needsUpdate = U.aA.needsUpdate = U.aU.needsUpdate = true;
}
function update(g2, bs, t, h) {
  const U = g2.userData;
  if (!U.frame) return;
  let dt = U.tick.tick(t);
  U.frame.update(dt);
  U.world.userData.sync();
  const e = U.expr.update(bs, dt, h);
  let jaw = e.jaw;
  if (!U.frame.attached && !U.showcase) {
    U.showcase = true;
    for (let k = 0; k < 36; k++) {
      const tt = k / 30;
      simulate(U, 1 / 30);
      U.acc += 1 / 30 * 64;
      while (U.acc >= 1) {
        emit(U, tt, 0.9);
        U.acc -= 1;
      }
      U.spr.update(1 / 30, U.down);
    }
    U.open = 1;
    jaw = 0.9;
  }
  U.trig.update(jaw, dt);
  if (U.showcase === true && !U.frame.attached) U.open = 1;
  else U.open = U.trig.active ? 1 : 0;
  U.mat.uniforms.uTime.value = t;
  let mouthW = null;
  simulate(U, dt);
  if (U.open) {
    U.acc += dt * 64;
    const m = Math.floor(U.acc);
    for (let j = 0; j < m; j++) {
      emit(U, t - dt * (m - 1 - j) / m, Math.max(jaw, 0.3));
      const lag = dt * (m - 1 - j) / m;
      U.P[0] += U.V[0] * lag;
      U.P[1] += U.V[1] * lag;
      U.P[2] += U.V[2] * lag;
      U.age[0] = lag;
    }
    U.acc -= m;
    mouthW = U.tmp.a.set(0, -4.4 - jaw * 1.9, 6.9);
    U.frame.toWorld(mouthW, mouthW);
    U.glowT = (U.glowT || 0) + dt;
    if (U.glowT > 0.12) {
      U.glowT = 0;
      U.spr.spawn((__s1["x"] = mouthW.x, __s1["y"] = mouthW.y, __s1["z"] = mouthW.z + 0.8, __s1["life"] = 0.3, __s1["size"] = 5 + jaw * 4, __s1["size1"] = 7 + jaw * 4, __s1["r"] = 1, __s1["g"] = 0.85, __s1["b"] = 0.95, __s1["a"] = 0.35, __s1["cell"] = U.atlas.cell.glow, __s1["fadeIn"] = 0.3, __s1["fadeOut"] = 0.6, __s1));
    }
  } else U.acc = 0;
  writeRibbon(U, U.frame.attached, mouthW);
  U.idle += dt;
  if (!U.open && U.idle > 0.55) {
    U.idle = 0;
    const r = U.rnd, p = U.tmp.m.set((r() < 0.5 ? -1 : 1) * (2.6 + r()), -4.3 + (r() - 0.5), 5);
    U.frame.toWorld(p, p);
    U.spr.spawn((__s2["x"] = p.x, __s2["y"] = p.y, __s2["z"] = p.z, __s2["vy"] = 4, __s2["life"] = 0.8, __s2["size"] = 0.9 + r() * 0.6, __s2["size1"] = 0.1, __s2["r"] = 1, __s2["g"] = 0.85 + r() * 0.15, __s2["b"] = 0.6, __s2["a"] = 0.9, __s2["cell"] = U.atlas.cell.spark, __s2["spin"] = 2, __s2["fadeIn"] = 0.3, __s2["fadeOut"] = 0.5, __s2));
  }
  U.spr.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
