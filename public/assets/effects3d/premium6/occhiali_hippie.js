// Tiditalk — effetto viso 3D "occhiali_hippie" (premium6). Codice originale, AGPL-3.0. GENERATO da _src/fx/occhiali_hippie.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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
function rimTube(THREE, pts2, side, { r = 0.12, sx = 1, sy = 1, opts = {} } = {}) {
  const V = THREE.Vector3, P = pts2.map(([x, y]) => toFrame(THREE, x, y, side, new V(), opts));
  const curve = new THREE.CatmullRomCurve3(P, true, "centripetal");
  const geo = new THREE.TubeGeometry(curve, Math.max(64, pts2.length * 2), r, 10, true);
  if (sx !== 1 || sy !== 1) {
  }
  return geo;
}
var ccw = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a > 0 ? pts : pts.slice().reverse();
};
function lensGeo(THREE, pts2, side, { bulge = 0.25, rings = 8, shrink = 0, opts = {} } = {}) {
  pts2 = ccw(pts2);
  const n = pts2.length, pos = [], uv = [], idx = [];
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (const [x, y] of pts2) {
    minx = Math.min(minx, x);
    maxx = Math.max(maxx, x);
    miny = Math.min(miny, y);
    maxy = Math.max(maxy, y);
  }
  const v = new THREE.Vector3();
  pos.push(...toFrame(THREE, 0, 0, side, v, opts).toArray());
  pos[2] += bulge;
  uv.push(0.5, 0.5);
  for (let r = 1; r <= rings; r++) {
    const k = r / rings * (1 - shrink);
    for (let i = 0; i < n; i++) {
      const [x, y] = pts2[i];
      toFrame(THREE, x * k, y * k, side, v, opts);
      v.z += bulge * (1 - k * k);
      pos.push(v.x, v.y, v.z);
      uv.push((x * k - minx) / (maxx - minx), (y * k - miny) / (maxy - miny));
    }
  }
  for (let i = 0; i < n; i++) idx.push(0, 1 + i, 1 + (i + 1) % n);
  for (let r = 1; r < rings; r++) for (let i = 0; i < n; i++) {
    const a = 1 + (r - 1) * n + i, b = 1 + (r - 1) * n + (i + 1) % n, c = a + n, d = b + n;
    idx.push(a, c, b, b, c, d);
  }
  if (side < 0) for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = t;
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g2.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g2.setIndex(idx);
  g2.computeVertexNormals();
  return g2;
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
function nosePads(THREE, mat, { y = 2.75, x = 0.95, z = 5 } = {}) {
  const g2 = new THREE.Group();
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), mat);
    m.scale.set(0.45, 1, 0.75);
    m.position.set(s * x, y, z);
    m.rotation.z = s * 0.35;
    g2.add(m);
  }
  return g2;
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

// lib/mats.js
function metal(THREE, color = 13936202, o = {}) {
  return new THREE.MeshPhysicalMaterial(Object.assign({ color: new THREE.Color(color), metalness: 1, roughness: 0.22, envMapIntensity: 1.2, transparent: true }, o));
}
function glass(THREE, tint = 16777215, o = {}) {
  const m = new THREE.MeshPhysicalMaterial(Object.assign({ color: new THREE.Color(tint), roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.18, envMapIntensity: 1.6, depthWrite: false, specularIntensity: 1, ior: 1.5 }, o));
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>\n{ float fr = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.0); gl_FragColor.a = clamp(gl_FragColor.a + fr * 0.55, 0.0, 1.0); }");
  };
  m.customProgramCacheKey = () => "p6glass";
  return m;
}
function tintLens(THREE, { col0 = "#f0a24a", col1 = "#c8467a", alpha = 0.55, rim = 0.35 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uC0: { value: new THREE.Color(col0) }, uC1: { value: new THREE.Color(col1) }, uA: { value: alpha }, uRim: { value: rim }, uHue: { value: 0 }, uMix: { value: 0 }, uPhase: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uC0, uC1; uniform float uA, uRim, uHue, uMix, uPhase; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      vec3 hue(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca); }
      void main(){
        vec3 N = normalize(vN), V = normalize(vV); if (dot(N, V) < 0.0) N = -N;
        vec3 c = mix(uC0, uC1, smoothstep(0.05, 0.95, vUv.y));
        // caleidoscopio (uMix): anelli di colore che girano
        float r = length(vUv - 0.5);
        vec3 k = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + r * 2.2 - uPhase * 0.35));
        c = clamp(hue(c, uHue), 0.0, 1.0);
        c = mix(c, k, uMix * 0.85);
        float fr = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
        vec3 R = reflect(-V, N);
        float win = smoothstep(0.82, 0.97, dot(R, normalize(vec3(0.3, 0.6, 0.75)))) * 0.55;
        gl_FragColor = vec4(c + win + fr * 0.25, clamp(uA + fr * uRim + win * 0.6, 0.0, 1.0));
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false
  });
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

// fx/occhiali_hippie.js
var meta = { label: "Occhiali hippie", labelEn: "Hippie round shades", labelFr: "Lunettes hippie", labelDe: "Hippie-Brille", category: "accessori", icon: "\u262E\uFE0F" };
var OPTS = { cx: 3.3, cy: 2.6, z0: 5.85, wrap: 0.07 };
async function build(THREE, h) {
  const g2 = new THREE.Group();
  g2.name = "occhiali_hippie";
  const R = 2.28;
  const P2 = outline((t) => [Math.cos(t * Math.PI * 2) * R, Math.sin(t * Math.PI * 2) * R], 72);
  const gold = metal(THREE, 12884562, { roughness: 0.28 });
  const lensM = tintLens(THREE, { col0: "#f0a03c", col1: "#cf3f7c", alpha: 0.5, rim: 0.4 });
  const lenses = [];
  for (const side of [-1, 1]) {
    g2.add(new THREE.Mesh(rimTube(THREE, P2, side, { r: 0.08, opts: OPTS }), gold));
    const L = new THREE.Mesh(lensGeo(THREE, P2, side, { bulge: 0.22, opts: OPTS }), lensM);
    L.renderOrder = 3;
    g2.add(L);
    lenses.push(L);
    const hz = frameZ(5.55, OPTS.z0, OPTS.wrap);
    g2.add(new THREE.Mesh(templeGeo(THREE, side, { hinge: [5.62, 2.85, hz - 0.05], r: 0.07, sy: 1.2 }), gold));
    const c = new THREE.CatmullRomCurve3([toFrame(THREE, R * 0.97, 0.25, side, new THREE.Vector3(), OPTS), new THREE.Vector3(side * 5.62, 2.85, hz - 0.05)]);
    g2.add(new THREE.Mesh(new THREE.TubeGeometry(c, 6, 0.075, 6, false), gold));
    const arm = new THREE.CatmullRomCurve3([toFrame(THREE, -R * 0.8, 0.9, side, new THREE.Vector3(), OPTS), new THREE.Vector3(side * 0.95, 2.95, 5.45), new THREE.Vector3(side * 0.88, 2.55, 5.2)]);
    g2.add(new THREE.Mesh(new THREE.TubeGeometry(arm, 10, 0.04, 6, false), gold));
  }
  {
    const V = THREE.Vector3;
    const br = new THREE.CatmullRomCurve3([toFrame(THREE, -R * 0.94, 0.75, -1, new V(), OPTS), new V(-0.55, 3.75, OPTS.z0 + 0.05), new V(0, 3.9, OPTS.z0 + 0.08), new V(0.55, 3.75, OPTS.z0 + 0.05), toFrame(THREE, -R * 0.94, 0.75, 1, new V(), OPTS)]);
    g2.add(new THREE.Mesh(new THREE.TubeGeometry(br, 24, 0.085, 8, false), gold));
  }
  g2.add(nosePads(THREE, glass(THREE, 16777215, { opacity: 0.35 }), { y: 2.55, x: 0.86, z: 5.12 }));
  g2.add(backOccluder(THREE));
  const U = g2.userData;
  U.mat = lensM;
  U.ex = new Expr(["smile"]);
  U.tick = new Ticker();
  U.trig = new Trigger({ on: 0.58, off: 0.3, hold: 0.1, cooldown: 1 });
  U.kal = new Spring(0, 30, 9);
  U.kalT = 0;
  U.hue = 0;
  return g2;
}
function update(g2, bs, t, h) {
  const U = g2.userData, dt = U.tick.tick(t);
  const v = U.ex.update(bs, dt, h);
  if (U.trig.update(v.smile, dt)) U.kalT = 3.2;
  if (U.trig.active) U.kalT = Math.max(U.kalT, 0.6);
  U.kalT = Math.max(0, U.kalT - dt);
  const k = U.kal.step(dt, U.kalT > 0 ? 1 : 0);
  U.hue += dt * 2.4 * Math.max(0.05, k);
  if (U.hue > 100) U.hue -= 100;
  const u = U.mat.uniforms;
  u.uMix.value = Math.max(0, Math.min(1, k));
  u.uPhase.value = U.hue;
  u.uHue.value = Math.sin(t * 0.25) * 0.15;
}
export {
  build as default,
  meta,
  update
};
