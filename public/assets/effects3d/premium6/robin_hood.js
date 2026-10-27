// Tiditalk — effetto viso 3D "robin_hood" (premium6). Codice originale, AGPL-3.0. GENERATO da _src/fx/robin_hood.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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
function depthOnly(THREE, { side = THREE.DoubleSide } = {}) {
  return new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side });
}
function fillerCap(THREE, ring, { inset = 0.15, nv = 12 } = {}) {
  const n = ring.n, p = new THREE.Vector3(), nn = new THREE.Vector3();
  const g2 = grid(THREE, n, nv, (i, j, out) => {
    const t = j / nv, th = ring.T[i] * (1 - t);
    const gp = ring.G ? ring.G[i] : 0;
    hullAt(Math.max(1e-4, th), ring.phi[i], gp * Math.pow(1 - t, 1.5) - inset * t, out, nn);
  });
  const m = new THREE.Mesh(g2, depthOnly(THREE));
  m.renderOrder = -1;
  m.name = "filler";
  return m;
}
function faceShadow(THREE, h, alphaFn, { color = 1708556, opacity = 1, lift = 0.06 } = {}) {
  const fm = h.face, nV = fm.pos.length / 3;
  const pos = new Float32Array(nV * 3), al = new Float32Array(nV);
  const base = new THREE.BufferGeometry();
  base.setAttribute("position", new THREE.Float32BufferAttribute(fm.pos, 3));
  base.setIndex(fm.idx);
  base.computeVertexNormals();
  const nr = base.attributes.normal.array;
  for (let i = 0; i < nV; i++) {
    const x = fm.pos[i * 3], y = fm.pos[i * 3 + 1], z = fm.pos[i * 3 + 2];
    pos[i * 3] = x + nr[i * 3] * lift;
    pos[i * 3 + 1] = y + nr[i * 3 + 1] * lift;
    pos[i * 3 + 2] = z + nr[i * 3 + 2] * lift;
    al[i] = clamp(alphaFn(x, y, z));
  }
  const idx = [];
  for (let t = 0; t < fm.idx.length; t += 3) {
    const a = fm.idx[t], b = fm.idx[t + 1], c = fm.idx[t + 2];
    if (al[a] + al[b] + al[c] > 3e-3) idx.push(a, b, c);
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g2.setAttribute("alpha", new THREE.BufferAttribute(al, 1));
  g2.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(color) }, uOp: { value: opacity } },
    vertexShader: "attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 uCol; uniform float uOp; varying float vA; void main(){ gl_FragColor = vec4(uCol, vA * uOp); }",
    transparent: true,
    depthWrite: false
  });
  const m = new THREE.Mesh(g2, mat);
  m.renderOrder = 1;
  m.name = "shadow";
  return m;
}

// lib/hatkit.js
function resample(pts, n) {
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k2 = 0; k2 < 16; k2++) {
      const t = k2 / 16, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  dense.push(pts[pts.length - 1].slice());
  const L = [0];
  for (let i = 1; i < dense.length; i++) L.push(L[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const out = [];
  let k = 0;
  for (let i = 0; i <= n; i++) {
    const s = i / n * L[L.length - 1];
    while (k < L.length - 2 && L[k + 1] < s) k++;
    const t = (s - L[k]) / (L[k + 1] - L[k] || 1);
    out.push([dense[k][0] + (dense[k + 1][0] - dense[k][0]) * t, dense[k][1] + (dense[k + 1][1] - dense[k][1]) * t]);
  }
  return out;
}
function crown(THREE, ring, profile, { nv = 30, hScale = null, dent = null, shade = null } = {}) {
  const profs = typeof profile === "function" ? Array.from({ length: ring.n + 1 }, (_, i) => resample(profile(i, ring.phi[i]), nv)) : null;
  const prof = profs ? profs[0] : resample(profile, nv);
  const n = ring.n, C = ring.C, A = ring.axis, Fw = ring.fwd, Sd = ring.side;
  const Rv = [], D = [], Rl = [];
  for (let i = 0; i <= n; i++) {
    const r = ring.P[i].clone().sub(C);
    r.projectOnPlane(A);
    Rv.push(r);
    Rl.push(r.length());
    D.push(r.clone().normalize());
  }
  const out0 = new THREE.Vector3();
  const pt = (i, j, out) => {
    const [r, h0] = profs ? profs[i][j] : prof[j];
    const hs = hScale ? hScale(i) : 1;
    let rr = r * Rl[i], hh = h0 * hs;
    if (dent) {
      const lx = r * Rv[i].dot(Sd), lf = r * Rv[i].dot(Fw);
      const d = dent(i, r, hh, lx, lf, ring.phi[i], j / nv);
      rr += d[0];
      hh += d[1];
    }
    const base = ring.P[i];
    out.copy(C).addScaledVector(D[i], rr).addScaledVector(A, hh);
    const dz = base.clone().sub(C).dot(A);
    out.addScaledVector(A, dz * (1 - j / nv));
    return out;
  };
  const geo = grid(THREE, n, nv, (i, j, out) => pt(i, j, out), { pole1: true, flip: true, colors: shade ? (i, j, c) => shade(i, j / nv, prof[j], c) : null });
  return { geo, pt, prof, profs, nv, D, Rl };
}
function brim(THREE, ring, { w = () => 5, curl = () => 0, th = 0.3, ns = 10, edge = 6, dark = 0.62, inset = 0.25, top = 1, ao = 0.3, topAo = 0.75 } = {}) {
  const n = ring.n, A = ring.axis, C = ring.C;
  const D = [];
  for (let i = 0; i <= n; i++) D.push(ring.P[i].clone().sub(C).projectOnPlane(A).normalize());
  const sec = [];
  for (let k = 0; k <= ns; k++) sec.push([k / ns, 1, null]);
  for (let k = 1; k < edge; k++) sec.push([1, 0, Math.PI / 2 - k / edge * Math.PI]);
  for (let k = ns; k >= 0; k--) sec.push([k / ns, -1, null]);
  const P = new THREE.Vector3(), Q = new THREE.Vector3(), T = new THREE.Vector3(), Nn = new THREE.Vector3();
  const mid = (i, s, out) => {
    const ww = w(i);
    out.copy(ring.P[i]).addScaledVector(D[i], -inset + (ww + inset) * s).addScaledVector(A, curl(i, s) - th * 0.5);
    return out;
  };
  const geo = grid(THREE, n, sec.length - 1, (i, j, out) => {
    const [s, side, ang] = sec[j];
    mid(i, s, P);
    mid(i, Math.min(1, s + 0.02), Q);
    mid(i, Math.max(0, s - 0.02), T);
    Q.sub(T).normalize();
    Nn.copy(A).addScaledVector(Q, -A.dot(Q)).normalize();
    if (ang === null) out.copy(P).addScaledVector(Nn, side * th * 0.5);
    else out.copy(P).addScaledVector(Nn, Math.sin(ang) * th * 0.5).addScaledVector(Q, Math.cos(ang) * th * 0.5);
  }, { colors: (i, j, c) => {
    const s = sec[j][0], side = sec[j][1], ang = sec[j][2];
    const kb = dark * (ao + (1 - ao) * smooth(0, 0.7, s)), kt = top * (topAo + (1 - topAo) * smooth(0, 0.35, s));
    const k = side > 0 ? kt : side < 0 ? kb : kb + (kt - kb) * (0.5 + 0.5 * Math.sin(ang));
    c.setRGB(k, k, k);
  }, uRep: Math.round(n / 8), vRep: 1 });
  return { geo, mid, D };
}
function hatRig(THREE, g2, ring) {
  const pivot = new THREE.Group();
  pivot.position.copy(ring.C);
  g2.add(pivot);
  const hat = new THREE.Group();
  hat.position.copy(ring.C).negate();
  pivot.add(hat);
  return { pivot, hat, y0: pivot.position.y, z0: pivot.position.z };
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
    this._lp = new THREE.Vector3();
  }
  // pivot e restDir in spazio mondo; restituisce la direzione (mondo, normalizzata)
  step(dt, pivot, restDir, down) {
    if (this.init && this._lp.distanceToSquared(pivot) > 64) this.init = false;
    this._lp.copy(pivot);
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

// lib/mats.js
var V2 = (THREE, a, b = a) => new THREE.Vector2(a, b);
var _mottle = null;
function mottleTex(THREE) {
  if (_mottle && _mottle.__T === THREE && _mottle.image) return _mottle;
  const S = 128, c = canvas(S, S), x = c.getContext("2d"), img = x.createImageData(S, S), d = img.data;
  const n1 = valueNoise(21, 8), n2 = valueNoise(5, 32);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const v = 0.9 + (fbm(n1, i / 16, j / 16, 3) - 0.5) * 0.22 + (n2(i / 2, j / 2) - 0.5) * 0.08;
    const k = (j * S + i) * 4;
    d[k] = d[k + 1] = d[k + 2] = Math.max(0, Math.min(255, v * 255));
    d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  _mottle = texFrom(THREE, c, { srgb: true });
  _mottle.__T = THREE;
  return _mottle;
}
function felt(THREE, color, { rep = [6, 6], mot = [2, 1], ...o } = {}) {
  const c = new THREE.Color(color);
  const map = mottleTex(THREE).clone();
  map.repeat.set(mot[0], mot[1]);
  map.needsUpdate = true;
  return new THREE.MeshPhysicalMaterial(Object.assign({
    color: c,
    map,
    roughness: 0.88,
    metalness: 0,
    sheen: 0.5,
    sheenRoughness: 0.6,
    sheenColor: c.clone().lerp(new THREE.Color(1, 1, 1), 0.22),
    normalMap: feltNormal(THREE, 3, rep, 2.2),
    normalScale: V2(THREE, 0.6),
    envMapIntensity: 0.45,
    transparent: true
  }, o));
}
function lining(THREE, color = 1906451) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.BackSide, envMapIntensity: 0.25, transparent: true });
}
function leather(THREE, color, o = {}) {
  const n = valueNoise(11, 64);
  const H = heightField(128, 128, (u, v) => fbm(n, u * 40, v * 40, 3));
  const nrm = normalFromHeight(THREE, H, 128, 128, 3, [3, 3]);
  return new THREE.MeshPhysicalMaterial(Object.assign({ color: new THREE.Color(color), roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.5, normalMap: nrm, normalScale: V2(THREE, 0.4), envMapIntensity: 0.7, transparent: true }, o));
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
var Rel = class {
  constructor({ up = 0.035, down = 3 } = {}) {
    this.up = up;
    this.down = down;
    this.b = 0;
    this.init = false;
    this.v = 0;
  }
  update(x, dt, ready = true) {
    if (!ready) {
      this.init = false;
      this.v = 0;
      return 0;
    }
    if (!this.init) {
      this.b = x;
      this.init = true;
    }
    const k = x < this.b ? this.down : this.up;
    this.b += (x - this.b) * (1 - Math.exp(-k * dt));
    this.v = clamp2((x - this.b) / Math.max(0.3, 1 - this.b));
    return this.v;
  }
};

// lib/kawaii.js
var TAU2 = Math.PI * 2;
var Swing = class {
  constructor(THREE, obj, { len = 4, stiff = 300, damping = 0.86, grav = 400 } = {}) {
    this.obj = obj;
    this.qBase = obj.quaternion.clone();
    this.d = new Dangle(THREE, len, { damping, stiff, grav });
    this.pw = new THREE.Vector3();
    this.rw = new THREE.Vector3();
    this.rl = new THREE.Vector3();
    this.dl = new THREE.Vector3();
    this.q = new THREE.Quaternion();
    this.Y = new THREE.Vector3(0, 1, 0);
    this.off = new THREE.Vector3();
  }
  // frame: HeadFrame; down: gravità nel mondo; pivotLocal: posizione del perno nello spazio del gruppo
  step(dt, frame, down, pivotLocal) {
    this.rl.copy(this.Y).applyQuaternion(this.qBase);
    frame.toWorld(pivotLocal, this.pw);
    frame.dirToWorld(this.rl, this.rw);
    const dw = this.d.step(dt, this.pw, this.rw, down);
    frame.dirToLocal(dw, this.dl).normalize();
    this.q.setFromUnitVectors(this.rl, this.dl);
    this.obj.quaternion.copy(this.qBase).premultiply(this.q);
  }
  // nelle miniature (nessun genitore): posa di riposo, senza gravità
  rest() {
    this.obj.quaternion.copy(this.qBase);
    this.d.init = false;
  }
};

// fx/robin_hood.js
var meta = { label: "Cappello di Robin Hood", labelEn: "Robin Hood hat", labelFr: "Chapeau de Robin des Bois", labelDe: "Robin-Hood-Hut", category: "costumi", icon: "\u{1F3F9}" };
function featherTex(THREE) {
  const W = 128, H = 512, c = canvas(W, H), x = c.getContext("2d");
  x.clearRect(0, 0, W, H);
  for (let y = 6; y < H - 4; y += 2) {
    const t2 = y / H, half = W * 0.47 * Math.sin(Math.min(1, t2 * 1.15 + 0.06) * Math.PI) ** 0.6;
    const notch = Math.sin(y * 0.11) > 0.93 ? 0.55 : 1;
    for (const s of [-1, 1]) {
      const r = Math.round(170 + 50 * t2), gg = Math.round(40 + 40 * t2), b = Math.round(30 + 10 * t2);
      x.strokeStyle = `rgba(${r},${gg},${b},${0.95})`;
      x.lineWidth = 1.6;
      x.beginPath();
      x.moveTo(W / 2, y);
      x.quadraticCurveTo(W / 2 + s * half * 0.5, y - 6, W / 2 + s * half * notch, y - 14 - 10 * (1 - t2));
      x.stroke();
    }
  }
  const gr = x.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "rgba(40,10,5,0.55)");
  gr.addColorStop(0.18, "rgba(40,10,5,0)");
  gr.addColorStop(0.8, "rgba(255,230,190,0)");
  gr.addColorStop(0.95, "rgba(255,230,190,0.35)");
  x.globalCompositeOperation = "source-atop";
  x.fillStyle = gr;
  x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "source-over";
  x.strokeStyle = "#efe0c8";
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(W / 2, 4);
  x.lineTo(W / 2, H);
  x.stroke();
  const t = texFrom(THREE, c, { wrap: false });
  return t;
}
async function build(THREE, h) {
  const g2 = new THREE.Group();
  g2.name = "robin_hood";
  const ring = bandRing(THREE, { yF: 8.6, yB: 4.6, n: 96, gap: (p) => 0.35 + 0.6 * (1 - Math.pow(Math.cos(p) * 0.5 + 0.5, 3)) });
  const R = hatRig(THREE, g2, ring), hat = R.hat;
  const profile = [[1, 0], [0.985, 2.5], [0.94, 5], [0.86, 7.2], [0.72, 8.8], [0.5, 9.8], [0.24, 10.3], [0, 10.4]];
  const dent = (i, r, hh, lx, lf, phi, v) => {
    const ridge = smooth(0.3, 0.95, v);
    const pinch = 2.4 * ridge * Math.min(1, Math.abs(lx) / 3.2) * Math.abs(Math.sin(phi));
    const back = Math.max(0, -Math.cos(phi)), front = Math.max(0, Math.cos(phi));
    const rise = (2.6 * back * back - 1.6 * front * front) * smooth(0.2, 1, v) - 1.1 * smooth(-3, 6, lf) * ridge;
    return [-pinch, rise];
  };
  const cr = crown(THREE, ring, profile, { nv: 32, dent });
  {
    const pos = cr.geo.attributes.position, n = ring.n, col = new Float32Array(pos.count * 3);
    for (let j = 0; j <= cr.nv; j++) for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i, v = j / cr.nv, sd = Math.abs(Math.sin(ring.phi[i % n]));
      const s = clamp(0.78 + 0.22 * smooth(0, 0.3, v) - 0.12 * sd * smooth(0.5, 0.9, v));
      col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = s;
    }
    cr.geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  }
  const GREEN = 3099435;
  const fm = felt(THREE, GREEN, { rep: [10, 4] });
  fm.vertexColors = true;
  hat.add(new THREE.Mesh(cr.geo, fm));
  hat.add(new THREE.Mesh(cr.geo, lining(THREE, 1382671)));
  const br = brim(THREE, ring, {
    th: 0.3,
    ns: 12,
    edge: 6,
    dark: 0.82,
    ao: 0.6,
    topAo: 0.85,
    inset: 0.3,
    w: (i) => {
      const p = ring.phi[i], c = Math.cos(p), a = Math.atan2(Math.sin(p), c);
      return 2.6 + 2.6 * Math.max(0, -c) + 3.6 * Math.exp(-(a * a) / (0.38 * 0.38));
    },
    curl: (i, s) => {
      const p = ring.phi[i], c = Math.cos(p), a = Math.atan2(Math.sin(p), c);
      const beak = Math.exp(-(a * a) / (0.45 * 0.45));
      return Math.pow(s, 1.15) * (3.6 * Math.max(0, -c) + 1.9 * (1 - beak) * (1 - Math.max(0, -c)) - 1.6 * beak);
    }
  });
  const fb = felt(THREE, GREEN, { rep: [24, 2] });
  fb.vertexColors = true;
  hat.add(new THREE.Mesh(br.geo, fb));
  {
    const pts = [];
    for (let i = 0; i < ring.n; i += 2) {
      const p = cr.pt(i, 1, new THREE.Vector3()).addScaledVector(cr.D[i], 0.18);
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    hat.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 140, 0.2, 8, true), leather(THREE, 4861466)));
  }
  const ia = Math.round(ring.n * 0.2);
  const base = cr.pt(ia, 1, new THREE.Vector3()).addScaledVector(cr.D[ia], 0.35);
  const fpiv = new THREE.Group();
  fpiv.position.copy(base);
  hat.add(fpiv);
  const fdir = new THREE.Vector3(0.3, 0.62, -0.72).normalize();
  fpiv.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fdir);
  const feather = new THREE.Group();
  fpiv.add(feather);
  {
    const L = 20, segs = 44, wMax = 2.1;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, y = t * L, bend = -1.6 * t * t, twist = 0.35 * t;
      for (let k = 0; k <= 4; k++) {
        const u = k / 4, xx = (u - 0.5) * wMax * 2;
        const curlUp = 0.35 * Math.pow(Math.abs(u - 0.5) * 2, 2);
        pos.push(xx * Math.cos(twist), y, bend + curlUp + xx * Math.sin(twist));
        uv.push(u, t);
      }
    }
    for (let i = 0; i < segs; i++) for (let k = 0; k < 4; k++) {
      const a = i * 5 + k, b = a + 5;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const tex = featherTex(THREE);
    tex.flipY = true;
    const fmat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.75, transparent: true });
    const vane = new THREE.Mesh(geo, fmat);
    feather.add(vane);
    const quill = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.6, 6), new THREE.MeshStandardMaterial({ color: 15260870, roughness: 0.5, transparent: true }));
    quill.position.y = 0.5;
    feather.add(quill);
  }
  g2.add(fillerCap(THREE, ring));
  const shadow = faceShadow(THREE, h, (x, y, z) => smooth(6.2, 8.2, y) * smooth(1, 4, z) * 0.35 * Math.exp(-(x * x) / 12), { lift: 0.2 });
  g2.add(shadow);
  const U = g2.userData;
  Object.assign(U, R, { shadow, fpiv, feather });
  U.frame = new HeadFrame(THREE, fpiv);
  U.swing = new Swing(THREE, feather, { len: 6, stiff: 220, damping: 0.9, grav: 120 });
  U.swingPos = new THREE.Vector3();
  U.ex = new Expr(["smile", "browUp"]);
  U.rel = new Rel();
  U.tick = new Ticker();
  U.smileT = new Trigger({ on: 0.6, off: 0.3, hold: 0.1, cooldown: 1.2 });
  U.boing = new Spring(0, 140, 4);
  U.lift = new Spring(0, 160, 18);
  U.down = new THREE.Vector3(0, -1, 0);
  return g2;
}
function update(g2, bs, t, h) {
  const U = g2.userData, dt = U.tick.tick(t);
  const v = U.ex.update(bs, dt, h);
  const up = U.rel.update(v.browUp, dt, U.ex.ready);
  if (U.smileT.update(v.smile, dt)) U.boing.v += 9;
  const boing = U.boing.step(dt, 0), lift = U.lift.step(dt, up * 0.55);
  U.pivot.position.y = U.y0 + lift;
  U.shadow.material.uniforms.uOp.value = clamp(1 - lift * 0.4);
  U.frame.update(dt);
  if (U.frame.attached) U.swing.step(dt, U.frame, U.down, U.swingPos);
  else U.swing.rest();
  U.feather.rotateZ(0.05 * Math.sin(t * 1.7) + boing * 0.12);
  U.feather.rotateX(boing * 0.05);
}
export {
  build as default,
  meta,
  update
};
