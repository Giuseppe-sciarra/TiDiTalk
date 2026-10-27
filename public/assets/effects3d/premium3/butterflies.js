// Tiditalk — effetto viso 3D "butterflies" (premium3). Codice originale, AGPL-3.0. GENERATO da _src/fx/butterflies.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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

// lib/geo.js
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

// fx/butterflies.js
var meta = { label: "Farfalle", labelEn: "Butterflies", labelFr: "Papillons", labelDe: "Schmetterlinge", category: "divertenti", icon: "\u{1F98B}" };
var SPOTS = [[-4.5, 10.6, 1.5, 0.35], [4.8, 10.3, 1, -0.4], [-7.6, 6.8, 0.6, 1.1], [7.8, 7.2, -0.2, -1.2], [0.6, 11.4, -1.2, 0]];
var KINDS = [
  { base: "#f07b12", edge: "#1a120c", vein: "#1a120c", dots: "#ffffff", glow: "#ffb347" },
  // monarca
  { base: "#1f8fff", edge: "#0b1a3a", vein: "#0d2b6b", dots: "#bfe6ff", glow: "#7fd0ff" },
  // morfo
  { base: "#ff7ab8", edge: "#5a1440", vein: "#7a2058", dots: "#ffe0f0", glow: "#ffc0e0" },
  // rosa
  { base: "#ffe14a", edge: "#4a3a08", vein: "#6a5410", dots: "#fff7c0", glow: "#fff0a0" }
  // cedrina
];
function wingTex(THREE, K) {
  const W = 256, H = 256, c = canvas(W, H), x = c.getContext("2d");
  x.clearRect(0, 0, W, H);
  const fore = new Path2D();
  fore.moveTo(8, 120);
  fore.bezierCurveTo(40, 40, 150, 6, 238, 22);
  fore.bezierCurveTo(246, 60, 220, 104, 170, 128);
  fore.bezierCurveTo(110, 140, 50, 134, 8, 128);
  fore.closePath();
  const hind = new Path2D();
  hind.moveTo(8, 132);
  hind.bezierCurveTo(70, 132, 150, 150, 176, 196);
  hind.bezierCurveTo(186, 236, 130, 250, 92, 236);
  hind.bezierCurveTo(50, 222, 18, 178, 8, 140);
  hind.closePath();
  for (const P of [hind, fore]) {
    const gr = x.createRadialGradient(10, 128, 10, 10, 128, 240);
    gr.addColorStop(0, K.glow);
    gr.addColorStop(0.55, K.base);
    gr.addColorStop(1, K.base);
    x.fillStyle = gr;
    x.fill(P);
    x.save();
    x.clip(P);
    x.strokeStyle = K.vein;
    x.lineWidth = 3.2;
    x.globalAlpha = 0.85;
    for (let i = 0; i < 7; i++) {
      const a = -1.1 + i * 0.36;
      x.beginPath();
      x.moveTo(10, 128);
      x.quadraticCurveTo(10 + Math.cos(a) * 80, 128 + Math.sin(a) * 60, 10 + Math.cos(a) * 260, 128 + Math.sin(a) * 200);
      x.stroke();
    }
    x.globalAlpha = 1;
    x.lineWidth = 26;
    x.strokeStyle = K.edge;
    x.stroke(P);
    x.restore();
  }
  x.fillStyle = K.dots;
  const dots = [[226, 30], [212, 52], [196, 76], [176, 100], [150, 118], [165, 205], [140, 228], [110, 232], [190, 34], [176, 22]];
  for (const [a, b] of dots) {
    x.beginPath();
    x.arc(a, b, 4.2, 0, 6.3);
    x.fill();
  }
  return texFrom(THREE, c, { wrap: false });
}
function build(THREE, h) {
  const g2 = new THREE.Group();
  const U = g2.userData = {};
  U.frame = new HeadFrame(THREE, g2);
  U.tick = new Ticker();
  U.expr = new Expr(["jaw"]);
  U.rnd = rng(281);
  U.trig = new Trigger({ on: 0.55, off: 0.3, hold: 0.08, cooldown: 1.5 });
  const wingG = new THREE.PlaneGeometry(1, 1, 6, 6);
  wingG.translate(0.5, 0, 0);
  {
    const p = wingG.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, 0.06 * x * x);
    }
    wingG.computeVertexNormals();
  }
  const bodyG = smoothLathe(THREE, [[0, -1.5], [0.14, -1.3], [0.2, -0.6], [0.22, 0.2], [0.26, 0.55], [0.3, 0.9], [0.22, 1.15], [0, 1.25]], 10, 3);
  bodyG.rotateX(Math.PI / 2);
  const bodyM = new THREE.MeshStandardMaterial({ color: 2365972, roughness: 0.7, transparent: true });
  U.bf = [];
  for (let i = 0; i < 4; i++) {
    const K = KINDS[i], tex = wingTex(THREE, K);
    const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.35, roughness: 0.55, emissive: new THREE.Color(K.base), emissiveIntensity: 0.12, emissiveMap: tex });
    const root = new THREE.Group();
    g2.add(root);
    const body = new THREE.Mesh(bodyG, bodyM);
    root.add(body);
    for (const sx of [-1, 1]) {
      const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(sx * 0.08, 0.1, 1.15), new THREE.Vector3(sx * 0.25, 0.5, 1.7), new THREE.Vector3(sx * 0.55, 0.75, 2.1));
      root.add(new THREE.Mesh(new THREE.TubeGeometry(c, 8, 0.03, 4), bodyM));
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), bodyM);
      k.position.set(sx * 0.55, 0.75, 2.1);
      root.add(k);
    }
    const wings = [];
    for (const sx of [-1, 1]) {
      const hinge = new THREE.Group();
      root.add(hinge);
      const w = new THREE.Mesh(wingG, mat);
      w.scale.set(3.4 * sx, 3.4, 1);
      w.rotation.x = Math.PI / 2;
      hinge.add(w);
      wings.push(hinge);
    }
    root.scale.setScalar(1.45);
    U.bf.push({ root, wings, state: "fly", spot: -1, t: 0, ph: i * 1.9, sp: 0.55 + i * 0.07, pos: new THREE.Vector3(), from: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), flap: i, rest: 0, wait: 1.5 + i * 2.2, away: 0 });
  }
  U.taken = [false, false, false, false, false];
  U.v = new THREE.Vector3();
  U.w = new THREE.Vector3();
  U.m = new THREE.Matrix4();
  U.Y = new THREE.Vector3(0, 1, 0);
  U.q = new THREE.Quaternion();
  U.zero = new THREE.Vector3();
  U.qr = new THREE.Quaternion();
  U.eu = new THREE.Euler();
  U.flip = new THREE.Quaternion().setFromAxisAngle(U.Y, Math.PI);
  U.showcase = false;
  U.scatter = 0;
  U.prevYaw = null;
  return g2;
}
function flyPos(B, t, out) {
  const a = t * B.sp + B.ph;
  const R = 15 + 3 * Math.sin(a * 1.7 + B.ph);
  const y = 9 + 6 * Math.sin(a * 1.3) + 3 * Math.sin(a * 2.9 + 1);
  return out.set(Math.cos(a) * R, y + Math.max(0, Math.sin(a)) * 6, -3 + Math.sin(a) * R * 0.75);
}
function freeSpot(U) {
  const n = SPOTS.length, s = U.rnd() * n | 0;
  for (let k = 0; k < n; k++) {
    const i = (s + k) % n;
    if (!U.taken[i]) return i;
  }
  return -1;
}
function update(g2, bs, t, h) {
  const U = g2.userData;
  if (!U.frame) return;
  const dt = U.tick.tick(t);
  U.frame.update(dt);
  const e = U.expr.update(bs, dt, h);
  const shake = U.frame.attached && U.frame.vel.length() > 60;
  if (U.trig.update(e.jaw, dt) || shake) U.scatter = 3;
  const show = !U.frame.attached && !U.showcase;
  if (show) {
    U.showcase = true;
    const B0 = U.bf[0], B1 = U.bf[1];
    B0.state = "rest";
    B0.spot = 0;
    U.taken[0] = true;
    B0.wait = 99;
    B1.state = "rest";
    B1.spot = 3;
    U.taken[3] = true;
    B1.wait = 99;
  }
  U.scatter = Math.max(0, U.scatter - dt);
  for (let i = 0; i < U.bf.length; i++) {
    const B = U.bf[i];
    B.t += dt;
    B.wait -= dt;
    let flapSpeed = 18, open = 1;
    if (U.scatter > 0 && B.state !== "fly") {
      if (B.spot >= 0) U.taken[B.spot] = false;
      B.spot = -1;
      B.state = "fly";
      B.away = 1;
      B.wait = 3 + U.rnd() * 3;
    }
    if (B.state === "fly") {
      flyPos(B, t, U.v);
      if (B.away > 0) {
        B.away = Math.max(0, B.away - dt * 0.35);
        U.v.x *= 1 + B.away * 0.8;
        U.v.y += B.away * 10;
      }
      if (B.wait <= 0 && U.scatter <= 0) {
        const s = freeSpot(U);
        if (s >= 0) {
          B.spot = s;
          U.taken[s] = true;
          B.state = "land";
          B.t = 0;
          B.from.copy(B.pos);
        } else B.wait = 2;
      }
      flapSpeed = 20 + B.away * 10;
    } else if (B.state === "land") {
      const S = SPOTS[B.spot], k = clamp(B.t / 1.4), ease = k * k * (3 - 2 * k);
      U.v.set(S[0], S[1] + 0.3, S[2]).sub(B.from).multiplyScalar(ease).add(B.from);
      U.v.y += Math.sin(k * Math.PI) * 3;
      flapSpeed = 16 - k * 8;
      if (k >= 1) {
        B.state = "rest";
        B.t = 0;
        B.wait = 3.5 + U.rnd() * 4;
      }
    } else {
      const S = SPOTS[B.spot];
      U.v.set(S[0], S[1] + 0.3, S[2]);
      flapSpeed = 0;
      open = 0.5 + 0.5 * Math.sin(B.t * 1.6);
      if (B.wait <= 0) {
        U.taken[B.spot] = false;
        B.spot = -1;
        B.state = "fly";
        B.wait = 4 + U.rnd() * 4;
      }
    }
    U.w.subVectors(U.v, B.pos);
    if (U.w.lengthSq() > 1e-4) B.dir.lerp(U.w.normalize(), Math.min(1, dt * 6)).normalize();
    B.pos.copy(U.v);
    B.root.position.copy(B.pos);
    U.m.lookAt(U.zero, B.dir, U.Y);
    U.q.setFromRotationMatrix(U.m);
    U.q.multiply(U.flip);
    if (B.state !== "fly") {
      const S = SPOTS[B.spot];
      U.eu.set(-Math.PI / 2 + 0.3, 0, S[3] * 0.35);
      U.qr.setFromEuler(U.eu);
      const k = B.state === "rest" ? 1 : clamp(B.t / 1.4);
      U.q.slerp(U.qr, k * k * (3 - 2 * k));
    }
    B.root.quaternion.copy(U.q);
    B.flap += dt * flapSpeed;
    const a = flapSpeed > 0 ? 0.15 + 0.95 * (0.5 + 0.5 * Math.sin(B.flap)) : 0.25 + (1 - open) * 1.15;
    B.wings[0].rotation.z = -a;
    B.wings[1].rotation.z = a;
    if (flapSpeed > 0) B.root.position.y += Math.sin(B.flap) * 0.25;
  }
}
export {
  build as default,
  meta,
  update
};
