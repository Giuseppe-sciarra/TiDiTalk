// Tiditalk — effetto viso 3D "berretto_sonaglio" (premium6). Codice originale, AGPL-3.0. GENERATO da _src/fx/berretto_sonaglio.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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

// lib/mats.js
function lining(THREE, color = 1906451) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.BackSide, envMapIntensity: 0.25, transparent: true });
}
function metal(THREE, color = 13936202, o = {}) {
  return new THREE.MeshPhysicalMaterial(Object.assign({ color: new THREE.Color(color), metalness: 1, roughness: 0.22, envMapIntensity: 1.2, transparent: true }, o));
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
    this.mat.atlasTex = atlas.tex;
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
  const grid2 = Math.ceil(Math.sqrt(names.length)) || 1, cs = size / grid2;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  const cell = {};
  names.forEach((n, i) => {
    const cx = i % grid2 * cs, cy = Math.floor(i / grid2) * cs;
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
  return { tex, grid: grid2, cell, canvas: c };
}

// fx/berretto_sonaglio.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "vx": void 0, "vy": void 0, "vz": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "rot": void 0, "spin": void 0, "cell": void 0, "drag": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var meta = { label: "Berretto natalizio col sonaglio", labelEn: "Christmas stocking cap with bell", labelFr: "Bonnet de No\xEBl \xE0 grelot", labelDe: "Weihnachtszipfelm\xFCtze mit Gl\xF6ckchen", category: "costumi", icon: "\u{1F514}" };
var RED = "#9a1d27";
var CREAM = "#e0d6c4";
var M = 11;
var SEG = 1.75;
function stripes(THREE, n) {
  const c = canvas(64, 256), x = c.getContext("2d");
  for (let i = 0; i < n; i++) {
    x.fillStyle = i % 2 ? CREAM : RED;
    x.fillRect(0, Math.floor(i * 256 / n), 64, Math.ceil(256 / n) + 1);
  }
  for (let y = 0; y < 256; y += 4) for (let xx = 0; xx < 64; xx += 4) {
    x.fillStyle = "rgba(0,0,0,0.12)";
    x.fillRect(xx + 2, y, 1, 4);
    x.fillRect(xx, y + 3, 4, 1);
  }
  return texFrom(THREE, c, { wrap: true });
}
async function build(THREE, h) {
  const g2 = new THREE.Group();
  g2.name = "berretto_sonaglio";
  const ring = bandRing(THREE, { yF: 7.6, yB: 3.4, n: 112, gap: (p) => 0.4 + 0.45 * (1 - Math.pow(Math.cos(p) * 0.5 + 0.5, 3)), lift: (p) => -0.8 * Math.pow(Math.sin(p), 2) });
  const R = hatRig(THREE, g2, ring), hat = R.hat;
  const profile = [[1, 0], [1.03, 2], [1.03, 3.8], [0.97, 5.8], [0.86, 7.8], [0.68, 9.6], [0.45, 10.9], [0.24, 11.7], [0, 12]];
  const cr = crown(THREE, ring, profile, { nv: 28 });
  const nrm = knitNormal(THREE, [56, 26], 3);
  const map = stripes(THREE, 6);
  map.repeat.set(1, 1);
  const knit = new THREE.MeshStandardMaterial({ map, normalMap: nrm, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.96, envMapIntensity: 0.4, transparent: true });
  hat.add(new THREE.Mesh(cr.geo, knit));
  hat.add(new THREE.Mesh(cr.geo, lining(THREE, 3806230)));
  {
    const n = ring.n, A = ring.axis, C = ring.C, D = [];
    for (let i = 0; i <= n; i++) D.push(ring.P[i].clone().sub(C).projectOnPlane(A).normalize());
    const sec = [], Hh = 4, T = 1;
    for (let k = 0; k <= 6; k++) {
      const a = -Math.PI / 2 + k / 6 * Math.PI / 2;
      sec.push([T * 0.5 + Math.cos(a) * T * 0.5, (Math.sin(a) + 1) * 0.5]);
    }
    for (let k = 1; k <= 8; k++) sec.push([T, 0.5 + k / 8 * (Hh - 1)]);
    for (let k = 1; k <= 6; k++) {
      const a = k / 6 * Math.PI;
      sec.push([T * 0.5 + Math.cos(a) * T * 0.5, Hh - 0.5 + Math.sin(a) * 0.5]);
    }
    const geo = grid(THREE, n, sec.length - 1, (i, j, o) => {
      const [dr, hh] = sec[j];
      o.copy(ring.P[i]).addScaledVector(D[i], dr - 0.15).addScaledVector(A, hh - 0.2);
    }, { uRep: 1, flip: true });
    const H2 = heightField(64, 8, (u) => Math.pow(Math.abs(Math.sin(u * Math.PI * 2)), 0.6));
    const cuff = new THREE.MeshStandardMaterial({ color: new THREE.Color(CREAM), normalMap: normalFromHeight(THREE, H2, 64, 8, 3, [56, 1]), normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.97, envMapIntensity: 0.4, transparent: true });
    hat.add(new THREE.Mesh(geo, cuff));
  }
  const tip = cr.pt(Math.round(ring.n / 2), cr.nv, new THREE.Vector3());
  const base = tip.clone().addScaledVector(ring.axis, -1.2);
  const tube = new DynTube(THREE, M, 14, { r: (t) => 2.6 * Math.pow(1 - t, 1.15) + 0.35, uRepeat: 1 });
  const tmap = stripes(THREE, 8);
  tmap.repeat.set(1, 1);
  const tknit = new THREE.MeshStandardMaterial({ map: tmap, normalMap: nrm, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.96, envMapIntensity: 0.4, transparent: true });
  const tailMesh = new THREE.Mesh(tube.geo, tknit);
  tailMesh.frustumCulled = false;
  hat.add(tailMesh);
  const bell = new THREE.Group();
  hat.add(bell);
  const bm = metal(THREE, 13935422, { roughness: 0.16 });
  const bs = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), bm);
  bs.position.y = -1;
  bell.add(bs);
  const slot = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 6, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 2759176, roughness: 0.6, transparent: true }));
  slot.position.set(0, -1.45, 0.62);
  slot.rotation.x = -0.35;
  bell.add(slot);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.09, 8, 28), bm);
  band.position.y = -1;
  band.rotation.x = Math.PI / 2;
  bell.add(band);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 6, 14), bm);
  loop.position.y = -0.05;
  bell.add(loop);
  g2.add(fillerCap(THREE, ring));
  const shadow = faceShadow(THREE, h, (x, y, z) => smooth(5.8, 7.6, y) * smooth(-1, 3, z) * 0.3, { lift: 0.2 });
  g2.add(shadow);
  const U = g2.userData;
  Object.assign(U, R, { tube, bell, base: base.clone(), axis: ring.axis.clone().add(new THREE.Vector3(0.95, 0.15, 0.1)).normalize() });
  U.frame = new HeadFrame(THREE, hat);
  {
    const t0 = base.clone(), pts = [t0, t0.clone().add(new THREE.Vector3(2.6, 1.6, 1.2)), t0.clone().add(new THREE.Vector3(5.6, 1.2, 2.6)), t0.clone().add(new THREE.Vector3(8.6, -1.4, 3.6)), t0.clone().add(new THREE.Vector3(10.2, -5, 4)), t0.clone().add(new THREE.Vector3(10.8, -9.5, 4))];
    const c = new THREE.CatmullRomCurve3(pts);
    U.restPts = new Float32Array(M * 3);
    const L0 = c.getLength();
    for (let i = 0; i < M; i++) {
      const q = c.getPointAt(Math.min(1, i * SEG / L0));
      U.restPts[i * 3] = q.x;
      U.restPts[i * 3 + 1] = q.y;
      U.restPts[i * 3 + 2] = q.z;
    }
  }
  U.p = new Float32Array(M * 3);
  U.q = new Float32Array(M * 3);
  U.loc = new Float32Array(M * 3);
  U.init = false;
  U.rest = new THREE.Vector3(0.85, -0.35, 0.1).normalize();
  U.tick = new Ticker();
  U.ex = new Expr(["smile"]);
  U.trig = new Trigger({ on: 0.58, off: 0.3, hold: 0.08, cooldown: 0.8 });
  U.atlas = makeAtlas(THREE, ["star", "spark"]);
  U.sp = new Sprites(THREE, { max: 30, atlas: U.atlas, blend: "add", renderOrder: 6 });
  hat.add(U.sp.mesh);
  U.ring = new Spring(0, 500, 4);
  U.upRef = [1, 0, 0];
  U.kd = new THREE.Vector3();
  U.v = new THREE.Vector3();
  U.w = new THREE.Vector3();
  U.c = new THREE.Vector3();
  U.d = new THREE.Vector3();
  U.hc = new THREE.Vector3();
  U.Y = new THREE.Vector3(0, -1, 0);
  U.zero = new THREE.Vector3();
  return g2;
}
function update(g2, bs, t, h) {
  const U = g2.userData, dt = U.tick.tick(t);
  const v = U.ex.update(bs, dt, h);
  U.frame.update(dt);
  const kick = U.trig.update(v.smile, dt);
  const P = U.p, Q = U.q, L = U.loc;
  U.frame.toWorld(U.base, U.c);
  U.frame.dirToWorld(U.axis, U.d);
  if (!U.init || !(dt > 0)) {
    for (let i = 0; i < M; i++) {
      U.v.set(U.restPts[i * 3], U.restPts[i * 3 + 1], U.restPts[i * 3 + 2]);
      U.frame.toWorld(U.v, U.w);
      P[i * 3] = Q[i * 3] = U.w.x;
      P[i * 3 + 1] = Q[i * 3 + 1] = U.w.y;
      P[i * 3 + 2] = Q[i * 3 + 2] = U.w.z;
    }
    U.init = true;
  }
  U.v.set(HULL.c[0], HULL.c[1], HULL.c[2]);
  U.frame.toWorld(U.v, U.hc);
  if (kick) {
    U.v.set(0.7, 0.55, 0.45);
    U.frame.dirToWorld(U.v, U.kd);
  }
  const sub = 3, hh = Math.min(dt, 0.05) / sub, damp = 0.985;
  for (let s = 0; s < sub; s++) {
    for (let i = 1; i < M; i++) {
      const k = i * 3;
      let vx = (P[k] - Q[k]) * damp, vy = (P[k + 1] - Q[k + 1]) * damp, vz = (P[k + 2] - Q[k + 2]) * damp;
      Q[k] = P[k];
      Q[k + 1] = P[k + 1];
      Q[k + 2] = P[k + 2];
      if (kick && s === 0) {
        const kk = 0.32 * (i / M);
        vx += U.kd.x * kk;
        vy += U.kd.y * kk;
        vz += U.kd.z * kk;
      }
      P[k] += vx;
      P[k + 1] += vy - 980 * 0.55 * hh * hh;
      P[k + 2] += vz;
      U.v.set(U.restPts[k], U.restPts[k + 1], U.restPts[k + 2]);
      U.frame.toWorld(U.v, U.w);
      const kr = 0.05;
      P[k] += (U.w.x - P[k]) * kr;
      P[k + 1] += (U.w.y - P[k + 1]) * kr;
      P[k + 2] += (U.w.z - P[k + 2]) * kr;
    }
    P[0] = U.c.x;
    P[1] = U.c.y;
    P[2] = U.c.z;
    P[3] = U.c.x + U.d.x * SEG;
    P[4] = U.c.y + U.d.y * SEG;
    P[5] = U.c.z + U.d.z * SEG;
    for (let it = 0; it < 3; it++) {
      for (let i = 2; i < M; i++) {
        const a = (i - 1) * 3, b = i * 3;
        const pa = (i - 2) * 3, ex = 2 * P[a] - P[pa], ey = 2 * P[a + 1] - P[pa + 1], ez = 2 * P[a + 2] - P[pa + 2], kk = it === 0 ? 0.05 * Math.pow(1 - i / M, 1.5) : 0;
        P[b] += (ex - P[b]) * kk;
        P[b + 1] += (ey - P[b + 1]) * kk;
        P[b + 2] += (ez - P[b + 2]) * kk;
        let dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, f = SEG / d;
        P[b] = P[a] + dx * f;
        P[b + 1] = P[a + 1] + dy * f;
        P[b + 2] = P[a + 2] + dz * f;
        let rx = P[b] - U.hc.x, ry = P[b + 1] - U.hc.y, rz = P[b + 2] - U.hc.z;
        U.v.set(rx, ry, rz);
        U.frame.dirToLocal(U.v, U.w);
        const e2 = (U.w.x / (HULL.r[0] + 3)) ** 2 + (U.w.y / (HULL.r[1] + 3)) ** 2 + (U.w.z / (HULL.r[2] + 3)) ** 2;
        if (e2 < 1) {
          const sc = 1 / Math.sqrt(e2);
          P[b] = U.hc.x + rx * sc;
          P[b + 1] = U.hc.y + ry * sc;
          P[b + 2] = U.hc.z + rz * sc;
        }
      }
    }
  }
  for (let i = 0; i < M; i++) {
    U.v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    U.frame.toLocal(U.v, U.w);
    L[i * 3] = U.w.x;
    L[i * 3 + 1] = U.w.y;
    L[i * 3 + 2] = U.w.z;
  }
  U.tube.update(L, U.upRef);
  const e = (M - 1) * 3, pe = (M - 2) * 3;
  U.bell.position.set(L[e], L[e + 1], L[e + 2]);
  U.v.set(L[e] - L[pe], L[e + 1] - L[pe + 1], L[e + 2] - L[pe + 2]).normalize();
  U.w.copy(U.v).lerp(U.Y, 0.6).normalize();
  U.bell.quaternion.setFromUnitVectors(U.Y, U.w);
  if (kick) U.ring.v += 40;
  const r = U.ring.step(dt, 0);
  U.bell.rotateZ(r * 0.03);
  if (kick) for (let k = 0; k < 6; k++) U.sp.spawn((__s0["x"] = L[e] + (Math.random() - 0.5) * 2, __s0["y"] = L[e + 1] + (Math.random() - 0.5) * 2, __s0["z"] = L[e + 2] + 1, __s0["vx"] = (Math.random() - 0.5) * 8, __s0["vy"] = 4 + Math.random() * 6, __s0["vz"] = 2, __s0["life"] = 0.8, __s0["size"] = 1.2, __s0["size1"] = 0.2, __s0["r"] = 1, __s0["g"] = 0.9, __s0["b"] = 0.5, __s0["a"] = 1, __s0["rot"] = Math.random() * 3, __s0["spin"] = 3, __s0["cell"] = k % 2 ? U.atlas.cell.star : U.atlas.cell.spark, __s0["drag"] = 2, __s0["fadeIn"] = 0.05, __s0["fadeOut"] = 0.5, __s0));
  U.sp.update(dt, U.zero);
}
export {
  build as default,
  meta,
  update
};
