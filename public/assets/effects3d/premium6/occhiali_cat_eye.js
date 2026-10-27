// Tiditalk — effetto viso 3D "occhiali_cat_eye" (premium6). Codice originale, AGPL-3.0. GENERATO da _src/fx/occhiali_cat_eye.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

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
function splineOutline(THREE, ctrl, n = 72) {
  const c = new THREE.CatmullRomCurve3(ctrl.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, "centripetal");
  const P = [];
  for (let i = 0; i < n; i++) {
    const p = c.getPointAt(i / n);
    P.push([p.x, p.y]);
  }
  return P;
}
function toFrame(THREE, x, y, side, out, { cx = EYE.cx, cy = EYE.cy, z0 = EYE.z, wrap = EYE.wrap } = {}) {
  const X = side * (cx + x);
  return out.set(X, cy + y, frameZ(X, z0, wrap));
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
function acetateFront(THREE, outer2, inner2, side, { depth = 0.45, bevel = 0.12, opts = {} } = {}) {
  outer2 = ccw(outer2);
  inner2 = ccw(inner2);
  const sh = new THREE.Shape(outer2.map(([x, y]) => new THREE.Vector2(x, y)));
  sh.holes.push(new THREE.Path(inner2.slice().reverse().map(([x, y]) => new THREE.Vector2(x, y))));
  const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    toFrame(THREE, x, y, side, v, opts);
    p.setXYZ(i, v.x, v.y, v.z + z - depth * 0.5);
  }
  if (side < 0) {
    const ix = geo.index ? geo.index.array : null;
    if (ix) for (let i = 0; i < ix.length; i += 3) {
      const t = ix[i + 1];
      ix[i + 1] = ix[i + 2];
      ix[i + 2] = t;
    }
  }
  geo.computeVertexNormals();
  return geo;
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
function metal(THREE, color = 13936202, o = {}) {
  return new THREE.MeshPhysicalMaterial(Object.assign({ color: new THREE.Color(color), metalness: 1, roughness: 0.22, envMapIntensity: 1.2, transparent: true }, o));
}
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
  const grid = Math.ceil(Math.sqrt(names.length)) || 1, cs = size / grid;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  const cell = {};
  names.forEach((n, i) => {
    const cx = i % grid * cs, cy = Math.floor(i / grid) * cs;
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
  return { tex, grid, cell, canvas: c };
}

// fx/occhiali_cat_eye.js
var __s0 = { "x": void 0, "y": void 0, "z": void 0, "life": void 0, "size": void 0, "size1": void 0, "r": void 0, "g": void 0, "b": void 0, "a": void 0, "rot": void 0, "spin": void 0, "cell": void 0, "fadeIn": void 0, "fadeOut": void 0 };
var meta = { label: "Occhiali cat-eye retr\xF2", labelEn: "Retro cat-eye glasses", labelFr: "Lunettes \u0153il-de-chat r\xE9tro", labelDe: "Retro-Cat-Eye-Brille", category: "accessori", icon: "\u{1F453}" };
var OPTS = { cx: 3.35, cy: 2.55, z0: 5.85, wrap: 0.068 };
async function build(THREE, h) {
  const g2 = new THREE.Group();
  g2.name = "occhiali_cat_eye";
  const outer = splineOutline(THREE, [[-2.6, 1.42], [-0.9, 1.72], [0.9, 1.86], [2.35, 2.2], [3.2, 2.5], [3.3, 1.9], [2.95, 0.9], [2.6, -0.2], [1.95, -1.15], [0.95, -1.72], [-0.35, -1.9], [-1.6, -1.65], [-2.42, -0.95], [-2.78, 0.1], [-2.78, 0.9]], 90);
  const inner = splineOutline(THREE, [[-2.2, 1.06], [-0.8, 1.3], [0.9, 1.38], [2.1, 1.38], [2.5, 0.9], [2.32, -0.1], [1.8, -0.92], [0.9, -1.38], [-0.3, -1.52], [-1.42, -1.33], [-2.13, -0.72], [-2.4, 0.1], [-2.38, 0.7]], 80);
  const black = plastic(THREE, 986123, { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.35 });
  const gold = metal(THREE, 13806946, { roughness: 0.2 });
  const lensM = glass(THREE, 15397631, { opacity: 0.05, envMapIntensity: 0.7 });
  const gems = [];
  const gemM = new THREE.MeshPhysicalMaterial({ color: 16777215, metalness: 0, roughness: 0.02, transmission: 0, clearcoat: 1, envMapIntensity: 2.4, iridescence: 1, iridescenceIOR: 1.8, transparent: true });
  for (const side of [-1, 1]) {
    g2.add(new THREE.Mesh(acetateFront(THREE, outer, inner, side, { depth: 0.42, bevel: 0.12, opts: OPTS }), black));
    const L = new THREE.Mesh(lensGeo(THREE, inner, side, { bulge: 0.2, opts: OPTS }), lensM);
    L.renderOrder = 3;
    g2.add(L);
    const hz = frameZ(6.45, OPTS.z0, OPTS.wrap);
    const tg = templeGeo(THREE, side, { hinge: [6.45, 3.55, hz - 0.15], r: 0.16, sy: 2 });
    g2.add(new THREE.Mesh(tg, black));
    const V = THREE.Vector3;
    const wing = new THREE.CatmullRomCurve3([[0.9, 1.72], [2, 1.98], [2.85, 2.3]].map(([x, y]) => toFrame(THREE, x, y, side, new V(), OPTS).add(new V(0, 0, 0.3))));
    g2.add(new THREE.Mesh(new THREE.TubeGeometry(wing, 20, 0.055, 6, false), gold));
    for (const [x, y, r] of [[2.2, 1.78, 0.13], [2.65, 1.95, 0.15], [3.02, 2.12, 0.12]]) {
      const p = toFrame(THREE, x, y, side, new V(), OPTS);
      p.z += 0.32;
      const gm = new THREE.Mesh(new THREE.OctahedronGeometry(r, 1), gemM);
      gm.position.copy(p);
      gm.scale.z = 0.6;
      g2.add(gm);
      gems.push(gm);
    }
  }
  {
    const V = THREE.Vector3, z = OPTS.z0 + 0.05;
    const br = new THREE.CatmullRomCurve3([toFrame(THREE, -2.65, 1.05, -1, new V(), OPTS), new V(-0.7, 3.45, z), new V(0, 3.62, z + 0.05), new V(0.7, 3.45, z), toFrame(THREE, -2.65, 1.05, 1, new V(), OPTS)]);
    const geo = new THREE.TubeGeometry(br, 24, 0.24, 10, false);
    g2.add(new THREE.Mesh(geo, black));
  }
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), black);
    m.scale.set(0.5, 1.1, 0.8);
    m.position.set(s * 0.95, 2.7, 5.15);
    g2.add(m);
  }
  g2.add(backOccluder(THREE));
  const U = g2.userData;
  U.gems = gems;
  U.ex = new Expr(["smile"]);
  U.tick = new Ticker();
  U.trig = new Trigger({ on: 0.55, off: 0.3, hold: 0.08, cooldown: 0.5 });
  U.frame = new HeadFrame(THREE, g2);
  U.atlas = makeAtlas(THREE, ["spark", "glow"]);
  U.sp = new Sprites(THREE, { max: 40, atlas: U.atlas, blend: "add", renderOrder: 6 });
  g2.add(U.sp.mesh);
  U.tw = 0;
  U.next = 0;
  U.k = 0;
  U.v = new THREE.Vector3();
  U.down = new THREE.Vector3(0, 0, 0);
  return g2;
}
function update(g2, bs, t, h) {
  const U = g2.userData, dt = U.tick.tick(t);
  const v = U.ex.update(bs, dt, h);
  U.trig.update(v.smile, dt);
  if (U.trig.fired) U.tw = 2.2;
  if (U.trig.active) U.tw = Math.max(U.tw, 0.4);
  U.tw = Math.max(0, U.tw - dt);
  U.next -= dt;
  if (U.next <= 0) {
    const n = U.gems.length, gm = U.gems[Math.floor(Math.random() * n)];
    U.next = U.tw > 0 ? 0.09 + Math.random() * 0.1 : 2.5 + Math.random() * 3;
    U.sp.spawn((__s0["x"] = gm.position.x, __s0["y"] = gm.position.y, __s0["z"] = gm.position.z + 0.1, __s0["life"] = U.tw > 0 ? 0.55 : 0.4, __s0["size"] = U.tw > 0 ? 1.5 : 0.9, __s0["size1"] = 0.2, __s0["r"] = 1, __s0["g"] = 0.95, __s0["b"] = 0.85, __s0["a"] = 1, __s0["rot"] = Math.random() * 3, __s0["spin"] = 2, __s0["cell"] = U.atlas.cell.spark, __s0["fadeIn"] = 0.15, __s0["fadeOut"] = 0.6, __s0));
  }
  U.sp.update(dt, U.down);
}
export {
  build as default,
  meta,
  update
};
