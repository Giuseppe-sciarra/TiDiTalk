// Tiditalk — effetto viso 3D "venice_mask" (premium3). Codice originale, AGPL-3.0. GENERATO da _src/fx/venice_mask.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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
  }
  // pivot e restDir in spazio mondo; restituisce la direzione (mondo, normalizzata)
  step(dt, pivot, restDir, down) {
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
    const P = this.aPos.array, C = this.aCol.array, S2 = this.aSR.array, V = this.aVel.array;
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
      S2[i4] = this.s0[i] + (this.s1[i] - this.s0[i]) * e;
      S2[i4 + 1] = this.rot[i];
      S2[i4 + 2] = this.cell[i];
      S2[i4 + 3] = this.asp[i];
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
function taperTube(THREE, curve, { segs = 48, radial = 12, r = () => 1, sx = 1, sy = 1, capStart = true, capEnd = true, twist = 0 } = {}) {
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
      const a = j / radial * Math.PI * 2 + twist * t, c = Math.cos(a), s = Math.sin(a);
      n.set(0, 0, 0).addScaledVector(N, c * sx).addScaledVector(B, s * sy);
      pos.push(P.x + n.x * rr, P.y + n.y * rr, P.z + n.z * rr);
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

// fx/venice_mask.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "vy": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "spin": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var meta = { label: "Maschera con piume", labelEn: "Feathered carnival mask", labelFr: "Masque \xE0 plumes", labelDe: "Federmaske", category: "costumi", icon: "\u{1F3AD}" };
var EYE_A = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
var EYE_B = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
var S = 1024;
function maskTextures(THREE, fm, rnd) {
  const uv = (i) => [fm.uv[i * 2] * S, (1 - fm.uv[i * 2 + 1]) * S];
  const eye = (ids) => {
    let x2 = 0, y2 = 0;
    for (const i of ids) {
      const p = uv(i);
      x2 += p[0];
      y2 += p[1];
    }
    return [x2 / ids.length, y2 / ids.length];
  };
  const cA = eye(EYE_A), cB = eye(EYE_B);
  const w = Math.hypot(uv(33)[0] - uv(133)[0], uv(33)[1] - uv(133)[1]);
  const mx = (cA[0] + cB[0]) / 2, my = (cA[1] + cB[1]) / 2;
  const sgnA = Math.sign(cA[0] - mx);
  const outline = (x2) => {
    const side = (c, s) => ({
      flare: [c[0] + s * 1.32 * w, c[1] - 0.95 * w],
      top: [c[0] + s * 0.25 * w, c[1] - 0.82 * w],
      outer: [c[0] + s * 1.08 * w, c[1] + 0.2 * w],
      under: [c[0] + s * 0.1 * w, c[1] + 0.62 * w],
      inner: [c[0] - s * 0.62 * w, c[1] + 0.42 * w]
    });
    const A = side(cA, sgnA), B = side(cB, -sgnA);
    x2.beginPath();
    x2.moveTo(mx, my - 0.5 * w);
    x2.quadraticCurveTo(A.top[0] - sgnA * 0.5 * w, A.top[1] - 0.05 * w, A.top[0], A.top[1]);
    x2.quadraticCurveTo(A.flare[0] - sgnA * 0.45 * w, A.top[1] - 0.05 * w, A.flare[0], A.flare[1]);
    x2.quadraticCurveTo(A.outer[0] + sgnA * 0.25 * w, A.outer[1] - 0.45 * w, A.outer[0], A.outer[1]);
    x2.quadraticCurveTo(A.under[0] + sgnA * 0.6 * w, A.under[1] + 0.05 * w, A.under[0], A.under[1]);
    x2.quadraticCurveTo(A.inner[0] + sgnA * 0.2 * w, A.inner[1] + 0.12 * w, mx, my + 0.3 * w);
    x2.quadraticCurveTo(B.inner[0] - sgnA * 0.2 * w, B.inner[1] + 0.12 * w, B.under[0], B.under[1]);
    x2.quadraticCurveTo(B.under[0] - sgnA * 0.6 * w, B.under[1] + 0.05 * w, B.outer[0], B.outer[1]);
    x2.quadraticCurveTo(B.outer[0] - sgnA * 0.25 * w, B.outer[1] - 0.45 * w, B.flare[0], B.flare[1]);
    x2.quadraticCurveTo(B.flare[0] + sgnA * 0.45 * w, B.top[1] - 0.05 * w, B.top[0], B.top[1]);
    x2.quadraticCurveTo(B.top[0] + sgnA * 0.5 * w, B.top[1] - 0.05 * w, mx, my - 0.5 * w);
    x2.closePath();
  };
  const eyePath = (x2, ids, c, k) => {
    x2.beginPath();
    ids.forEach((i, n) => {
      const p = uv(i);
      const X = c[0] + (p[0] - c[0]) * k * 1.12, Y = c[1] + (p[1] - c[1]) * k * 1 - 0.04 * w;
      n ? x2.lineTo(X, Y) : x2.moveTo(X, Y);
    });
    x2.closePath();
  };
  const col = canvas(S), x = col.getContext("2d");
  const gr = x.createLinearGradient(0, my - w, 0, my + w);
  gr.addColorStop(0, "#7a0a24");
  gr.addColorStop(0.5, "#5a0619");
  gr.addColorStop(1, "#3a0410");
  outline(x);
  x.fillStyle = gr;
  x.fill();
  const goldWork = (x2, style, clip) => {
    x2.save();
    x2.strokeStyle = style;
    x2.lineCap = "round";
    x2.lineJoin = "round";
    if (clip) {
      outline(x2);
      x2.clip();
    }
    for (const [c, s] of [[cA, sgnA], [cB, -sgnA]]) {
      for (let k = 0; k < 7; k++) {
        const a0 = -1.9 + k * 0.42, R = w * (0.75 + k % 2 * 0.12);
        const sx = c[0] + s * Math.cos(a0) * R * 1.15, sy = c[1] + Math.sin(a0) * R * 0.9;
        x2.lineWidth = 3.2;
        x2.beginPath();
        for (let j = 0; j <= 24; j++) {
          const t = j / 24, r = w * 0.2 * (1 - t * 0.85), an = a0 * 2 + t * 5.5;
          const X = sx + s * Math.cos(an) * r, Y = sy + Math.sin(an) * r;
          j ? x2.lineTo(X, Y) : x2.moveTo(X, Y);
        }
        x2.stroke();
      }
    }
    x2.restore();
    x2.save();
    x2.strokeStyle = style;
    x2.lineJoin = "round";
    outline(x2);
    x2.lineWidth = 9;
    x2.stroke();
    for (const [ids, c] of [[EYE_A, cA], [EYE_B, cB]]) {
      eyePath(x2, ids, c, 1.42);
      x2.lineWidth = 8;
      x2.stroke();
    }
    x2.restore();
  };
  goldWork(x, "rgb(236,196,96)", true);
  x.save();
  outline(x);
  x.clip();
  for (let i = 0; i < 260; i++) {
    const X = mx + (rnd() - 0.5) * w * 5.4, Y = my + (rnd() - 0.6) * w * 2.2;
    x.fillStyle = `rgba(255,230,170,${0.25 + rnd() * 0.6})`;
    x.fillRect(X, Y, 2, 2);
  }
  x.restore();
  const gems = [];
  for (const [c, s] of [[cA, sgnA], [cB, -sgnA]]) for (const k of [0.25, 0.65, 1]) gems.push([c[0] + s * k * w, c[1] - (0.78 + k * 0.12) * w]);
  for (const [X, Y] of gems) {
    const g2 = x.createRadialGradient(X - 3, Y - 3, 1, X, Y, 9);
    g2.addColorStop(0, "#fff");
    g2.addColorStop(0.35, "#ff9ad0");
    g2.addColorStop(1, "#8a1050");
    x.fillStyle = g2;
    x.beginPath();
    x.arc(X, Y, 9, 0, 6.3);
    x.fill();
  }
  x.globalCompositeOperation = "destination-out";
  for (const [ids, c] of [[EYE_A, cA], [EYE_B, cB]]) {
    eyePath(x, ids, c, 1.33);
    x.fill();
  }
  x.globalCompositeOperation = "source-over";
  const mr = canvas(S), y = mr.getContext("2d");
  y.fillStyle = "rgb(0,40,0)";
  y.fillRect(0, 0, S, S);
  goldWork(y, "rgb(0,72,255)", true);
  const bump = canvas(S), z = bump.getContext("2d");
  z.fillStyle = "#000";
  z.fillRect(0, 0, S, S);
  z.filter = "blur(1.5px)";
  goldWork(z, "#fff", true);
  z.filter = "none";
  const T = (c, srgb) => {
    const t = texFrom(THREE, c, { wrap: false, srgb });
    return t;
  };
  return { map: T(col, true), mr: T(mr, false), bump: T(bump, false), center: [mx / S, 1 - my / S], w: w / S, cA, cB };
}
function maskGeo(THREE, fm, offset = 0.42) {
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute("position", new THREE.Float32BufferAttribute(fm.pos, 3));
  g2.setAttribute("uv", new THREE.Float32BufferAttribute(fm.uv, 2));
  g2.setIndex(fm.idx);
  g2.computeVertexNormals();
  const p = g2.attributes.position, n = g2.attributes.normal, uvA = g2.attributes.uv;
  const keep = [];
  const idx = fm.idx;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    const vs = [a, b, c].map((k) => 1 - uvA.getY(k));
    if (vs.every((v) => v > 0.17 && v < 0.62)) keep.push(a, b, c);
  }
  const pos = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = offset + clamp((y - 1) / 6) * 0.15;
    pos[i * 3] = p.getX(i) + n.getX(i) * k;
    pos[i * 3 + 1] = y + n.getY(i) * k;
    pos[i * 3 + 2] = p.getZ(i) + n.getZ(i) * k;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  m.setAttribute("uv", uvA.clone());
  m.setIndex(keep);
  m.computeVertexNormals();
  return m;
}
function featherTex(THREE, base, tip, eye) {
  const c = canvas(128, 512), x = c.getContext("2d");
  const gr = x.createLinearGradient(0, 512, 0, 0);
  gr.addColorStop(0, base);
  gr.addColorStop(1, tip);
  for (let i = 0; i < 260; i++) {
    const t = i / 260, y = 500 - t * 490, half = Math.sin(Math.min(1, t * 1.25) * Math.PI) * 58 * (0.6 + 0.4 * t) + 4;
    x.strokeStyle = gr;
    x.globalAlpha = 0.55 + 0.45 * Math.random();
    x.lineWidth = 1.6;
    x.beginPath();
    x.moveTo(64, y);
    x.quadraticCurveTo(64 - half * 0.6, y - 10, 64 - half, y - 26 - Math.random() * 10);
    x.moveTo(64, y);
    x.quadraticCurveTo(64 + half * 0.6, y - 10, 64 + half, y - 26 - Math.random() * 10);
    x.stroke();
  }
  x.globalAlpha = 1;
  if (eye) {
    const ex = 64, ey = 90;
    for (const [r, c2] of [[30, "#1b5e3a"], [24, "#d4a53a"], [18, "#0f7a8a"], [11, "#1a2a8a"], [6, "#05051a"]]) {
      x.fillStyle = c2;
      x.beginPath();
      x.ellipse(ex, ey, r * 0.8, r, 0, 0, 6.3);
      x.fill();
    }
  }
  x.strokeStyle = "rgba(255,240,200,0.9)";
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(64, 512);
  x.lineTo(64, 14);
  x.stroke();
  return texFrom(THREE, c, { wrap: false });
}
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.expr = new Expr(["smile"]);
  U.rnd = rng(101);
  const fm = h.face;
  const T = maskTextures(THREE, fm, U.rnd);
  const mat = new THREE.MeshPhysicalMaterial({ map: T.map, metalnessMap: T.mr, roughnessMap: T.mr, metalness: 1, roughness: 1, bumpMap: T.bump, bumpScale: 1.2, clearcoat: 0.8, clearcoatRoughness: 0.1, alphaTest: 0.5, side: THREE.DoubleSide, envMapIntensity: 1.4 });
  const mask = new THREE.Mesh(maskGeo(THREE, fm), mat);
  g2.add(mask);
  const plume = new THREE.Group();
  plume.position.set(6.9, 5.2, 2);
  g2.add(plume);
  U.plume = plume;
  const setting = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.28, 10, 24), new THREE.MeshStandardMaterial({ color: 15253600, metalness: 1, roughness: 0.25 }));
  setting.position.set(0, 0, 0.6);
  setting.rotation.y = 0.6;
  plume.add(setting);
  const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), new THREE.MeshPhysicalMaterial({ color: 9055202, metalness: 0.2, roughness: 0.05, clearcoat: 1, envMapIntensity: 3, flatShading: true }));
  gem.position.set(0, 0, 0.75);
  gem.scale.set(1, 1, 0.6);
  gem.rotation.y = 0.6;
  plume.add(gem);
  const defs = [["#3a0a5a", "#c070ff", false, 17, -0.15, 0.05], ["#0a3a3a", "#38d0c8", true, 20, 0.12, -0.1], ["#5a3a08", "#ffd060", false, 15, 0.38, 0.12], ["#5a0838", "#ff5ab8", false, 16, -0.42, 0.2], ["#14143a", "#7aa0ff", true, 18.5, 0.6, -0.05]];
  U.feathers = [];
  defs.forEach(([b, tp, eye, L, ang, tw], i) => {
    const piv = new THREE.Group();
    piv.rotation.set(-0.15 + tw, 0.5, -0.35 + ang);
    plume.add(piv);
    const shaft = taperTube(THREE, new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, L * 0.5, 0.2), new THREE.Vector3(1.2, L, 0.8)]), { segs: 20, radial: 5, r: (t) => 0.13 - t * 0.09 });
    piv.add(new THREE.Mesh(shaft, new THREE.MeshStandardMaterial({ color: 15918792, roughness: 0.5 })));
    const vane = new THREE.PlaneGeometry(4.6, L * 0.92, 2, 12);
    vane.translate(0, L * 0.46 + L * 0.06, 0);
    const vp = vane.attributes.position;
    for (let k = 0; k < vp.count; k++) {
      const y = vp.getY(k) / L, xx = vp.getX(k);
      vp.setX(k, xx + y * y * 1.4);
      vp.setZ(k, y * y * 0.9 - Math.abs(xx) * 0.18);
    }
    vane.computeVertexNormals();
    const vm = new THREE.MeshStandardMaterial({ map: featherTex(THREE, b, tp, eye), roughness: 0.75, side: THREE.DoubleSide, transparent: true, depthWrite: false, alphaTest: 0.08 });
    const v = new THREE.Mesh(vane, vm);
    v.renderOrder = 3 + i;
    piv.add(v);
    U.feathers.push({ piv, rx: piv.rotation.x, rz: piv.rotation.z, ph: i * 1.7 });
  });
  U.dangle = new Dangle(THREE, 10, { damping: 0.9, stiff: 120, grav: 200 });
  const world = worldRoot(THREE, g2, U.frame);
  U.world = world;
  const atlas = makeAtlas(THREE, ["spark", "glow", "dot", "star"]);
  U.atlas = atlas;
  U.spr = new Sprites(THREE, { max: 60, atlas, blend: "add", renderOrder: 9 });
  world.add(U.spr.mesh);
  U.acc = 0;
  U.v = new THREE.Vector3();
  U.w = new THREE.Vector3();
  U.up = new THREE.Vector3(0, 1, 0);
  U.down = new THREE.Vector3(0, -1, 0);
  return g2;
}
function update(g2, bs, t, h) {
  const U = g2.userData;
  if (!U.frame) return;
  const dt = U.tick.tick(t);
  U.frame.update(dt);
  U.world.userData.sync();
  const e = U.expr.update(bs, dt, h), s = e.smile;
  const pw = U.frame.toWorld(U.plume.position, U.w);
  const rest = U.frame.dirToWorld(U.up, U.v);
  const dir = U.dangle.step(dt, pw, rest, U.down);
  const dl = U.frame.dirToLocal(dir, U.v);
  for (const F of U.feathers) {
    const q = Math.sin(t * (1.6 + s * 6) + F.ph) * (0.04 + s * 0.05);
    F.piv.rotation.x = F.rx + dl.z * 0.6 + q * 0.5;
    F.piv.rotation.z = F.rz - dl.x * 0.6 + q;
  }
  U.acc += dt * (1.5 + s * 14);
  while (U.acc >= 1) {
    U.acc -= 1;
    const r = U.rnd;
    const p = U.v.set(7 + r() * 9, 8 + r() * 14, 2 + (r() - 0.5) * 4);
    U.frame.toWorld(p, p);
    U.spr.spawn((__s0["x"] = p.x, __s0["y"] = p.y, __s0["z"] = p.z, __s0["vy"] = 3, __s0["life"] = 0.7, __s0["size"] = 0.8 + r() * 1.2, __s0["size1"] = 0.1, __s0["r"] = 1, __s0["g"] = 0.85 + r() * 0.15, __s0["b"] = 0.6 + r() * 0.4, __s0["a"] = 1, __s0["cell"] = U.atlas.cell.spark, __s0["spin"] = 2, __s0["fadeIn"] = 0.3, __s0["fadeOut"] = 0.6, __s0));
  }
  U.spr.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
