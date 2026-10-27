// Tiditalk — effetto viso 3D "halloween_witch" (premium3). Codice originale, AGPL-3.0. GENERATO da _src/fx/halloween_witch.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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
function paintVerts(THREE, g2, fn) {
  const p = g2.attributes.position, n = g2.attributes.normal, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const c = fn(p.getX(i), p.getY(i), p.getZ(i), n ? n.getX(i) : 0, n ? n.getY(i) : 0, n ? n.getZ(i) : 0);
    a[i * 3] = c[0];
    a[i * 3 + 1] = c[1];
    a[i * 3 + 2] = c[2];
  }
  g2.setAttribute("color", new THREE.BufferAttribute(a, 3));
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

// fx/halloween_witch.js
var meta = { label: "Strega con pipistrelli", labelEn: "Witch hat & bats", labelFr: "Sorci\xE8re et chauves-souris", labelDe: "Hexenhut mit Flederm\xE4usen", category: "costumi", icon: "\u{1F987}" };
function brimGeo(THREE) {
  const prof = [[7, 0.35], [10, 0.22], [13.5, 0.25], [15.6, 0.55], [16.1, 0.85], [16.3, 0.62], [16, 0.3], [13.5, -0.05], [10, -0.08], [7, -0.05]];
  const g2 = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 96);
  const p = g2.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x), k = clamp((r - 8) / 8);
    p.setY(i, p.getY(i) + Math.sin(a * 5 + 0.7) * 0.75 * k * k + (z > 0 ? 0.9 * k * k * (z / r) : 0.5 * k * k * (-z / r)));
  }
  g2.computeVertexNormals();
  return g2;
}
function batGeo(THREE) {
  const w = new THREE.Shape();
  w.moveTo(0, 0.5);
  w.quadraticCurveTo(1.6, 1.6, 3.6, 1.3);
  w.quadraticCurveTo(4.6, 1.1, 5.2, 0.3);
  w.quadraticCurveTo(4.3, -0.1, 4.1, -0.9);
  w.quadraticCurveTo(3.4, -0.4, 2.7, -0.9);
  w.quadraticCurveTo(2, -0.3, 1.3, -0.8);
  w.quadraticCurveTo(0.8, -0.2, 0, -0.4);
  w.closePath();
  const wing = new THREE.ShapeGeometry(w, 6);
  const p = wing.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, -x * x * 0.03);
  }
  wing.computeVertexNormals();
  return wing;
}
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.expr = new Expr(["jaw"]);
  U.rnd = rng(91);
  const hat = new THREE.Group();
  hat.position.set(0, 11.6, -3.6);
  hat.rotation.set(-0.22, 0, 0.04);
  hat.scale.setScalar(0.94);
  g2.add(hat);
  U.hat = hat;
  const felt = new THREE.MeshStandardMaterial({ color: 2364986, roughness: 0.9, normalMap: feltNormal(THREE, 4, [8, 8], 3), normalScale: new THREE.Vector2(1, 1), side: THREE.DoubleSide, transparent: true });
  hat.add(new THREE.Mesh(brimGeo(THREE), felt));
  const spine = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 6.5, -0.4), new THREE.Vector3(0.4, 12.5, -1.4), new THREE.Vector3(2.2, 17.2, -1.4), new THREE.Vector3(5.2, 19.6, 0.4), new THREE.Vector3(6.6, 19.2, 1.6)]);
  const cone = taperTube(THREE, spine, { segs: 80, radial: 32, r: (t) => (7.3 * Math.pow(1 - t, 1.05) + 0.12) * (1 + 0.035 * Math.sin(t * 34) * t), capEnd: false });
  const dk = new THREE.Color(1313310), lt = new THREE.Color(3941462), tmp = new THREE.Color();
  paintVerts(THREE, cone, (x, y, z, nx, ny, nz) => {
    tmp.copy(dk).lerp(lt, clamp(0.5 + 0.5 * nx * 0.6 + ny * 0.3));
    return [tmp.r, tmp.g, tmp.b];
  });
  hat.add(new THREE.Mesh(cone, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, normalMap: felt.normalMap, side: THREE.DoubleSide, transparent: true })));
  const ringC = [];
  for (let i = 0; i <= 48; i++) {
    const a = i / 48 * Math.PI * 2;
    ringC.push(new THREE.Vector3(Math.cos(a) * 7, 1.3, Math.sin(a) * 7));
  }
  hat.add(new THREE.Mesh(taperTube(THREE, new THREE.CatmullRomCurve3(ringC, true), { segs: 96, radial: 6, r: () => 1, sx: 0.12, sy: 1.15 }), new THREE.MeshStandardMaterial({ color: 16742938, roughness: 0.45, transparent: true })));
  const bk = new THREE.Shape();
  bk.moveTo(-1.4, -1.4);
  bk.lineTo(1.4, -1.4);
  bk.lineTo(1.4, 1.4);
  bk.lineTo(-1.4, 1.4);
  bk.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-0.85, -0.85);
  hole.lineTo(-0.85, 0.85);
  hole.lineTo(0.85, 0.85);
  hole.lineTo(0.85, -0.85);
  hole.closePath();
  bk.holes.push(hole);
  const buckle = new THREE.Mesh(new THREE.ExtrudeGeometry(bk, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: 15254618, metalness: 1, roughness: 0.25, transparent: true }));
  buckle.position.set(0, 1.3, 7.05);
  hat.add(buckle);
  const wingGeo = batGeo(THREE);
  const membrane = new THREE.MeshStandardMaterial({ color: 1511708, roughness: 0.5, side: THREE.DoubleSide, transparent: true });
  const furM = new THREE.MeshStandardMaterial({ color: 1182997, roughness: 0.8, transparent: true });
  const eyeM = new THREE.MeshBasicMaterial({ color: 16765498 });
  const bodyG = merge(THREE, [
    new THREE.SphereGeometry(0.75, 14, 10).scale(1, 1.25, 0.9),
    new THREE.SphereGeometry(0.55, 12, 8).translate(0, 1.05, 0.15),
    new THREE.ConeGeometry(0.2, 0.6, 6).translate(-0.28, 1.6, 0.1),
    new THREE.ConeGeometry(0.2, 0.6, 6).translate(0.28, 1.6, 0.1)
  ]);
  U.bats = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group();
    b.add(new THREE.Mesh(bodyG, furM));
    for (const sx of [-0.2, 0.2]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), eyeM);
      e.position.set(sx, 1.12, 0.62);
      b.add(e);
    }
    const wl = new THREE.Group(), wr = new THREE.Group();
    const ml = new THREE.Mesh(wingGeo, membrane);
    ml.scale.x = -1;
    wl.add(ml);
    wr.add(new THREE.Mesh(wingGeo, membrane));
    wl.position.set(-0.4, 0.4, 0);
    wr.position.set(0.4, 0.4, 0);
    b.add(wl, wr);
    const s = 1.05 + U.rnd() * 0.45;
    b.scale.setScalar(s);
    g2.add(b);
    U.bats.push({ b, wl, wr, ph: i / 5 * Math.PI * 2 + U.rnd() * 0.5, rad: 15 + U.rnd() * 4, y: 17 + U.rnd() * 7, sp: 0.75 + U.rnd() * 0.35, fl: U.rnd() * 6 });
  }
  const spider = new THREE.Group();
  const black = new THREE.MeshPhysicalMaterial({ color: 1380890, roughness: 0.3, clearcoat: 1, transparent: true });
  spider.add(new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 14).scale(1, 1.15, 0.95), black));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), black);
  head.position.set(0, -1.05, 0.25);
  spider.add(head);
  for (const sx of [-0.22, 0.22]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 16777215 }));
    e.position.set(sx, -1, 0.72);
    spider.add(e);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: 0 }));
    pu.position.set(sx, -1.02, 0.85);
    spider.add(pu);
  }
  U.legs = [];
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.6, -0.5 + k * 0.25, 0);
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(sx * 1.3, 0.7, 0.1), new THREE.Vector3(sx * 2.3, -0.6 - k * 0.2, 0.2)]);
    leg.add(new THREE.Mesh(taperTube(THREE, c, { segs: 10, radial: 5, r: (t) => 0.13 - t * 0.06 }), black));
    leg.rotation.y = (k - 1.5) * 0.35 * sx;
    spider.add(leg);
    U.legs.push({ leg, ph: k * 1.3 + (sx > 0 ? 0.6 : 0) });
  }
  g2.add(spider);
  U.spider = spider;
  U.thread = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 4), new THREE.MeshBasicMaterial({ color: 14540253, transparent: true, opacity: 0.7 }));
  g2.add(U.thread);
  U.anchor = new THREE.Vector3(11.5, 10, 7.5);
  U.dangle = new Dangle(THREE, 6, { damping: 0.94, stiff: 15, grav: 980 });
  U.drop = new Spring(6, 25, 4);
  U.excite = 0;
  U.v = new THREE.Vector3();
  U.w = new THREE.Vector3();
  U.down = new THREE.Vector3(0, -1, 0);
  U.Y = new THREE.Vector3(0, 1, 0);
  U.q = new THREE.Quaternion();
  g2.add(hatOccluder(THREE));
  return g2;
}
function update(g2, bs, t, h) {
  const U = g2.userData;
  if (!U.frame) return;
  const dt = U.tick.tick(t);
  U.frame.update(dt);
  const e = U.expr.update(bs, dt, h);
  U.excite = damp(U.excite, e.jaw > 0.55 ? 1 : 0, 4, dt);
  const ex = U.excite;
  for (const B of U.bats) {
    B.ph += dt * B.sp * (1 + ex * 1.2);
    const a = B.ph, r = B.rad + Math.sin(t * 0.7 + B.fl) * 1.5 * (1 + ex);
    B.b.position.set(Math.cos(a) * r, B.y + Math.sin(t * 2.3 + B.fl) * 1.2 * (1 + ex), -3 + Math.sin(a) * r * 0.75);
    B.b.rotation.set(0.12, Math.cos(a) * 0.7, Math.sin(t * 3 + B.fl) * 0.15 - Math.cos(a) * 0.2);
    const f = Math.sin(t * (13 + ex * 6) + B.fl);
    B.wl.rotation.y = -f * 0.9;
    B.wr.rotation.y = f * 0.9;
    B.wl.rotation.z = f * 0.25;
    B.wr.rotation.z = -f * 0.25;
  }
  const base = 6 + 3.2 * (0.5 + 0.5 * Math.sin(t * 0.9)) + ex * 6;
  const len = Math.max(1, U.drop.step(dt, base));
  U.dangle.len = len;
  const aw = U.frame.toWorld(U.anchor, U.w);
  const dir = U.dangle.step(dt, aw, U.down, U.down);
  const dl = U.frame.dirToLocal(dir, U.v).normalize();
  U.spider.position.copy(U.anchor).addScaledVector(dl, len + 1.1);
  U.spider.rotation.set(0, Math.sin(t * 0.8) * 0.5, -dl.x * 0.8);
  U.thread.position.copy(U.anchor).addScaledVector(dl, len / 2);
  U.q.setFromUnitVectors(U.Y, dl);
  U.thread.quaternion.copy(U.q);
  U.thread.scale.set(1, len, 1);
  for (const L of U.legs) L.leg.rotation.z = Math.sin(t * 7 + L.ph) * 0.18 * (1 + ex);
}
export {
  build as default,
  meta,
  update
};
