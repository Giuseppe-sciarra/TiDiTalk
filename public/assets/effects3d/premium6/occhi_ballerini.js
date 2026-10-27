// Tiditalk — effetto viso 3D "occhi_ballerini" (premium6). Codice originale, AGPL-3.0. GENERATO da _src/fx/occhi_ballerini.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

// lib/head.js
var HULL = { c: [0, 2.4, -4], r: [8.1, 11.6, 9.9] };
function depthOnly(THREE, { side = THREE.DoubleSide } = {}) {
  return new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side });
}

// lib/glasses.js
var EYE = { cx: 3.12, cy: 2.62, z: 5.55, wrap: 0.075 };
function frameZ(x, z0 = EYE.z, wrap = EYE.wrap) {
  return z0 - wrap * x * x;
}
function outline(fn, n = 64) {
  const P = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = fn(i / n);
    P.push([x, y]);
  }
  return P;
}
function toFrame(THREE, x, y, side, out, { cx = EYE.cx, cy = EYE.cy, z0 = EYE.z, wrap = EYE.wrap } = {}) {
  const X = side * (cx + x);
  return out.set(X, cy + y, frameZ(X, z0, wrap));
}
function templeGeo(THREE, side, { hinge = [6.75, 3.15, 4.55], r = 0.13, sx = 1, sy = 2.2, drop = true } = {}) {
  const V = THREE.Vector3, s = side;
  const pts = [new V(s * hinge[0], hinge[1], hinge[2]), new V(s * (hinge[0] + 0.5), hinge[1] - 0.12, hinge[2] - 1.5)];
  for (const [x, y, z] of [[7.48, 3.05, -1.1], [7.6, 2.8, -3]]) if (z < hinge[2] - 2.2) pts.push(new V(s * Math.max(x, hinge[0] + 0.6), y, z));
  if (drop) pts.push(new V(s * 7.55, 1.6, -4.4), new V(s * 7.4, 0.4, -4.9));
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const geo = new THREE.TubeGeometry(curve, 48, r, 8, false);
  const p = geo.attributes.position, c = new V(), q = new V();
  for (let i = 0; i <= 48; i++) {
    curve.getPointAt(i / 48, c);
    for (let j = 0; j <= 8; j++) {
      const k = i * 9 + j;
      q.fromBufferAttribute(p, k).sub(c);
      q.y *= sy;
      q.x *= sx;
      p.setXYZ(k, c.x + q.x, c.y + q.y, c.z + q.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
function backOccluder(THREE, { zMax = -0.9, inset = 0.15 } = {}) {
  const geo = new THREE.SphereGeometry(1, 36, 24);
  const p = geo.attributes.position;
  const c = HULL.c, R = HULL.r, zc = (zMax - c[2]) / (R[2] - inset);
  for (let i = 0; i < p.count; i++) if (p.getZ(i) > zc) p.setZ(i, zc);
  const m = new THREE.Mesh(geo, depthOnly(THREE, { side: THREE.FrontSide }));
  m.scale.set(R[0] - inset, R[1] - inset, R[2] - inset);
  m.position.set(...c);
  m.renderOrder = -1;
  return m;
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

// lib/mats.js
function plastic(THREE, color, o = {}) {
  return new THREE.MeshPhysicalMaterial(Object.assign({ color: new THREE.Color(color), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.8, transparent: true }, o));
}
function glass(THREE, tint = 16777215, o = {}) {
  const m = new THREE.MeshPhysicalMaterial(Object.assign({ color: new THREE.Color(tint), roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.18, envMapIntensity: 1.6, depthWrite: false, specularIntensity: 1, ior: 1.5 }, o));
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>\n{ float fr = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.0); gl_FragColor.a = clamp(gl_FragColor.a + fr * 0.55, 0.0, 1.0); }");
  };
  m.customProgramCacheKey = () => "p6glass";
  return m;
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

// fx/occhi_ballerini.js
var meta = { label: "Occhiali con occhi ballerini", labelEn: "Googly-eye glasses", labelFr: "Lunettes \xE0 yeux rigolos", labelDe: "Wackelaugen-Brille", category: "divertenti", icon: "\u{1F440}" };
var OPTS = { cx: 3.3, cy: 2.65, z0: 6.2, wrap: 0.06 };
var RE = 2.25;
var RP = 1;
async function build(THREE, h) {
  const g2 = new THREE.Group();
  g2.name = "occhi_ballerini";
  const red = plastic(THREE, 12592172, { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
  const white = new THREE.MeshPhysicalMaterial({ color: 15921128, roughness: 0.55, clearcoat: 0.3, transparent: true });
  const blackM = new THREE.MeshPhysicalMaterial({ color: 855312, roughness: 0.35, clearcoat: 0.6, transparent: true });
  const dome = glass(THREE, 16777215, { opacity: 0.12 });
  const U = g2.userData;
  U.eyes = [];
  const ringP = outline((t) => [Math.cos(t * Math.PI * 2) * (RE + 0.22), Math.sin(t * Math.PI * 2) * (RE + 0.22)], 64);
  for (const side of [-1, 1]) {
    const c = toFrame(THREE, 0, 0, side, new THREE.Vector3(), OPTS);
    const eye = new THREE.Group();
    eye.position.copy(c);
    eye.rotation.y = side * 0.2;
    g2.add(eye);
    const torus = new THREE.Mesh(new THREE.TorusGeometry(RE + 0.22, 0.32, 14, 64), red);
    torus.scale.z = 1.25;
    eye.add(torus);
    const back = new THREE.Mesh(new THREE.CircleGeometry(RE + 0.05, 48), white);
    back.position.z = -0.05;
    eye.add(back);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(RP, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), blackM);
    pupil.rotation.x = Math.PI / 2;
    pupil.scale.set(1, 0.18, 1);
    pupil.position.z = 0.02;
    eye.add(pupil);
    const glint = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), new THREE.MeshBasicMaterial({ color: 16777215, transparent: true, opacity: 0.85 }));
    glint.position.set(-0.3, 0.35, 0.22);
    pupil.add(glint);
    glint.rotation.x = -Math.PI / 2;
    const dm = new THREE.Mesh(new THREE.SphereGeometry(RE + 0.05, 32, 12, 0, Math.PI * 2, 0, 0.55), dome);
    dm.rotation.x = Math.PI / 2;
    dm.position.z = -(RE + 0.05) * Math.cos(0.55) + 0.05;
    dm.renderOrder = 4;
    eye.add(dm);
    U.eyes.push({ eye, pupil, side, p: new THREE.Vector2(0, -0.8), v: new THREE.Vector2(0, 0) });
  }
  const V = THREE.Vector3;
  const br = new THREE.CatmullRomCurve3([toFrame(THREE, -RE - 0.2, 0.55, -1, new V(), OPTS), new V(-0.6, 3.55, OPTS.z0 - 0.05), new V(0, 3.68, OPTS.z0), new V(0.6, 3.55, OPTS.z0 - 0.05), toFrame(THREE, -RE - 0.2, 0.55, 1, new V(), OPTS)]);
  g2.add(new THREE.Mesh(new THREE.TubeGeometry(br, 20, 0.26, 10, false), red));
  for (const side of [-1, 1]) {
    const hx = 5.85, hz = frameZ(hx, OPTS.z0, OPTS.wrap) - 0.2;
    g2.add(new THREE.Mesh(templeGeo(THREE, side, { hinge: [hx, 2.95, hz], r: 0.16, sy: 1.8 }), red));
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), red);
    m.scale.set(0.5, 1.1, 0.8);
    m.position.set(side * 0.95, 2.72, 5.2);
    g2.add(m);
  }
  g2.add(backOccluder(THREE));
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.ex = new Expr(["eyesClosed", "jaw"]);
  U.lastBlink = 0;
  U.pv = new THREE.Vector3();
  U.acc = new THREE.Vector3();
  U.gl = new THREE.Vector3();
  U.q = new THREE.Quaternion();
  U.lastJaw = 0;
  U.init = false;
  return g2;
}
function update(g2, bs, t, h) {
  const U = g2.userData, dt = U.tick.tick(t);
  const v = U.ex.update(bs, dt, h);
  U.frame.update(dt);
  if (U.init && dt > 0) {
    U.acc.subVectors(U.frame.vel, U.pv).divideScalar(dt);
  } else U.acc.set(0, 0, 0);
  U.pv.copy(U.frame.vel);
  U.init = true;
  const jawKick = (v.jaw - U.lastJaw) / Math.max(dt, 1e-3);
  U.lastJaw = v.jaw;
  const blinkKick = Math.max(0, v.eyesClosed - U.lastBlink) / Math.max(dt, 1e-3);
  U.lastBlink = v.eyesClosed;
  const gx = ((bs.eyeLookOutRight || 0) - (bs.eyeLookInRight || 0) + (bs.eyeLookInLeft || 0) - (bs.eyeLookOutLeft || 0)) * 0.5;
  const gy = ((bs.eyeLookUpLeft || 0) + (bs.eyeLookUpRight || 0) - (bs.eyeLookDownLeft || 0) - (bs.eyeLookDownRight || 0)) * 0.5;
  const LIM = RE - RP - 0.06;
  for (let k = 0; k < U.eyes.length; k++) {
    const E = U.eyes[k];
    U.q.copy(U.frame.q).multiply(E.eye.quaternion).invert();
    U.gl.set(0, -980, 0).addScaledVector(U.acc, -0.6).applyQuaternion(U.q);
    let ax = U.gl.x * 0.012, ay = U.gl.y * 0.012;
    ay += clamp2(jawKick, -6, 6) * (k ? 9 : 11) * Math.sign(Math.sin(t * 13 + k));
    if (blinkKick > 3) {
      E.v.y += 9 + 4 * k;
      E.v.x += k ? -3 : 3;
    }
    ax += gx * 40;
    ay += gy * 40;
    const sub = 3, hh = dt / sub;
    for (let s = 0; s < sub; s++) {
      E.v.x += ax * hh;
      E.v.y += ay * hh;
      E.v.multiplyScalar(Math.exp(-1.8 * hh));
      E.p.x += E.v.x * hh;
      E.p.y += E.v.y * hh;
      const L = E.p.length();
      if (L > LIM) {
        const nx = E.p.x / L, ny = E.p.y / L;
        E.p.x = nx * LIM;
        E.p.y = ny * LIM;
        const vn = E.v.x * nx + E.v.y * ny;
        if (vn > 0) {
          E.v.x -= 1.45 * vn * nx;
          E.v.y -= 1.45 * vn * ny;
          E.v.multiplyScalar(0.9);
        }
      }
    }
    E.pupil.position.x = E.p.x;
    E.pupil.position.y = E.p.y;
  }
}
export {
  build as default,
  meta,
  update
};
