// Tiditalk — effetto viso 3D "xmas_snow" (premium3). Codice originale, AGPL-3.0. GENERATO da _src/fx/xmas_snow.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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

// fx/xmas_snow.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "life": void 0, "size": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "rot": void 0, "spin": void 0, "wob": void 0, "wf": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var __s1 = { "x": void 0, "y": void 0, "z": void 0, "vy": void 0, "life": void 0, "size": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "cell": void 0, "wob": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var meta = { label: "Natale sotto la neve", labelEn: "Snowy Christmas", labelFr: "No\xEBl sous la neige", labelDe: "Weihnachten im Schnee", category: "costumi", icon: "\u{1F384}" };
var NS = 40;
function knitTex(THREE) {
  const W = 256, H = 512, c = canvas(W, H), x = c.getContext("2d");
  x.fillStyle = "#b5121f";
  x.fillRect(0, 0, W, H);
  const band = (y0, h, col) => {
    x.fillStyle = col;
    x.fillRect(0, H - y0 - h, W, h);
  };
  band(18, 70, "#f4efe4");
  band(24, 6, "#1d6b3a");
  band(76, 6, "#1d6b3a");
  x.fillStyle = "#1d6b3a";
  for (let i = 0; i < 8; i++) {
    const cx = i * 32 + 16, by = H - 34;
    x.beginPath();
    x.moveTo(cx, by - 34);
    x.lineTo(cx + 11, by - 14);
    x.lineTo(cx + 6, by - 14);
    x.lineTo(cx + 13, by);
    x.lineTo(cx - 13, by);
    x.lineTo(cx - 6, by - 14);
    x.lineTo(cx - 11, by - 14);
    x.closePath();
    x.fill();
  }
  x.fillStyle = "#b5121f";
  for (let i = 0; i < 16; i++) {
    const cx = i * 16 + 8, cy = H - 101;
    x.fillRect(cx - 3, cy - 3, 6, 6);
  }
  band(108, 5, "#f4efe4");
  x.fillStyle = "#f4efe4";
  for (let row = 0; row < 7; row++) for (let i = 0; i < 4; i++) {
    const cx = i * 64 + (row % 2 ? 32 : 0) + 16, cy = H - 150 - row * 48;
    for (const [dx, dy] of [[0, 0], [-6, 0], [6, 0], [0, -6], [0, 6]]) x.fillRect(cx + dx - 2, cy + dy - 2, 4, 4);
  }
  return texFrom(THREE, c, { repeat: [3, 1] });
}
function fluff(THREE, geo, amp, seed) {
  const n = valueNoise(seed, 16), p = geo.attributes.position, nn = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = (n(x * 1.3 + 3, y * 1.3 + z * 0.9) - 0.5) * 2 * amp + (n(x * 3.1, z * 3.1 + y) - 0.5) * amp * 0.6;
    p.setXYZ(i, x + nn.getX(i) * k, y + nn.getY(i) * k, z + nn.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  U.frame = new HeadFrame(THREE, g2);
  U.up3 = [0, 0, 1];
  U.tick = new Ticker();
  U.expr = new Expr(["smile"]);
  U.rnd = rng(71);
  U.B0 = new THREE.Vector3(0, 7.6, -3.4);
  U.d0 = new THREE.Vector3(0, 0.93, -0.36).normalize();
  U.n0 = new THREE.Vector3(0, 0.36, 0.93).normalize();
  U.tube = new DynTube(THREE, NS, 28, { r: (s) => 8.75 * Math.pow(1 - s, 1.18) + 0.45, uRepeat: 1 });
  const wool = new THREE.MeshStandardMaterial({ map: knitTex(THREE), normalMap: knitNormal(THREE, [30, 26], 3.5), normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.92, side: THREE.DoubleSide, transparent: true });
  const hat = new THREE.Mesh(U.tube.geo, wool);
  hat.frustumCulled = false;
  g2.add(hat);
  const furN = furNormal(THREE, 5, [10, 2], 4);
  const furMat = new THREE.MeshStandardMaterial({ color: 15920612, roughness: 1, normalMap: furN, normalScale: new THREE.Vector2(1.2, 1.2), transparent: true });
  const brimGeo = fluff(THREE, new THREE.TorusGeometry(8.95, 1.55, 18, 72), 0.32, 3);
  const brim = new THREE.Mesh(brimGeo, furMat);
  brim.position.copy(U.B0);
  brim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), U.d0);
  g2.add(brim);
  U.pom = new THREE.Mesh(fluff(THREE, new THREE.IcosahedronGeometry(2.25, 4), 0.38, 9), furMat);
  g2.add(U.pom);
  U.dangle = new Dangle(THREE, 14, { damping: 0.86, stiff: 260, grav: 380 });
  U.pivotL = U.B0.clone().addScaledVector(U.d0, 10.5);
  U.restL = new THREE.Vector3(0.86, -0.22, -0.46).normalize();
  U.pts = new Float32Array(NS * 3);
  const world = worldRoot(THREE, g2, U.frame);
  U.world = world;
  const atlas = makeAtlas(THREE, ["flake", "dot", "glow", "spark"]);
  U.atlas = atlas;
  U.snow = new Sprites(THREE, { max: 220, atlas, blend: "normal", renderOrder: 4 });
  U.bokeh = new Sprites(THREE, { max: 30, atlas, blend: "add", renderOrder: 4 });
  world.add(U.snow.mesh, U.bokeh.mesh);
  U.acc = 0;
  U.accB = 0;
  U.tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), w: new THREE.Vector3(), dl: new THREE.Vector3() };
  U.down = new THREE.Vector3(0, -1, 0);
  U.showcase = false;
  shapeHat(U, U.restL);
  g2.add(hatOccluder(THREE));
  return g2;
}
function shapeHat(U, dirL) {
  const { a, b, c, d } = U.tmp, P = U.pts;
  const P0 = U.B0, P1 = a.copy(U.B0).addScaledVector(U.d0, 9.5);
  const tip = b.copy(U.pivotL).addScaledVector(dirL, 13.5);
  const P2 = c.copy(P1).addScaledVector(U.d0, 4.5).lerp(tip, 0.2);
  for (let i = 0; i < NS; i++) {
    const s = i / (NS - 1), u = 1 - s;
    const k0 = u * u * u, k1 = 3 * u * u * s, k2 = 3 * u * s * s, k3 = s * s * s;
    P[i * 3] = k0 * P0.x + k1 * P1.x + k2 * P2.x + k3 * tip.x;
    P[i * 3 + 1] = k0 * P0.y + k1 * P1.y + k2 * P2.y + k3 * tip.y;
    P[i * 3 + 2] = k0 * P0.z + k1 * P1.z + k2 * P2.z + k3 * tip.z;
  }
  const u3 = U.up3;
  u3[0] = U.n0.x;
  u3[1] = U.n0.y;
  u3[2] = U.n0.z;
  U.tube.update(P, u3);
  U.pom.position.copy(tip).addScaledVector(dirL, 1.2);
}
function flake(U, pre) {
  const r = U.rnd, p = U.tmp.w.set((r() - 0.5) * 60, pre ? -20 + r() * 50 : 30 + r() * 4, -10 + r() * 22);
  U.frame.toWorld(p, p);
  U.snow.spawn((__s0["x"] = p.x, __s0["y"] = p.y, __s0["z"] = p.z, __s0["vx"] = (r() - 0.5) * 4, __s0["vy"] = -14 - r() * 10, __s0["life"] = 3.6, __s0["size"] = 0.55 + r() * 0.9, __s0["r"] = 1, __s0["g"] = 1, __s0["b"] = 1, __s0["a"] = 0.92, __s0["cell"] = r() < 0.6 ? U.atlas.cell.flake : U.atlas.cell.dot, __s0["rot"] = r() * 6, __s0["spin"] = (r() - 0.5) * 2, __s0["wob"] = 5 + r() * 5, __s0["wf"] = 1.5 + r() * 2, __s0["fadeIn"] = 0.15, __s0["fadeOut"] = 0.2, __s0));
}
function update(g2, bs, t, h) {
  const U = g2.userData;
  if (!U.frame) return;
  const dt = U.tick.tick(t);
  U.frame.update(dt);
  U.world.userData.sync();
  const e = U.expr.update(bs, dt, h);
  if (!U.frame.attached && !U.showcase) {
    U.showcase = true;
    for (let k = 0; k < 70; k++) flake(U, true);
  }
  const { w, dl } = U.tmp;
  const pivotW = U.frame.toWorld(U.pivotL, w);
  const restW = U.frame.dirToWorld(U.restL, dl);
  const dirW = U.dangle.step(dt, pivotW, restW, U.down);
  const dirL = U.frame.dirToLocal(dirW, U.tmp.d).normalize();
  dirL.lerp(U.restL, 0.15).normalize();
  shapeHat(U, dirL);
  U.pom.rotation.y = t * 0.3;
  U.acc += dt * (24 + e.smile * 40);
  while (U.acc >= 1) {
    flake(U, false);
    U.acc -= 1;
  }
  U.accB += dt * 3;
  while (U.accB >= 1) {
    U.accB -= 1;
    const r = U.rnd, p = U.tmp.w.set((r() - 0.5) * 50, 26, 14 + r() * 10);
    U.frame.toWorld(p, p);
    U.bokeh.spawn((__s1["x"] = p.x, __s1["y"] = p.y, __s1["z"] = p.z, __s1["vy"] = -16, __s1["life"] = 3.2, __s1["size"] = 2.2 + r() * 2, __s1["r"] = 0.8, __s1["g"] = 0.88, __s1["b"] = 1, __s1["a"] = 0.28, __s1["cell"] = U.atlas.cell.dot, __s1["wob"] = 4, __s1["fadeIn"] = 0.3, __s1["fadeOut"] = 0.3, __s1));
  }
  U.snow.update(dt, U.down);
  U.bokeh.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
