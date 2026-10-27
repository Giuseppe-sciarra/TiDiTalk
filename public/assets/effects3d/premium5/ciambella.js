// Tiditalk — effetto viso 3D "ciambella" (premium5). Codice originale, AGPL-3.0. GENERATO da _src/fx/ciambella.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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
  const r2 = new THREE.Group();
  r2.matrixAutoUpdate = false;
  r2.userData.sync = () => {
    r2.matrix.copy(frame.Mi);
    r2.matrixWorldNeedsUpdate = true;
  };
  g2.add(r2);
  return r2;
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
          const r2 = ay + 1;
          if (r2 < 1e-5) {
            q[i4] = 1;
            q[i4 + 1] = 0;
            q[i4 + 2] = 0;
            q[i4 + 3] = 0;
          } else {
            const qx = az, qy = 0, qz = -ax, qw = r2, n = 1 / Math.sqrt(qx * qx + qz * qz + qw * qw);
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
var _RQ = [0, 0, 0, 1];
function randQuat(r2 = Math.random, out = _RQ) {
  const u1 = r2(), u2 = r2() * 6.2831853, u3 = r2() * 6.2831853, a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
  out[0] = a * Math.sin(u2);
  out[1] = a * Math.cos(u2);
  out[2] = b * Math.sin(u3);
  out[3] = b * Math.cos(u3);
  return out;
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
  const r2 = rng(seed), N = per, tab = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) tab[i] = r2();
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
  const r2 = rng(seed);
  const w = 128, h = 128;
  const H = new Float32Array(w * h);
  for (let k = 0; k < 900; k++) {
    const x0 = r2() * w, y0 = r2() * h, L = 4 + r2() * 8, a = -Math.PI / 2 + (r2() - 0.5) * 0.9, hv = 0.4 + r2() * 0.6;
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

// fx/ciambella.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "s": void 0, "color": void 0, "q": void 0, "wx": void 0, "wy": void 0, "wz": void 0, "grav": void 0, "drag": void 0 };
var meta = { label: "Ciambella glassata", labelEn: "Sprinkle donut", category: "divertenti", icon: "\u{1F369}" };
var SPR = [[1, 0.95, 0.9], [1, 0.82, 0.15], [0.3, 0.7, 1], [0.5, 0.88, 0.35], [0.72, 0.45, 1], [1, 0.5, 0.15]];
var R = 5.7;
var r = 2.7;
var cov = (u) => 1.42 + 0.28 * Math.sin(u * 7) + 0.14 * Math.sin(u * 13 + 1) + 0.1 * Math.sin(u * 3 + 2);
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  const M = new Mats(THREE);
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.expr = new Expr(["smile", "jaw"]);
  U.rnd = rng(81);
  const root = new THREE.Group();
  root.position.set(0, 12.7, -2.3);
  root.rotation.set(0.42, 0, 0.04);
  g2.add(root);
  U.root = root;
  const don = new THREE.Group();
  root.add(don);
  U.don = don;
  const spin = new THREE.Group();
  don.add(spin);
  U.spin = spin;
  const tg = new THREE.TorusGeometry(R, r, 32, 72);
  tg.rotateX(Math.PI / 2);
  vcolor(THREE, tg, (x, y, z, nx, ny, nz, o) => {
    const band = Math.exp(-Math.pow(y / (r * 0.28), 2));
    const dark = Math.max(0, -y / r);
    o[0] = 0.78 - 0.18 * dark + 0.15 * band;
    o[1] = 0.5 - 0.15 * dark + 0.25 * band;
    o[2] = 0.24 - 0.08 * dark + 0.25 * band;
  });
  spin.add(new THREE.Mesh(tg, M.matte(16777215, { vertexColors: true, roughness: 0.75 })));
  const NU = 144, NV = 18, pos = [], idx = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU * Math.PI * 2, c = cov(u), ox = Math.cos(u), oz = Math.sin(u);
    for (let j = 0; j <= NV; j++) {
      const th = (j / NV * 2 - 1) * c, e = Math.abs(th) / c;
      const rr = r + 0.12 + 0.2 * (1 - Math.pow(e, 6)) + 0.18 * Math.exp(-Math.pow((1 - e) / 0.08, 2));
      const sx = Math.sin(th), cy = Math.cos(th);
      pos.push((R + sx * rr) * ox, cy * rr, (R + sx * rr) * oz);
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const a = i * (NV + 1) + j, b = a + NV + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  gg.setIndex(idx);
  gg.computeVertexNormals();
  spin.add(new THREE.Mesh(gg, M.glaze(15490965, { roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide })));
  const spG = new THREE.CapsuleGeometry(0.12, 0.5, 3, 6), spM = M.candy(16777215, { roughness: 0.3 });
  const ns = 90, inst = new THREE.InstancedMesh(spG, spM, ns), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
  const r0 = rng(5);
  for (let i = 0; i < ns; i++) {
    const u = r0() * Math.PI * 2, th = (r0() * 2 - 1) * cov(u) * 0.8, rr = r + 0.42;
    v.set((R + Math.sin(th) * rr) * Math.cos(u), Math.cos(th) * rr, (R + Math.sin(th) * rr) * Math.sin(u));
    e3.set(r0() * 6, r0() * 6, r0() * 6);
    q.setFromEuler(e3);
    m4.compose(v, q, one);
    inst.setMatrixAt(i, m4);
    const c = SPR[i % SPR.length];
    col.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
    inst.setColorAt(i, col);
  }
  spin.add(inst);
  const fu = Math.PI / 2, fth = 0.62, fr = r + 0.4;
  const fp = new THREE.Vector3((R + Math.sin(fth) * fr) * Math.cos(fu), Math.cos(fth) * fr, (R + Math.sin(fth) * fr) * Math.sin(fu));
  const fn = new THREE.Vector3(Math.sin(fth) * Math.cos(fu), Math.cos(fth), Math.sin(fth) * Math.sin(fu));
  const face = new KFace(THREE, M, {
    eyeR: 0.5,
    gap: 1.55,
    eyeY: 0.1,
    tall: 1.15,
    mouthY: -0.85,
    mouthW: 0.38,
    blushR: 0.58,
    blushX: 2.6,
    blushY: -0.5,
    blushColor: 16740234,
    blushOp: 0.55,
    surf: (x, y) => -x * x * 0.035 - y * y * 0.12
  });
  face.g.position.copy(fp);
  face.g.lookAt(fp.clone().add(fn));
  spin.add(face.g);
  U.face = face;
  const world = worldRoot(THREE, g2, U.frame);
  U.world = world;
  U.bodies = new Bodies(THREE, spG, M.candy(16777215, { roughness: 0.3 }), 90);
  world.add(U.bodies.mesh);
  U.smileT = new Trigger({ on: 0.5, off: 0.3, cooldown: 1.2 });
  U.happy = 0;
  U.hop = new Spring(0, 140, 6);
  U.turn = 0;
  U.turnV = 0;
  U.burst = 0;
  U.v = new THREE.Vector3();
  U.w = new THREE.Vector3();
  U.down = new THREE.Vector3(0, -1, 0);
  U.c3 = [1, 1, 1];
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
  U.happy = damp(U.happy, show ? 1 : smooth(0.35, 0.75, e.smile), 6, dt);
  if (!show && U.smileT.update(e.smile, dt)) {
    U.hop.v += 12;
    U.turn = 1;
    U.burst = 0.45;
  }
  const hp = U.hop.step(dt, 0);
  U.don.position.y = Math.max(0, hp) * 2 + Math.sin(t * 1.8) * 0.12;
  if (U.turn > 0) {
    U.turn = Math.max(0, U.turn - dt / 0.8);
    const k = 1 - U.turn;
    U.spin.rotation.y = -(k * k * (3 - 2 * k)) * Math.PI * 2;
  } else U.spin.rotation.y = 0;
  const blink = show ? 0 : ((bs.eyeBlinkLeft || 0) + (bs.eyeBlinkRight || 0)) / 2;
  U.face.set(blink, U.happy, show ? 0 : clamp(e.jaw * 1.4));
  if (U.burst > 0 && !show) {
    U.burst -= dt;
    for (let k = 0; k < 4; k++) {
      const a = U.rnd() * 6.283;
      U.frame.toWorld(U.v.set(U.root.position.x + Math.cos(a) * R, U.root.position.y + 2.5, U.root.position.z + Math.sin(a) * R * 0.7), U.w);
      const c = SPR[U.rnd() * SPR.length | 0];
      U.c3[0] = c[0] * c[0];
      U.c3[1] = c[1] * c[1];
      U.c3[2] = c[2] * c[2];
      U.bodies.spawn((__s0["x"] = U.w.x, __s0["y"] = U.w.y, __s0["z"] = U.w.z, __s0["vx"] = Math.cos(a) * (8 + U.rnd() * 8), __s0["vy"] = 12 + U.rnd() * 10, __s0["vz"] = Math.sin(a) * 6 + 4, __s0["life"] = 1.6, __s0["s"] = 1.3, __s0["color"] = U.c3, __s0["q"] = randQuat(U.rnd), __s0["wx"] = (U.rnd() - 0.5) * 20, __s0["wy"] = (U.rnd() - 0.5) * 20, __s0["wz"] = (U.rnd() - 0.5) * 20, __s0["grav"] = 60, __s0["drag"] = 0.4, __s0));
    }
  }
  U.bodies.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
