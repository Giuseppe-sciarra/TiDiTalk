// Tiditalk — effetto viso 3D "berretto_nordico" (premium6). Codice originale, AGPL-3.0. GENERATO da _src/fx/berretto_nordico.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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

// lib/fur.js
var VS_HEAD = `
#ifdef USE_FLEN
attribute float flen;
#endif
uniform float uOff; uniform float uLen; uniform vec3 uBend; varying vec3 vBase; varying float vH;
`;
var FS_HEAD = `
uniform float uOff; uniform float uFreq; uniform float uDens; uniform vec3 uRoot; uniform vec3 uTip; uniform float uClump; uniform float uVC; uniform float uRootK; varying vec3 vBase; varying float vH;
float h31(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
`;
function furMesh(THREE, geo, { color = 15327958, tip = null, len = 0.6, shells = 10, freq = 18, dens = 0.75, rough = 0.9, clump = 0.35, baseMat = null, renderOrder = 2, vertexColors = false, rootK = 0.55, flen = false } = {}) {
  const group = new THREE.Group();
  const root = new THREE.Color(color).multiplyScalar(0.55), tipC = new THREE.Color(tip ?? color);
  const bend = new THREE.Vector3();
  const base = new THREE.Mesh(geo, baseMat || new THREE.MeshStandardMaterial({ color: new THREE.Color(vertexColors ? tip ?? color : color).multiplyScalar(0.62), roughness: 1, transparent: true, vertexColors }));
  group.add(base);
  const mats = [];
  for (let s = 1; s <= shells; s++) {
    const f = s / shells;
    const m = new THREE.MeshStandardMaterial({ color: vertexColors ? tipC : 16777215, roughness: rough, transparent: true, depthWrite: false, envMapIntensity: 0.5, vertexColors });
    const U = { uOff: { value: f }, uLen: { value: len }, uBend: { value: bend }, uFreq: { value: freq }, uDens: { value: dens }, uRoot: { value: root }, uTip: { value: tipC }, uClump: { value: clump }, uVC: { value: vertexColors ? 1 : 0 }, uRootK: { value: rootK } };
    if (flen) m.defines = { USE_FLEN: "" };
    m.onBeforeCompile = (sh2) => {
      Object.assign(sh2.uniforms, U);
      sh2.vertexShader = VS_HEAD + sh2.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
          vBase = position; vH = uOff;
          float fl = 1.0;
          #ifdef USE_FLEN
          fl = flen;
          #endif
          transformed += normalize(objectNormal) * uOff * uLen * fl + uBend * (uOff * uOff) * uLen * fl;`);
      sh2.fragmentShader = FS_HEAD + sh2.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
          vec3 q = vBase * uFreq; vec3 cell = floor(q); vec3 fr = fract(q) - 0.5;
          float r = h31(cell), r2 = h31(cell + 17.3);
          // ciocca: i peli di una cella si assottigliano verso la punta (cono), alcuni pi\xF9 corti
          float lenK = mix(0.55, 1.0, r2);
          float rad = mix(0.62, 0.12, clamp(vH / lenK, 0.0, 1.0));
          float d = length(fr) * 1.1;
          float strand = step(1.0 - uDens, r) * step(vH, lenK) * (1.0 - smoothstep(rad * 0.45, rad, d));
          float a = mix(strand, max(strand, 1.0 - vH * 2.2), uClump * (1.0 - vH));
          if (a < 0.08) discard;
          vec3 cc = uVC > 0.5 ? diffuseColor.rgb * mix(uRootK, 1.0, smoothstep(0.0, 0.9, vH)) : mix(uRoot, uTip, smoothstep(0.0, 0.9, vH));
          diffuseColor.rgb = cc * (0.82 + 0.3 * r);
          diffuseColor.a *= a;`);
    };
    m.customProgramCacheKey = () => "p6fur" + (flen ? "L" : "");
    const sh = new THREE.Mesh(geo, m);
    sh.renderOrder = renderOrder + s * 0.01;
    group.add(sh);
    mats.push(m);
  }
  return { group, base, mats, bend, setBend(v) {
    bend.copy(v);
  } };
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

// fx/berretto_nordico.js
var meta = { label: "Berretto nordico col pon-pon", labelEn: "Nordic pom-pom beanie", labelFr: "Bonnet nordique \xE0 pompon", labelDe: "Norweger-Bommelm\xFCtze", category: "accessori", icon: "\u{1F9F6}" };
var RED = "#8c1d25";
var NAVY = "#1b2645";
var WHITE = "#e9e2d6";
function jacquard(THREE) {
  const SW = 128, SH = 64, P = 4, c = canvas(SW * P, SH * P), x = c.getContext("2d");
  const star = ["...#...", "..###..", ".#.#.#.", "#######", ".#.#.#.", "..###..", "...#..."];
  const col = (i, r) => {
    if (r < 15) return RED;
    if (r === 15 || r === 16) return i % 2 === 0 ? WHITE : RED;
    if (r >= 17 && r <= 18) return NAVY;
    if (r >= 19 && r <= 25) {
      const m = star[r - 19], k = i % 16 - 4;
      return k >= 0 && k < 7 && m[k] === "#" ? WHITE : NAVY;
    }
    if (r >= 26 && r <= 27) return NAVY;
    if (r === 28 || r === 29) return i % 2 === 1 ? WHITE : RED;
    if (r >= 30 && r <= 34) {
      const z = Math.abs((i + (r - 30)) % 8 - 4);
      return z === 2 ? WHITE : RED;
    }
    return r % 6 === 1 && (i + (r % 12 === 1 ? 2 : 0)) % 4 === 0 ? WHITE : RED;
  };
  for (let r = 0; r < SH; r++) for (let i = 0; i < SW; i++) {
    const X = i * P, Y = (SH - 1 - r) * P;
    x.fillStyle = col(i, r);
    x.fillRect(X, Y, P, P);
    x.fillStyle = "rgba(0,0,0,0.16)";
    x.fillRect(X + P / 2 - 0.5, Y, 1, P);
    x.fillRect(X, Y + P - 1, P, 1);
  }
  return texFrom(THREE, c, { wrap: true });
}
async function build(THREE, h) {
  const g2 = new THREE.Group();
  g2.name = "berretto_nordico";
  const ring = bandRing(THREE, { yF: 7.5, yB: 3.2, n: 112, gap: (p) => 0.4 + 0.45 * (1 - Math.pow(Math.cos(p) * 0.5 + 0.5, 3)), lift: (p) => -0.9 * Math.pow(Math.sin(p), 2) });
  const R = hatRig(THREE, g2, ring), hat = R.hat;
  const profile = [[1, 0], [1.03, 2], [1.035, 3.6], [0.99, 5.6], [0.9, 7.6], [0.75, 9.3], [0.53, 10.6], [0.27, 11.3], [0, 11.45]];
  const dent = (i, r, hh, lx, lf, phi, v) => {
    const back = Math.max(0, -Math.cos(phi));
    return [1.1 * back * smooth(0.35, 0.8, v) * (1 - smooth(0.85, 1, v)), -0.9 * back * smooth(0.55, 1, v)];
  };
  const cr = crown(THREE, ring, profile, { nv: 30, dent });
  const map = jacquard(THREE);
  map.repeat.set(1, 1);
  map.offset.set(0, 0);
  const nrm = knitNormal(THREE, [64, 36], 3.2);
  const knit = new THREE.MeshStandardMaterial({ map, normalMap: nrm, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.96, envMapIntensity: 0.4, transparent: true });
  {
    const pos = cr.geo.attributes.position, n = ring.n, col = new Float32Array(pos.count * 3);
    for (let j = 0; j <= cr.nv; j++) for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i, v = j / cr.nv;
      const s = clamp(0.8 + 0.2 * smooth(0.05, 0.3, v) - 0.06 * Math.sin(ring.phi[i % n] * 5 + v * 7) * smooth(0.5, 0.9, v));
      col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = s;
    }
    cr.geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    knit.vertexColors = true;
  }
  hat.add(new THREE.Mesh(cr.geo, knit));
  hat.add(new THREE.Mesh(cr.geo, lining(THREE, 3806230)));
  {
    const n = ring.n, A = ring.axis, C = ring.C, D = [];
    for (let i = 0; i <= n; i++) D.push(ring.P[i].clone().sub(C).projectOnPlane(A).normalize());
    const sec = [];
    const H = 4.4, T = 0.95;
    for (let k = 0; k <= 6; k++) {
      const a = -Math.PI / 2 + k / 6 * Math.PI / 2;
      sec.push([T * 0.5 + Math.cos(a) * T * 0.5, (Math.sin(a) + 1) * 0.5]);
    }
    for (let k = 1; k <= 8; k++) sec.push([T, 0.5 + k / 8 * (H - 1)]);
    for (let k = 1; k <= 6; k++) {
      const a = k / 6 * Math.PI;
      sec.push([T * 0.5 + Math.cos(a) * T * 0.5, H - 0.5 + Math.sin(a) * 0.5]);
    }
    const geo = grid(THREE, n, sec.length - 1, (i, j, o) => {
      const [dr, hh] = sec[j];
      o.copy(ring.P[i]).addScaledVector(D[i], dr - 0.15).addScaledVector(A, hh - 0.2);
    }, { uRep: 1, flip: true });
    const H2 = heightField(64, 8, (u) => Math.pow(Math.abs(Math.sin(u * Math.PI * 2)), 0.6));
    const ribN = normalFromHeight(THREE, H2, 64, 8, 3, [56, 1]);
    const ribC = canvas(4, 4);
    {
      const x = ribC.getContext("2d");
      x.fillStyle = RED;
      x.fillRect(0, 0, 4, 4);
    }
    const cuff = new THREE.MeshStandardMaterial({ color: 16777215, map: texFrom(THREE, ribC), normalMap: ribN, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.95, envMapIntensity: 0.4, transparent: true });
    const m = new THREE.Mesh(geo, cuff);
    m.geometry.computeVertexNormals();
    hat.add(m);
  }
  const top = cr.pt(Math.round(ring.n / 2), cr.nv, new THREE.Vector3());
  const pp = new THREE.Group();
  pp.position.copy(top).addScaledVector(ring.axis, -0.2);
  pp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ring.axis);
  hat.add(pp);
  const pom = new THREE.Group();
  pp.add(pom);
  const sg = new THREE.SphereGeometry(2.9, 28, 20);
  const fur = furMesh(THREE, sg, { color: 13221805, tip: 15327958, len: 0.95, shells: 13, freq: 10, dens: 0.96, clump: 0.9 });
  fur.group.position.y = 3.1;
  pom.add(fur.group);
  g2.add(fillerCap(THREE, ring));
  const shadow = faceShadow(THREE, h, (x, y, z) => smooth(5.8, 7.6, y) * smooth(-1, 3, z) * 0.35, { lift: 0.2 });
  g2.add(shadow);
  const U = g2.userData;
  Object.assign(U, R, { shadow, pp, pom, fur });
  U.frame = new HeadFrame(THREE, pp);
  U.swing = new Swing(THREE, pom, { len: 3.2, stiff: 420, damping: 0.86, grav: 160 });
  U.zero = new THREE.Vector3();
  U.down = new THREE.Vector3(0, -1, 0);
  U.bend = new THREE.Vector3();
  U.tmpq = new THREE.Quaternion();
  U.ex = new Expr(["smile", "browUp"]);
  U.rel = new Rel();
  U.tick = new Ticker();
  U.smileT = new Trigger({ on: 0.58, off: 0.3, hold: 0.1, cooldown: 0.9 });
  U.hop = new Spring(0, 220, 7);
  U.lift = new Spring(0, 160, 18);
  return g2;
}
function update(g2, bs, t, h) {
  const U = g2.userData, dt = U.tick.tick(t);
  const v = U.ex.update(bs, dt, h);
  const up = U.rel.update(v.browUp, dt, U.ex.ready);
  if (U.smileT.update(v.smile, dt)) U.hop.v += 30;
  const hop = U.hop.step(dt, 0), lift = U.lift.step(dt, up * 0.5);
  U.pivot.position.y = U.y0 + lift;
  U.shadow.material.uniforms.uOp.value = clamp(1 - lift * 0.5);
  U.frame.update(dt);
  U.swing.step(dt, U.frame, U.down, U.zero);
  const sq = Math.max(-0.6, Math.min(1.4, hop * 0.18));
  U.fur.group.position.y = 3.1 + Math.max(0, hop) * 0.35;
  U.fur.group.scale.set(1 - sq * 0.08, 1 + sq * 0.12, 1 - sq * 0.08);
  U.tmpq.copy(U.frame.q).multiply(U.pom.quaternion).invert();
  U.bend.copy(U.down).applyQuaternion(U.tmpq).multiplyScalar(0.25);
  U.fur.setBend(U.bend);
}
export {
  build as default,
  meta,
  update
};
