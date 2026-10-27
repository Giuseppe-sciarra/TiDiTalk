// Tiditalk — effetto viso 3D "maschera_sci_fronte" (premium6). Codice originale, AGPL-3.0. GENERATO da _src/fx/maschera_sci_fronte.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

// lib/head.js
var HULL = { c: [0, 2.4, -4], r: [8.1, 11.6, 9.9] };
var clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
var smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
function depthOnly(THREE, { side = THREE.DoubleSide } = {}) {
  return new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side });
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

// lib/mats.js
function plastic(THREE, color, o = {}) {
  return new THREE.MeshPhysicalMaterial(Object.assign({ color: new THREE.Color(color), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.8, transparent: true }, o));
}
function mirrorLens(THREE, { top = "#2c4e8a", hor = "#f2a35e", low = "#3a2a2a", tint = "#2a2f36", sun = 1, opacity = 0.97, rim = 0.35, sharp = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(top) }, uHor: { value: new THREE.Color(hor) }, uLow: { value: new THREE.Color(low) }, uTint: { value: new THREE.Color(tint) }, uSun: { value: sun }, uOp: { value: opacity }, uRim: { value: rim }, uShift: { value: 0 }, uSharp: { value: sharp } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uTop, uHor, uLow, uTint; uniform float uSun, uOp, uRim, uShift, uSharp; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main(){
        vec3 N = normalize(vN); vec3 V = normalize(vV); if (dot(N, V) < 0.0) N = -N;
        vec3 R = reflect(-V, N);
        float y = R.y + uShift;
        vec3 env = y > 0.0 ? mix(uHor, uTop, smoothstep(0.0, 0.75, y)) : mix(uHor, uLow, smoothstep(0.0, mix(0.35, 0.04, uSharp), -y));
        // paesaggio riflesso (uSharp): orizzonte netto, colline scure e qualche nuvola chiara
        float hill = 0.05 * sin(R.x * 9.0) + 0.03 * sin(R.x * 23.0 + 1.0);
        env = mix(env, uLow * 0.8, uSharp * smoothstep(0.012, 0.0, y - hill - 0.02) * step(-0.25, y));
        float cl = smoothstep(0.55, 0.8, sin(R.x * 6.0 + y * 3.0) * 0.5 + 0.5) * smoothstep(0.1, 0.3, y) * (1.0 - smoothstep(0.5, 0.8, y));
        env = mix(env, vec3(0.95), uSharp * cl * 0.55);
        float sun = pow(max(dot(R, normalize(vec3(0.35, 0.55, 0.75))), 0.0), 90.0) * 3.0 + pow(max(dot(R, normalize(vec3(-0.4, 0.3, 0.8))), 0.0), 24.0) * 0.35;
        float fr = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
        vec3 col = mix(uTint, env, 0.62 + 0.3 * fr) + sun * uSun;
        gl_FragColor = vec4(col, clamp(uOp + fr * uRim, 0.0, 1.0));
        #include <colorspace_fragment>
      }`,
    transparent: true
  });
}

// lib/glasses.js
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

// fx/maschera_sci_fronte.js
var meta = { label: "Maschera da sci sulla fronte", labelEn: "Ski goggles on the forehead", labelFr: "Masque de ski sur le front", labelDe: "Skibrille auf der Stirn", category: "accessori", icon: "\u{1F3BF}" };
var AX = 8.4;
var AY = 4;
var WR = 10.5;
function lensXY(t) {
  const a = t * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), e = 3.4;
  let x = AX * Math.sign(c) * Math.pow(Math.abs(c), 2 / e), y = AY * Math.sign(s) * Math.pow(Math.abs(s), 2 / e);
  if (y < 0) y += 2.1 * Math.exp(-(x * x) / (2 * 1.5 * 1.5)) * smooth(0, -AY, y);
  return [x, y];
}
var curveZ = (x, y) => -(x * x) / (2 * WR) - y * y / (2 * 26);
async function build(THREE, h) {
  const g2 = new THREE.Group();
  g2.name = "maschera_sci_fronte";
  const gog = new THREE.Group();
  g2.add(gog);
  const NO = 96;
  const outl = [];
  for (let i = 0; i < NO; i++) outl.push(lensXY(i / NO));
  {
    const pos = [], uv = [], idx = [], R = 8;
    pos.push(0, 0, 0.35);
    uv.push(0.5, 0.5);
    for (let r = 1; r <= R; r++) {
      const k = r / R;
      for (const [x2, y] of outl) {
        pos.push(x2 * k, y * k, curveZ(x2 * k, y * k) + 0.35 * (1 - k * k));
        uv.push(0.5 + x2 * k / (2 * AX), 0.5 + y * k / (2 * AY));
      }
    }
    for (let i = 0; i < NO; i++) idx.push(0, 1 + i, 1 + (i + 1) % NO);
    for (let r = 1; r < R; r++) for (let i = 0; i < NO; i++) {
      const a = 1 + (r - 1) * NO + i, b = 1 + (r - 1) * NO + (i + 1) % NO;
      idx.push(a, a + NO, b, b, a + NO, b + NO);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const lens = new THREE.Mesh(geo, mirrorLens(THREE, { top: "#6a2ea6", hor: "#ff8a34", low: "#2a1636", tint: "#3b1d3c", opacity: 0.97, sharp: 0.6 }));
    lens.renderOrder = 3;
    gog.add(lens);
  }
  const V = THREE.Vector3;
  const rimPts = outl.map(([x2, y]) => new V(x2 * 1.04, y * 1.06, curveZ(x2, y) - 0.05));
  const rim = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 160, 0.55, 10, true);
  gog.add(new THREE.Mesh(rim, plastic(THREE, 1447706, { roughness: 0.55, clearcoat: 0.2 })));
  {
    const pos = [], idx = [], n2 = rimPts.length;
    for (let i = 0; i <= n2; i++) {
      const p = rimPts[i % n2];
      for (const d of [0, 1]) pos.push(p.x * (1 - 0.04 * d), p.y * (1 - 0.06 * d), p.z - 0.3 - 1.5 * d);
    }
    for (let i = 0; i < n2; i++) {
      const q = i * 2;
      idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    fg.setIndex(idx);
    fg.computeVertexNormals();
    gog.add(new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: 3816255, roughness: 1, side: THREE.DoubleSide, transparent: true })));
  }
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.4, 1.4), plastic(THREE, 1447706));
    c.position.set(s * (AX + 0.5), 0, curveZ(AX, 0) - 0.4);
    c.rotation.y = s * 0.75;
    gog.add(c);
  }
  const C = canvas(256, 32), x = C.getContext("2d");
  x.fillStyle = "#17181b";
  x.fillRect(0, 0, 256, 32);
  for (let i = 0; i < 256; i += 32) {
    x.fillStyle = "#1e8f8a";
    x.beginPath();
    x.moveTo(i, 4);
    x.lineTo(i + 16, 16);
    x.lineTo(i, 28);
    x.lineTo(i + 8, 28);
    x.lineTo(i + 24, 16);
    x.lineTo(i + 8, 4);
    x.closePath();
    x.fill();
  }
  x.fillStyle = "#e8e4dc";
  x.fillRect(0, 2, 256, 2);
  x.fillRect(0, 28, 256, 2);
  const smap = texFrom(THREE, C, { repeat: [10, 1] });
  const NS = 72;
  const ring = (Rz) => {
    const out = new Float32Array((NS + 1) * 2 * 3), z0 = curveZ(AX, 0) - 0.4;
    for (let i = 0; i <= NS; i++) {
      const a = Math.PI / 2 + i / NS * Math.PI;
      const xx = (AX + 0.55) * Math.sin(a) * (1 - 0.18 * Math.pow(Math.cos(a), 2)), zz = z0 + Rz * Math.cos(a);
      for (const [d, yy] of [[0, 1.9], [1, -1.9]]) {
        const k = (i * 2 + d) * 3;
        out[k] = xx;
        out[k + 1] = yy;
        out[k + 2] = zz;
      }
    }
    return out;
  };
  const RU = ring(15.5), RD = ring(18.5);
  const sg = new THREE.BufferGeometry();
  const sp = new THREE.BufferAttribute(RU.slice(), 3);
  sp.setUsage(THREE.DynamicDrawUsage);
  sg.setAttribute("position", sp);
  const suv = [];
  for (let i = 0; i <= NS; i++) suv.push(i / NS, 0, i / NS, 1);
  sg.setAttribute("uv", new THREE.Float32BufferAttribute(suv, 2));
  const sidx = [];
  for (let i = 0; i < NS; i++) {
    const q = i * 2;
    sidx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3);
  }
  sg.setIndex(sidx);
  sg.computeVertexNormals();
  sg.boundingSphere = new THREE.Sphere(new V(), 40);
  const strap = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ map: smap, roughness: 0.8, side: THREE.DoubleSide, transparent: true }));
  gog.add(strap);
  g2.add(backOccluder(THREE, { zMax: 1.5 }));
  const C0 = new V(...HULL.c), beta = 0.8;
  const n = new V(0, Math.cos(beta) / HULL.r[1], Math.sin(beta) / HULL.r[2]).normalize();
  const pUp = new V(0, HULL.c[1] + HULL.r[1] * Math.cos(beta), HULL.c[2] + HULL.r[2] * Math.sin(beta)).addScaledVector(n, 1.9 + 0.35);
  const rotUp = -Math.atan2(n.y, n.z);
  const pDn = new V(0, 3.05, 6.55);
  const U = g2.userData;
  Object.assign(U, {
    gog,
    sp,
    RU,
    RD,
    C0,
    rU: pUp.clone().sub(C0).length(),
    aU: Math.atan2(pUp.y - C0.y, pUp.z - C0.z),
    rD: pDn.clone().sub(C0).length(),
    aD: Math.atan2(pDn.y - C0.y, pDn.z - C0.z),
    rotUp,
    ex: new Expr(["browUp"]),
    rel: new Rel(),
    tick: new Ticker(),
    trig: new Trigger({ on: 0.6, off: 0.3, hold: 0.2, cooldown: 1.2 }),
    s: new Spring(0, 60, 11),
    target: 0
  });
  pose(U, 0);
  return g2;
}
function pose(U, s) {
  const k = clamp(s, -0.05, 1.05), r = U.rU + (U.rD - U.rU) * k, a = U.aU + (U.aD - U.aU) * k;
  U.gog.position.set(0, U.C0.y + Math.sin(a) * r, U.C0.z + Math.cos(a) * r);
  U.gog.rotation.x = U.rotUp * (1 - k);
  const P = U.sp.array, A = U.RU, B = U.RD, w = clamp(k);
  for (let i = 0; i < P.length; i++) P[i] = A[i] + (B[i] - A[i]) * w;
  U.sp.needsUpdate = true;
}
function update(g2, bs, t, h) {
  const U = g2.userData, dt = U.tick.tick(t);
  const v = U.ex.update(bs, dt, h);
  const up = U.rel.update(v.browUp, dt, U.ex.ready);
  if (U.trig.update(up, dt)) U.target = 1 - U.target;
  pose(U, U.s.step(dt, U.target));
}
export {
  build as default,
  meta,
  update
};
