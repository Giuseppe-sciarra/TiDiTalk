// Tiditalk — effetto viso 3D "easter_bunny" (premium3). Codice originale, AGPL-3.0. GENERATO da _src/fx/easter_bunny.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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

// fx/easter_bunny.js
var UP_X = [1, 0, 0];
var meta = { label: "Coniglietto pasquale", labelEn: "Easter bunny", labelFr: "Lapin de P\xE2ques", labelDe: "Osterhase", category: "costumi", icon: "\u{1F423}" };
var NE = 26;
function eggTex(THREE, k) {
  const c = canvas(256, 256), x = c.getContext("2d");
  const P = [["#ffd6e6", "#ff7fae", "#ffffff"], ["#d4f2ff", "#4fb3ff", "#fff4b0"], ["#e8ffd4", "#6ccf5a", "#ffffff"], ["#fff1c4", "#ffb42e", "#ff6f91"], ["#efe0ff", "#a675ff", "#fff4b0"]][k % 5];
  x.fillStyle = P[0];
  x.fillRect(0, 0, 256, 256);
  if (k % 3 === 0) {
    x.fillStyle = P[1];
    for (let i = 0; i < 4; i++) x.fillRect(0, 40 + i * 52, 256, 14);
    x.fillStyle = P[2];
    for (let i = 0; i < 16; i++) {
      x.beginPath();
      x.arc(i * 16 + 8, 73, 4, 0, 6.3);
      x.fill();
    }
  } else if (k % 3 === 1) {
    x.strokeStyle = P[1];
    x.lineWidth = 12;
    for (const y of [70, 130, 190]) {
      x.beginPath();
      for (let i = 0; i <= 16; i++) x.lineTo(i * 16, y + (i % 2 ? -14 : 14));
      x.stroke();
    }
    x.fillStyle = P[2];
    for (let i = 0; i < 30; i++) {
      x.beginPath();
      x.arc(i * 53 % 256, 100 + i * 37 % 60, 4, 0, 6.3);
      x.fill();
    }
  } else {
    x.fillStyle = P[1];
    for (let i = 0; i < 40; i++) {
      x.beginPath();
      x.arc(i * 61 % 256, i * 97 % 256, 9, 0, 6.3);
      x.fill();
    }
    x.fillStyle = P[2];
    x.fillRect(0, 118, 256, 18);
  }
  return texFrom(THREE, c, { repeat: [1, 1] });
}
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.expr = new Expr(["smile"]);
  U.rnd = rng(111);
  const satin = new THREE.MeshPhysicalMaterial({ color: 16033730, roughness: 0.35, clearcoat: 0.5, sheen: 0.8, sheenColor: new THREE.Color(16766692), transparent: true });
  const band = [];
  for (let i = 0; i <= 40; i++) {
    const a = -1.88 + i / 40 * 3.76;
    band.push(new THREE.Vector3(Math.sin(a) * 9.2, 5.6 + Math.cos(a) * 9.2, -2.6 - Math.cos(a) * 0.8));
  }
  g2.add(new THREE.Mesh(taperTube(THREE, new THREE.CatmullRomCurve3(band), { segs: 80, radial: 10, r: () => 0.5, sx: 1.9, sy: 0.6 }), satin));
  const bandAt = (a, out = new THREE.Vector3()) => out.set(Math.sin(a) * 9.2, 5.6 + Math.cos(a) * 9.2, -2.6 - Math.cos(a) * 0.8);
  const fur = new THREE.MeshStandardMaterial({ color: 14273984, vertexColors: true, roughness: 0.95, normalMap: furNormal(THREE, 7, [2, 4], 4), normalScale: new THREE.Vector2(0.8, 0.8), side: THREE.DoubleSide, transparent: true });
  const pink = new THREE.MeshStandardMaterial({ color: 15633062, roughness: 0.75, side: THREE.DoubleSide, transparent: true });
  U.ears = [];
  for (const [sx, flop] of [[-1, false], [1, true]]) {
    const outT = new DynTube(THREE, NE, 14, { r: (s) => s < 0.06 ? 0.9 + s * 8 : Math.sin(Math.min(1, (s + 0.08) / 1.08) * Math.PI) * 2.5 + 0.14, sx: 1, sy: 0.34, capEnd: true });
    const inT = new DynTube(THREE, NE, 12, { r: (s) => Math.max(0.05, Math.sin(Math.min(1, (s + 0.02) / 1) * Math.PI) * 1.75 - 0.05), sx: 1, sy: 0.16 });
    {
      const n = outT.geo.attributes.position.count, ca = new Float32Array(n * 3);
      for (let i = 0; i < NE; i++) for (let j = 0; j <= 14; j++) {
        const s = i / (NE - 1), edge = Math.abs(Math.cos(j / 14 * Math.PI * 2)), f = (0.72 + 0.28 * Math.min(1, s * 5)) * (1 - 0.18 * Math.pow(edge, 6));
        const k = (i * 15 + j) * 3;
        ca[k] = f;
        ca[k + 1] = f * 0.985;
        ca[k + 2] = f * 0.97;
      }
      for (let k = NE * 15 * 3; k < n * 3; k++) ca[k] = 0.9;
      outT.geo.setAttribute("color", new THREE.BufferAttribute(ca, 3));
    }
    const mo = new THREE.Mesh(outT.geo, fur), mi = new THREE.Mesh(inT.geo, pink);
    mo.frustumCulled = mi.frustumCulled = false;
    g2.add(mo, mi);
    const base = bandAt(sx * 0.28);
    base.y += 0.2;
    U.ears.push({ sx, flop, outT, inT, base, pts: new Float32Array(NE * 3), pin: new Float32Array(NE * 3), dangle: new Dangle(THREE, 12, { damping: 0.88, stiff: flop ? 120 : 420, grav: 600 }), tw: new Spring(0, 260, 9), next: 1 + U.rnd() * 3, perk: 0 });
  }
  const eggGeo = smoothLathe(THREE, [[0, -1], [0.55, -0.88], [0.78, -0.45], [0.8, 0.05], [0.66, 0.6], [0.38, 0.98], [0, 1.12]], 28, 4);
  U.eggs = [];
  [-0.62, -0.4, -0.12, 0.14, 0.42, 0.64].forEach((a, i) => {
    const p = bandAt(a);
    p.z += 1.6;
    p.y += 0.4;
    const m = new THREE.Mesh(eggGeo, new THREE.MeshPhysicalMaterial({ map: eggTex(THREE, i), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15, transparent: true }));
    m.position.copy(p);
    m.rotation.set(0.25, (U.rnd() - 0.5) * 0.8, -a * 0.9 + (U.rnd() - 0.5) * 0.3);
    m.scale.setScalar(1.85);
    g2.add(m);
    U.eggs.push({ m, y0: p.y, hop: new Spring(0, 180, 8), rz: m.rotation.z });
  });
  const petal = new THREE.Shape();
  petal.moveTo(0, 0);
  petal.quadraticCurveTo(0.35, 0.6, 0, 1.25);
  petal.quadraticCurveTo(-0.35, 0.6, 0, 0);
  const pg = puffy(THREE, petal, { depth: 0.04, bevel: 0.05, size: 0.04, seg: 1, curveSeg: 6 });
  const petals = [];
  for (let k = 0; k < 10; k++) {
    const q = pg.clone();
    q.rotateZ(k * Math.PI / 5);
    petals.push(q);
  }
  const daisy = merge(THREE, petals);
  const white = new THREE.MeshStandardMaterial({ color: 16118506, roughness: 0.6, transparent: true }), yel = new THREE.MeshStandardMaterial({ color: 16763176, roughness: 0.5, transparent: true });
  for (const a of [-0.52, -0.26, 0, 0.28, 0.53]) {
    const p = bandAt(a);
    p.z += 1.4;
    p.y += 0.6;
    const f = new THREE.Group();
    f.add(new THREE.Mesh(daisy, white));
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), yel);
    c.scale.z = 0.6;
    c.position.z = 0.1;
    f.add(c);
    f.position.copy(p);
    f.rotation.set(-0.35, 0, -a);
    f.scale.setScalar(1.45);
    g2.add(f);
  }
  U.v = new THREE.Vector3();
  U.w = new THREE.Vector3();
  U.r = new THREE.Vector3();
  U.down = new THREE.Vector3(0, -1, 0);
  U.upL = new THREE.Vector3(0, 1, 0);
  U.happy = 0;
  U.showcase = false;
  return g2;
}
function shapeEar(U, E, dirL) {
  const L = 14, B = E.base, P = E.pts, Q = E.pin;
  const tip = U.r.copy(B).addScaledVector(dirL, L);
  const cx = B.x + E.sx * 0.2, cy = B.y + L * 0.55, cz = B.z;
  for (let i = 0; i < NE; i++) {
    const s = i / (NE - 1), u = 1 - s;
    const x = u * u * B.x + 2 * u * s * cx + s * s * tip.x, y = u * u * B.y + 2 * u * s * cy + s * s * tip.y, z = u * u * B.z + 2 * u * s * cz + s * s * tip.z;
    P[i * 3] = x;
    P[i * 3 + 1] = y;
    P[i * 3 + 2] = z;
    Q[i * 3] = x;
    Q[i * 3 + 1] = y;
    Q[i * 3 + 2] = z + 0.62;
  }
  E.outT.update(P, UP_X);
  E.inT.update(Q, UP_X);
}
function update(g2, bs, t, h) {
  const U = g2.userData;
  if (!U.frame) return;
  const dt = U.tick.tick(t);
  U.frame.update(dt);
  const e = U.expr.update(bs, dt, h);
  let happy = e.smile > 0.5 ? 1 : 0;
  if (!U.frame.attached && !U.showcase) {
    U.showcase = true;
  }
  U.happy = damp(U.happy, happy, 4, dt);
  for (const E of U.ears) {
    E.next -= dt;
    if (E.next <= 0) {
      E.next = 1.6 + U.rnd() * 3;
      E.tw.v += 6;
    }
    const tw = E.tw.step(dt, 0);
    const flopK = E.flop ? 1 - U.happy * 0.85 : 0;
    const rest = U.v.set(E.sx * (0.22 + flopK * 0.7) + tw * 0.15 * E.sx, 1 - flopK * 1.15, 0.05 + flopK * 0.45).normalize();
    const pw = U.frame.toWorld(E.base, U.w), rw = U.frame.dirToWorld(rest, U.r);
    E.dangle.stiff = (E.flop ? 120 : 420) + U.happy * 300;
    const dw = E.dangle.step(dt, pw, rw, U.down);
    const dl = U.frame.dirToLocal(dw, U.v).normalize();
    shapeEar(U, E, dl);
  }
  for (const Eg of U.eggs) {
    if (U.happy > 0.6 && Eg.hop.x < 0.05 && U.rnd() < dt * 3) Eg.hop.v += 9;
    const y = Math.max(0, Eg.hop.step(dt, 0));
    Eg.m.position.y = Eg.y0 + y * 0.8;
    Eg.m.rotation.z = Eg.rz + Math.sin(t * 6 + Eg.y0) * 0.06 * U.happy;
  }
}
export {
  build as default,
  meta,
  update
};
