// Tiditalk — effetto viso 3D "fascia_anni80" (premium6). Codice originale, AGPL-3.0. GENERATO da _src/fx/fascia_anni80.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

// lib/head.js
var HULL = { c: [0, 2.4, -4], r: [8.1, 11.6, 9.9] };
var clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
var smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
function hullAt(theta, phi, off, P, N) {
  const c = HULL.c, r = HULL.r;
  const sx = Math.sin(theta) * Math.sin(phi), sy = Math.cos(theta), sz = Math.sin(theta) * Math.cos(phi);
  N.set(sx / r[0], sy / r[1], sz / r[2]).normalize();
  P.set(c[0] + r[0] * sx, c[1] + r[1] * sy, c[2] + r[2] * sz);
  if (off) P.addScaledVector(N, off);
  return P;
}
function thetaAtY(y) {
  return Math.acos(clamp((y - HULL.c[1]) / HULL.r[1], -1, 1));
}
function bandRing(THREE, { yF = 8.6, yB = 4.4, gap = () => 0.6, lift = null, n = 96 } = {}) {
  const V = THREE.Vector3;
  const F = hullAt(thetaAtY(yF), 0, 0, new V(), new V());
  const B = hullAt(thetaAtY(yB), Math.PI, 0, new V(), new V());
  const d = new V().subVectors(B, F);
  const axis = new V(0, -d.z, d.y).normalize();
  if (axis.y < 0) axis.negate();
  const P = [], N = [], T = [], PH = [], G = [];
  const p = new V(), nn = new V();
  for (let i = 0; i <= n; i++) {
    const phi = i / n * Math.PI * 2;
    const off = lift ? lift(phi) : 0;
    let a = 0.02, b = Math.PI - 0.02;
    for (let k = 0; k < 40; k++) {
      const m = (a + b) / 2;
      hullAt(m, phi, 0, p, nn);
      const g2 = axis.dot(p.clone().sub(F)) - off;
      if (g2 > 0) a = m;
      else b = m;
    }
    const th = (a + b) / 2;
    hullAt(th, phi, 0, p, nn);
    const gp = gap(phi);
    P.push(p.clone().addScaledVector(nn, gp));
    N.push(nn.clone());
    T.push(th);
    PH.push(phi);
    G.push(gp);
  }
  const C = new V();
  for (let i = 0; i < n; i++) C.add(P[i]);
  C.divideScalar(n);
  const fwd = new V(0, 0, 1).projectOnPlane(axis).normalize();
  const side = new V().crossVectors(axis, fwd).normalize();
  return { n, P, N, T, G, phi: PH, axis, C, fwd, side, F, B };
}
function grid(THREE, nu, nv, fn, { uRep = 1, vRep = 1, colors = null, pole0 = false, pole1 = false, flip = false } = {}) {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3), uv = new Float32Array((nu + 1) * (nv + 1) * 2);
  const col = colors ? new Float32Array((nu + 1) * (nv + 1) * 3) : null;
  const P = new THREE.Vector3(), C = new THREE.Color();
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const k = j * (nu + 1) + i;
    fn(i % nu === 0 && i ? 0 : i, j, P);
    pos[k * 3] = P.x;
    pos[k * 3 + 1] = P.y;
    pos[k * 3 + 2] = P.z;
    uv[k * 2] = i / nu * uRep;
    uv[k * 2 + 1] = j / nv * vRep;
    if (col) {
      colors(i % nu, j, C);
      col[k * 3] = C.r;
      col[k * 3 + 1] = C.g;
      col[k * 3 + 2] = C.b;
    }
  }
  const idx = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    if (flip) idx.push(a, b, c, b, d, c);
    else idx.push(a, c, b, b, c, d);
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g2.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  if (col) g2.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g2.setIndex(idx);
  g2.computeVertexNormals();
  const n = g2.attributes.normal.array;
  for (let j = 0; j <= nv; j++) {
    const a = j * (nu + 1), b = a + nu;
    for (let c = 0; c < 3; c++) {
      const m = (n[a * 3 + c] + n[b * 3 + c]) / 2;
      n[a * 3 + c] = n[b * 3 + c] = m;
    }
    const L = Math.hypot(n[a * 3], n[a * 3 + 1], n[a * 3 + 2]) || 1;
    for (let c = 0; c < 3; c++) {
      n[a * 3 + c] /= L;
      n[b * 3 + c] /= L;
    }
  }
  for (const [on, j] of [[pole0, 0], [pole1, nv]]) {
    if (!on) continue;
    let x = 0, y = 0, z = 0;
    for (let i = 0; i <= nu; i++) {
      const k = (j * (nu + 1) + i) * 3;
      x += n[k];
      y += n[k + 1];
      z += n[k + 2];
    }
    const L = Math.hypot(x, y, z) || 1;
    for (let i = 0; i <= nu; i++) {
      const k = (j * (nu + 1) + i) * 3;
      n[k] = x / L;
      n[k + 1] = y / L;
      n[k + 2] = z / L;
    }
  }
  return g2;
}

// lib/core.js
var clamp2 = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
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
  frown: (b) => Math.max(avg(b, "browDownLeft", "browDownRight"), avg(b, "mouthFrownLeft", "mouthFrownRight")) * (1 - 0.8 * clamp2(smileOf(b) * 1.5)),
  pout: (b) => Math.max(avg(b, "mouthFrownLeft", "mouthFrownRight"), g(b, "mouthShrugLower") * 0.85, g(b, "mouthRollLower") * 0.6) * (1 - 0.8 * clamp2(smileOf(b) * 1.5))
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
    const target = !c || c.ready ? 1 : clamp2((c.progress - 0.5) * 2);
    if (this._first) {
      this.gate = target;
      this._first = false;
    } else this.gate += (target - this.gate) * Math.min(1, dt * 4);
    if (target === 1 && this.gate > 0.995) this.gate = 1;
    this.ready = this.gate > 0.98;
    for (let i = 0; i < this.names.length; i++) {
      const n = this.names[i], x = clamp2(CHANNELS[n](bs));
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
var _Q0 = [0, 0, 0, 1];
var _C1 = [1, 1, 1];
var Bodies = class {
  constructor(THREE, geo, mat, max = 100) {
    this.max = max;
    this.n = 0;
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    const F = (k) => new Float32Array(max * k);
    this.p = F(3);
    this.v = F(3);
    this.q = F(4);
    this.w = F(3);
    this.col = F(3);
    this.age = F(1);
    this.life = F(1);
    this.s = F(1);
    this.s1 = F(1);
    this.drag = F(1);
    this.grav = F(1);
    this.flut = F(1);
    this.ph = F(1);
    this.grow = F(1);
    this.sx = F(1);
    this.sy = F(1);
    this.sz = F(1);
    this.al = new Uint8Array(max);
    this._s1 = [this.age, this.life, this.s, this.s1, this.drag, this.grav, this.flut, this.ph, this.grow, this.sx, this.sy, this.sz, this.al];
    this.onDie = null;
  }
  clear() {
    this.n = 0;
    this.mesh.count = 0;
  }
  // o: { x,y,z, vx,vy,vz, life, s, s1, sx,sy,sz (forma), color: THREE.Color | [r,g,b], q:[x,y,z,w], wx,wy,wz, drag, grav, flut, grow }
  spawn(o) {
    if (this.n >= this.max) return -1;
    const i = this.n++, i3 = i * 3, i4 = i * 4;
    this.p[i3] = o.x || 0;
    this.p[i3 + 1] = o.y || 0;
    this.p[i3 + 2] = o.z || 0;
    this.v[i3] = o.vx || 0;
    this.v[i3 + 1] = o.vy || 0;
    this.v[i3 + 2] = o.vz || 0;
    const q = o.q || _Q0;
    for (let k = 0; k < 4; k++) this.q[i4 + k] = q[k];
    this.w[i3] = o.wx || 0;
    this.w[i3 + 1] = o.wy || 0;
    this.w[i3 + 2] = o.wz || 0;
    const c = o.color || _C1;
    if (c.isColor) {
      this.col[i3] = c.r;
      this.col[i3 + 1] = c.g;
      this.col[i3 + 2] = c.b;
    } else {
      this.col[i3] = c[0];
      this.col[i3 + 1] = c[1];
      this.col[i3 + 2] = c[2];
    }
    this.age[i] = 0;
    this.life[i] = o.life || 2;
    this.s[i] = o.s ?? 1;
    this.s1[i] = o.s1 ?? this.s[i];
    this.sx[i] = o.sx || 1;
    this.sy[i] = o.sy || 1;
    this.sz[i] = o.sz || 1;
    this.drag[i] = o.drag || 0;
    this.grav[i] = o.grav || 0;
    this.flut[i] = o.flut || 0;
    this.ph[i] = Math.random() * 6.283;
    this.grow[i] = o.grow || 0;
    this.al[i] = o.align ? 1 : 0;
    return i;
  }
  _kill(i) {
    if (this.onDie) this.onDie(i, this);
    const j = --this.n;
    if (i === j) return;
    for (let k = 0; k < 3; k++) {
      this.p[i * 3 + k] = this.p[j * 3 + k];
      this.v[i * 3 + k] = this.v[j * 3 + k];
      this.w[i * 3 + k] = this.w[j * 3 + k];
      this.col[i * 3 + k] = this.col[j * 3 + k];
    }
    for (let k = 0; k < 4; k++) this.q[i * 4 + k] = this.q[j * 4 + k];
    const S1 = this._s1;
    for (let a = 0; a < S1.length; a++) S1[a][i] = S1[a][j];
  }
  update(dt, down, extraForce) {
    const { p, v, q, w } = this;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this._kill(i);
        i--;
        continue;
      }
      const i3 = i * 3, i4 = i * 4, gk = this.grav[i] * dt, dk = Math.exp(-this.drag[i] * dt);
      v[i3] = (v[i3] + down.x * gk) * dk;
      v[i3 + 1] = (v[i3 + 1] + down.y * gk) * dk;
      v[i3 + 2] = (v[i3 + 2] + down.z * gk) * dk;
      if (extraForce) extraForce(i, p, v, dt);
      let fx = 0, fz = 0;
      if (this.flut[i]) {
        const a = this.age[i] * 5 + this.ph[i];
        fx = Math.sin(a) * this.flut[i];
        fz = Math.cos(a * 0.8) * this.flut[i] * 0.7;
      }
      p[i3] += (v[i3] + fx) * dt;
      p[i3 + 1] += v[i3 + 1] * dt;
      p[i3 + 2] += (v[i3 + 2] + fz) * dt;
      if (this.al[i]) {
        let ax = -v[i3], ay = -v[i3 + 1], az = -v[i3 + 2];
        const L = Math.sqrt(ax * ax + ay * ay + az * az);
        if (L > 1e-3) {
          ax /= L;
          ay /= L;
          az /= L;
          const r = ay + 1;
          if (r < 1e-5) {
            q[i4] = 1;
            q[i4 + 1] = 0;
            q[i4 + 2] = 0;
            q[i4 + 3] = 0;
          } else {
            const qx = az, qy = 0, qz = -ax, qw = r, n = 1 / Math.sqrt(qx * qx + qz * qz + qw * qw);
            q[i4] = qx * n;
            q[i4 + 1] = qy;
            q[i4 + 2] = qz * n;
            q[i4 + 3] = qw * n;
          }
        }
        continue;
      }
      const wx = w[i3], wy = w[i3 + 1], wz = w[i3 + 2];
      if (wx || wy || wz) {
        const x = q[i4], y = q[i4 + 1], z = q[i4 + 2], ww = q[i4 + 3], h = 0.5 * dt;
        let nx = x + h * (wx * ww + wy * z - wz * y), ny = y + h * (wy * ww + wz * x - wx * z), nz = z + h * (wz * ww + wx * y - wy * x), nw = ww + h * (-wx * x - wy * y - wz * z);
        const L = 1 / Math.hypot(nx, ny, nz, nw);
        q[i4] = nx * L;
        q[i4 + 1] = ny * L;
        q[i4 + 2] = nz * L;
        q[i4 + 3] = nw * L;
      }
    }
    this.write();
  }
  write() {
    const M = this.mesh.instanceMatrix.array, C = this.mesh.instanceColor.array;
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3, i4 = i * 4, o = i * 16, u = this.age[i] / this.life[i];
      let s = this.s[i] + (this.s1[i] - this.s[i]) * u;
      if (this.grow[i]) s *= Math.min(1, u / this.grow[i]);
      const x = this.q[i4], y = this.q[i4 + 1], z = this.q[i4 + 2], w = this.q[i4 + 3];
      const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
      const sx = s * this.sx[i], sy = s * this.sy[i], sz = s * this.sz[i];
      M[o] = (1 - (yy + zz)) * sx;
      M[o + 1] = (xy + wz) * sx;
      M[o + 2] = (xz - wy) * sx;
      M[o + 3] = 0;
      M[o + 4] = (xy - wz) * sy;
      M[o + 5] = (1 - (xx + zz)) * sy;
      M[o + 6] = (yz + wx) * sy;
      M[o + 7] = 0;
      M[o + 8] = (xz + wy) * sz;
      M[o + 9] = (yz - wx) * sz;
      M[o + 10] = (1 - (xx + yy)) * sz;
      M[o + 11] = 0;
      M[o + 12] = this.p[i3];
      M[o + 13] = this.p[i3 + 1];
      M[o + 14] = this.p[i3 + 2];
      M[o + 15] = 1;
      C[i3] = this.col[i3];
      C[i3 + 1] = this.col[i3 + 1];
      C[i3 + 2] = this.col[i3 + 2];
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
};

// fx/fascia_anni80.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "s": void 0, "s1": void 0, "color": void 0, "grav": void 0, "drag": void 0, "align": void 0 };
var __k1 = [0.85, 0.93, 1];
var meta = { label: "Fascia anni '80", labelEn: "80s sweatband", labelFr: "Bandeau ann\xE9es 80", labelDe: "80er-Stirnband", category: "costumi", icon: "\u{1F3BE}" };
async function build(THREE, h) {
  const g2 = new THREE.Group();
  g2.name = "fascia_anni80";
  const lo = bandRing(THREE, { yF: 6.25, yB: 4, n: 112, gap: () => 0 });
  const hi = bandRing(THREE, { yF: 10.6, yB: 8.6, n: 112, gap: () => 0 });
  const n = lo.n;
  const T = 0.62;
  const S = [];
  for (let k = 0; k <= 6; k++) {
    const a = Math.PI + k / 6 * (Math.PI / 2);
    S.push([0.06 + 0.06 * (1 + Math.cos(a)), 0.05 + T * 0.5 * (1 + Math.sin(a + Math.PI))]);
  }
  for (let k = 1; k <= 10; k++) {
    const t = 0.12 + k / 11 * 0.76;
    S.push([t, T + 0.12 * Math.sin(Math.PI * (t - 0.12) / 0.76)]);
  }
  for (let k = 0; k <= 6; k++) {
    const a = k / 6 * (Math.PI / 2);
    S.push([0.88 + 0.06 * Math.sin(a), 0.05 + T * Math.cos(a) * 0.95]);
  }
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  const geo = grid(THREE, n, S.length - 1, (i, j, out) => {
    const [t, off] = S[j];
    const th = lo.T[i] + (hi.T[i] - lo.T[i]) * t;
    hullAt(th, lo.phi[i], off + 0.06, out, N);
  }, { uRep: 1, flip: true });
  const C = canvas(16, 256), x = C.getContext("2d");
  x.fillStyle = "#ece4d6";
  x.fillRect(0, 0, 16, 256);
  x.fillStyle = "#c1272d";
  x.fillRect(0, 256 * 0.36, 16, 256 * 0.09);
  x.fillStyle = "#23409a";
  x.fillRect(0, 256 * 0.55, 16, 256 * 0.09);
  const map = texFrom(THREE, C, { wrap: true });
  map.repeat.set(1, 1);
  const uv = geo.attributes.uv;
  for (let k = 0; k < uv.count; k++) {
    const j = Math.floor(k / (n + 1));
    uv.setY(k, 1 - S[j][0]);
  }
  const nz = valueNoise(5, 128);
  const H = heightField(128, 128, (u, v) => Math.pow(nz(u * 128, v * 128), 2) * 0.7 + nz(u * 64 + 3, v * 64) * 0.3);
  const terryN = normalFromHeight(THREE, H, 128, 128, 4, [40, 4]);
  const mat = new THREE.MeshStandardMaterial({ map, normalMap: terryN, normalScale: new THREE.Vector2(1.1, 1.1), roughness: 1, envMapIntensity: 0.35, transparent: true });
  const col = new Float32Array(geo.attributes.position.count * 3);
  for (let j = 0; j < S.length; j++) for (let i = 0; i <= n; i++) {
    const k = j * (n + 1) + i, t = S[j][0];
    const s = 0.78 + 0.22 * smooth(0.04, 0.2, Math.min(t, 1 - t));
    col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = s;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  mat.vertexColors = true;
  g2.add(new THREE.Mesh(geo, mat));
  const U = g2.userData;
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.ex = new Expr(["jaw", "browDown"]);
  U.trig = new Trigger({ on: 0.55, off: 0.3, hold: 0.08, cooldown: 0.6 });
  U.world = worldRoot(THREE, g2, U.frame);
  const dg = new THREE.SphereGeometry(0.22, 12, 10);
  dg.translate(0, 0.22, 0);
  {
    const p = dg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 0.22) p.setX(i, p.getX(i) * (1 - (y - 0.22) / 0.3)), p.setZ(i, p.getZ(i) * (1 - (y - 0.22) / 0.3)), p.setY(i, 0.22 + (y - 0.22) * 2.2);
    }
    dg.computeVertexNormals();
  }
  const dm = new THREE.MeshPhysicalMaterial({ color: 13625599, roughness: 0.05, transmission: 0, clearcoat: 1, transparent: true, opacity: 0.75, envMapIntensity: 1.6 });
  U.drops = new Bodies(THREE, dg, dm, 40);
  U.world.add(U.drops.mesh);
  U.burst = 0;
  U.pw = new THREE.Vector3();
  U.vw = new THREE.Vector3();
  U.lp = new THREE.Vector3();
  U.lv = new THREE.Vector3();
  U.down = new THREE.Vector3(0, -1, 0);
  return g2;
}
function update(g2, bs, t, h) {
  const U = g2.userData, dt = U.tick.tick(t);
  const v = U.ex.update(bs, dt, h);
  U.frame.update(dt);
  U.world.userData.sync();
  if (U.trig.update(Math.max(v.jaw, v.browDown * 0.9), dt)) U.burst = 0.25;
  if (U.burst > 0) {
    U.burst -= dt;
    if (Math.random() < dt * 40) {
      const s = Math.random() < 0.5 ? -1 : 1, x = s * (4.5 + Math.random() * 2.5);
      U.lp.set(x, 8.5 + Math.random() * 1.5, 3.5 - Math.abs(x) * 0.45);
      U.lv.set(s * (12 + Math.random() * 10), 10 + Math.random() * 10, 4 + Math.random() * 4);
      U.frame.toWorld(U.lp, U.pw);
      U.frame.dirToWorld(U.lv, U.vw);
      U.drops.spawn((__s0["x"] = U.pw.x, __s0["y"] = U.pw.y, __s0["z"] = U.pw.z, __s0["vx"] = U.vw.x, __s0["vy"] = U.vw.y, __s0["vz"] = U.vw.z, __s0["life"] = 0.9, __s0["s"] = 0.9 + Math.random() * 0.5, __s0["s1"] = 0.6, __s0["color"] = __k1, __s0["grav"] = 160, __s0["drag"] = 0.4, __s0["align"] = true, __s0));
    }
  }
  U.drops.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
