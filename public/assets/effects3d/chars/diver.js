// ───────────────────────────── kit comune (inlined in ogni personaggio) ─────────────────────────────
const PI = Math.PI;
const c01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const B = (bs, k) => { const v = bs ? bs[k] : 0; return (typeof v === 'number' && v === v) ? c01(v) : 0; };
function smooth(ud, key, target, k) { const p = ud[key]; const v = (p === undefined) ? target : p + (target - p) * k; ud[key] = v; return v; }
function M(h, color, opt) { return h.mat(color, Object.assign({ roughness: .7, metalness: 0 }, opt || {})); }
// materiale con sfumatura verticale (alto → basso) procedurale
function gradMat(THREE, h, top, bottom, opt) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, '#' + new THREE.Color(top).getHexString()); gr.addColorStop(1, '#' + new THREE.Color(bottom).getHexString());
  x.fillStyle = gr; x.fillRect(0, 0, 4, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return h.mat(0xffffff, Object.assign({ roughness: .7, metalness: 0, map: tex }, opt || {}));
}
function ell(THREE, mat, rx, ry, rz, x, y, z, seg) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, seg || 32, (seg || 32) * .75 | 0), mat);
  m.scale.set(rx, ry, rz); m.position.set(x || 0, y || 0, z || 0); return m;
}
function cap(THREE, mat, r, len, x, y, z, rx, ry, rz) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), mat);
  m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0); return m;
}
// superficie parametrica generica: fn(u,v) → [x,y,z], u,v ∈ [0,1]
function surf(THREE, nu, nv, fn, closeU) {
  const pos = [], idx = [], uv = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = fn(i / nu, j / nv); pos.push(p[0], p[1], p[2]); uv.push(i / nu, 1 - j / nv); }
  const W = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  if (closeU !== false) { // media delle normali sulla cucitura u=0/u=1
    const n = g.attributes.normal;
    for (let j = 0; j <= nv; j++) { const a = j * W, b = j * W + nu; const nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b); const l = Math.hypot(nx, ny, nz) || 1; n.setXYZ(a, nx / l, ny / l, nz / l); n.setXYZ(b, nx / l, ny / l, nz / l); }
  }
  return g;
}
// interpolazione Catmull-Rom su una lista di vettori [[..],[..]] con s ∈ [0,1]
function crom(pts, s) {
  const n = pts.length - 1; const f = c01(s) * n; let i = Math.floor(f); if (i >= n) i = n - 1; const t = f - i;
  const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n)];
  const out = [];
  for (let k = 0; k < p1.length; k++) {
    const a = p0[k], b = p1[k], c = p2[k], d = p3[k];
    out.push(0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t));
  }
  return out;
}
// corpo "ad anello" attorno alla finestra del viso: profilo [[fx, fy, z], ...] da bordo (s=0) a polo posteriore (s=1)
// bordo = ellisse rx×ry centrata (cx,cy); fx/fy moltiplicano i raggi. shape(a,s) opzionale modula il raggio.
function ringBody(THREE, o) {
  const prof = o.prof, rx = o.rx || 7.6, ry = o.ry || 9.2, cx = o.cx || 0, cy = o.cy === undefined ? -0.5 : o.cy;
  return surf(THREE, o.nu || 96, o.nv || 48, (u, v) => {
    const a = u * 2 * PI; const p = crom(prof, v); const k = o.shape ? o.shape(a, v) : 1;
    return [cx + rx * p[0] * k * Math.cos(a), cy + ry * p[1] * k * Math.sin(a), p[2] + (o.zoff ? o.zoff(a, v) : 0)];
  });
}
// solido di rotazione (asse Y) da profilo [[r, y], ...] smussato con Catmull-Rom
function lathe(THREE, mat, prof, o) {
  o = o || {}; const n = o.n || 40; const pts = [];
  for (let i = 0; i <= n; i++) { const p = crom(prof, i / n); pts.push(new THREE.Vector2(Math.max(p[0], 0), p[1])); }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, o.seg || 48), mat);
  if (o.sz) m.scale.z = o.sz; if (o.sx) m.scale.x = o.sx; if (o.pos) m.position.set(o.pos[0], o.pos[1], o.pos[2]);
  return m;
}
// cono/corno curvo lungo una curva
function horn(THREE, mat, pts, r0, r1, seg) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  const nu = seg || 10, nv = 10;
  return new THREE.Mesh(surf(THREE, nv, nu, (u, v) => {
    const p = curve.getPoint(v), tg = curve.getTangent(v); const r = r0 + (r1 - r0) * v;
    const a = new THREE.Vector3(0, 1, 0); if (Math.abs(tg.y) > .9) a.set(1, 0, 0);
    const n1 = new THREE.Vector3().crossVectors(tg, a).normalize(), n2 = new THREE.Vector3().crossVectors(tg, n1).normalize();
    const an = u * 2 * PI; return [p.x + r * (n1.x * Math.cos(an) + n2.x * Math.sin(an)), p.y + r * (n1.y * Math.cos(an) + n2.y * Math.sin(an)), p.z + r * (n1.z * Math.cos(an) + n2.z * Math.sin(an))];
  }), mat);
}
// gruppo radice. Per i personaggi a testa intera HEAD_FIT ingrandisce tutto attorno a un perno sotto il viso,
// così la testa cartoon copre anche i capelli veri (che sporgono 3–5 cm sopra il cranio): sommità y≈16.5, lati ±12.5.
const HEAD_FIT = { s: [1.14, 1.24, 1.14], p: [0, -6, 2] };
function mkRoot(THREE, g, fit) {
  const f = new THREE.Group(); g.add(f);
  if (fit) { const k = fit.s, q = fit.p; f.scale.set(k[0], k[1], k[2]); f.position.set(q[0] * (1 - k[0]), q[1] * (1 - k[1]), q[2] * (1 - k[2])); }
  const root = new THREE.Group(); f.add(root); g.userData.root = root; g.userData.fit = f; return root;
}
function reg(g) { if (!g.userData.P) g.userData.P = { eyes: [], brows: [], jaws: [], cavs: [], lips: [], tongues: [], cheeks: [], ears: [], fx: [] }; return g.userData.P; }
// occhio: sfera bianca + iride + pupilla + riflesso + palpebra superiore (emisfero che ruota) + palpebra inferiore
function mkEye(THREE, h, P, o) {
  const r = o.r || 2.2, side = o.side || 1;
  const e = new THREE.Group(); e.position.set(o.x || 0, o.y || 0, o.z || 0);
  const white = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), o.whiteMat || M(h, o.white === undefined ? 0xf3f0ea : o.white, { roughness: .22 }));
  e.add(white);
  const look = new THREE.Group(); e.add(look);
  const ir = r * (o.irisR === undefined ? .58 : o.irisR);
  if (o.iris !== null) {
    const iris = new THREE.Mesh(new THREE.SphereGeometry(ir, 24, 14), M(h, o.iris === undefined ? 0x4a7bd1 : o.iris, { roughness: .3 }));
    iris.scale.z = .2; iris.position.z = r * .82; look.add(iris);
  }
  const pr = r * (o.pupilR === undefined ? .3 : o.pupilR);
  if (o.pupil !== null) {
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(pr, 20, 12), M(h, o.pupil === undefined ? 0x14100f : o.pupil, { roughness: .25 }));
    pupil.scale.z = .25; pupil.position.z = r * .93; look.add(pupil);
  }
  if (o.hl !== false) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(Math.max(pr * .42, r * .1), 10, 8), M(h, 0xffffff, { roughness: .1, emissive: 0xffffff, emissiveIntensity: .5 }));
    hl.scale.z = .3; hl.position.set(-pr * .55, pr * .55, r * .99); look.add(hl);
  }
  const lr = r * 1.18;
  const lidMat = o.lidMat || M(h, o.lid || 0xcccccc);
  const open = o.open === undefined ? -0.75 : o.open, closed = PI / 2 + 0.12;
  const lid = new THREE.Mesh(new THREE.SphereGeometry(lr, 28, 12, 0, 2 * PI, 0, PI / 2 + 0.12), lidMat);
  lid.rotation.x = open; e.add(lid);
  if (o.lower !== false) {
    const lo = new THREE.Mesh(new THREE.SphereGeometry(lr, 28, 6, 0, PI, PI * (o.lowerAt || .7), PI * .18), lidMat);
    e.add(lo);
  }
  if (o.lashes) { // ciglia: piccoli coni sulla palpebra
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(r * .08, r * .5, 6), M(h, 0x222222)); const a = -0.5 + i * 0.5; l.position.set(Math.sin(a) * lr * .7 * side, lr * .72, lr * .55); l.rotation.set(-0.6, 0, -a * side); lid.add(l); }
  }
  e.rotation.y = (o.ry || 0); e.rotation.x = (o.rx || 0);
  P.eyes.push({ lid, look, side, open, closed, r, e });
  return e;
}
// sopracciglio: tubo ad arco, si alza/abbassa e ruota con i blendshape
function mkBrow(THREE, h, P, o) {
  const w = o.w || 3.2, th = o.th || .45, side = o.side || 1;
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-w / 2, 0, 0), new THREE.Vector3(0, o.arch === undefined ? .6 : o.arch, .25), new THREE.Vector3(w / 2, 0, 0));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, th, 10, false), o.mat || M(h, o.color || 0x333333));
  const c1 = new THREE.Mesh(new THREE.SphereGeometry(th, 10, 8), m.material); c1.position.x = -w / 2;
  const c2 = c1.clone(); c2.position.x = w / 2; m.add(c1, c2);
  const grp = new THREE.Group(); grp.add(m); grp.position.set(o.x || 0, o.y || 0, o.z || 0); grp.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
  if (o.scale) grp.scale.setScalar(o.scale);
  P.brows.push({ obj: grp, y: grp.position.y, rz: grp.rotation.z, side, k: o.k || 1 });
  return grp;
}
// mandibola: gruppo con pivot; i figli vanno aggiunti con jawAdd (coordinate mondo)
function mkJaw(THREE, P, o) {
  const j = new THREE.Group(); j.position.set(o.pivot[0], o.pivot[1], o.pivot[2]);
  P.jaws.push({ obj: j, max: o.max === undefined ? .5 : o.max, rx: 0 });
  j.userData.pivot = o.pivot; return j;
}
// guscio mandibola: spicchio inferiore-frontale dello stesso ellissoide della testa (leggermente più grande)
function jawShell(THREE, mat, c, r, o) {
  o = o || {}; const span = o.span || PI * .78, th0 = o.theta || .66;
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, PI / 2 - span / 2, span, PI * th0, PI * (1 - th0)), mat);
  const k = o.k || 1.025; m.scale.set(r[0] * k, r[1] * k, r[2] * k); m.position.set(c[0], c[1], c[2]); return m;
}
function jawAdd(j, m) { const p = j.userData.pivot; m.position.x -= p[0]; m.position.y -= p[1]; m.position.z -= p[2]; j.add(m); return m; }
// cavità della bocca (ellissoide scuro) che si apre in verticale con jawOpen
function mkCavity(THREE, h, P, o) {
  const m = ell(THREE, o.mat || M(h, o.color || 0x4a1a1e, { roughness: .6 }), o.rx || 3.4, o.ry || 2.2, o.rz || 2.5, o.x || 0, o.y || -5.5, o.z || 6.5, 24);
  const c = { obj: m, rx: o.rx || 3.4, ry: o.ry || 2.2, min: o.min === undefined ? .12 : o.min };
  c.follow = (o.follow || []).map(f => { f[0].userData.followed = true; return { obj: f[0], off: f[1] || 0, sx: f[0].scale.x }; });
  if (o.lip) c.follow.push({ obj: o.lip, off: o.lipOff || 0, sx: o.lip.scale.x, lip: true });
  P.cavs.push(c); return m;
}
// linea delle labbra: due metà (tubi) che ruotano agli angoli col sorriso
function mkSmile(THREE, h, P, o) {
  const w = o.w || 3.4, th = o.th || .32, mat = o.mat || M(h, o.color || 0x7a3a40);
  const grp = new THREE.Group(); grp.position.set(o.x || 0, o.y || -5.5, o.z || 8.6);
  for (const side of [1, -1]) {
    const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * w * .55, (o.droop || -.25), -.15), new THREE.Vector3(side * w, (o.tip || .15), -(o.back || .9)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 10, th, 8, false), mat);
    const tipS = new THREE.Mesh(new THREE.SphereGeometry(th, 8, 6), mat); tipS.position.copy(c.getPoint(1)); m.add(tipS);
    const half = new THREE.Group(); half.add(m); grp.add(half);
    P.lips.push({ obj: half, side, amp: o.amp || .5 });
  }
  return grp;
}
function mkTongue(THREE, h, P, o) {
  const m = ell(THREE, M(h, o.color || 0xe4607a, { roughness: .5 }), o.rx || 1.4, o.ry || .5, o.rz || 1.8, o.x || 0, o.y || -7, o.z || 7, 20);
  m.userData.tg = true; P.tongues.push({ obj: m, z: m.position.z, out: o.out || 2.4, y: m.position.y });
  return m;
}
function mkCheek(THREE, h, P, o) {
  const m = ell(THREE, M(h, o.color || 0xf08a9f, { roughness: .8 }), o.rx || 1.6, o.ry || 1.1, o.rz || .8, o.x, o.y, o.z, 16);
  m.rotation.y = (o.ry0 || 0); P.cheeks.push({ obj: m, s: [m.scale.x, m.scale.y, m.scale.z], puff: o.puff || .35 });
  return m;
}
function regEar(P, obj, o) { P.ears.push({ obj, rz: obj.rotation.z, rx: obj.rotation.x, amp: (o && o.amp) || 1, phase: (o && o.phase) || 0, up: (o && o.up) || 0 }); return obj; }
// ── finestra sul viso vero: bordo che segue l'ovale del viso (landmark FACE_OVAL della mesh canonica) ──
// Un anello a z costante davanti al viso si sposta rispetto al viso per la prospettiva (viso fuori centro, ovale
// che ai lati va indietro fino a z≈-2.4): seguendo l'ovale vero il bordo resta incollato al contorno del viso.
const FACE_OVAL_IDS = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
// rim(a) → {r, z}: distanza dal centro (0,cy) e profondità del contorno del viso nella direzione a (radianti)
function ovalRim(h, o) {
  o = o || {}; const cy = o.cy === undefined ? -0.5 : o.cy, N = 120;
  const pts = FACE_OVAL_IDS.map(i => { const v = h.lm(i); return { a: Math.atan2(v.y - cy, v.x), r: Math.hypot(v.x, v.y - cy), z: v.z }; }).sort((p, q) => p.a - q.a);
  const R = new Float32Array(N), Z = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const a = -PI + (k / N) * 2 * PI; let j = pts.findIndex(p => p.a > a); if (j < 0) j = 0;
    const p2 = pts[j], p1 = pts[(j + pts.length - 1) % pts.length];
    let a1 = p1.a, a2 = p2.a, aa = a; if (a2 <= a1) a2 += 2 * PI; if (aa < a1) aa += 2 * PI;
    const t = c01((aa - a1) / ((a2 - a1) || 1)); R[k] = p1.r + (p2.r - p1.r) * t; Z[k] = p1.z + (p2.z - p1.z) * t;
  }
  for (let it = 0; it < 3; it++) for (const A of [R, Z]) { const c = A.slice(); for (let k = 0; k < N; k++) A[k] = (c[(k + N - 1) % N] + 2 * c[k] + c[(k + 1) % N]) / 4; }
  // margine: un po' di più sotto (il mento scende quando si parla) e ai lati (orecchie/capelli)
  const kt = o.top || 1.06, ks = o.side || 1.1, kb = o.bottom || 1.16;
  const f = (a) => {
    let u = ((a + PI) / (2 * PI)) * N; u = ((u % N) + N) % N; const k0 = Math.floor(u), k1 = (k0 + 1) % N, t = u - k0;
    const sn = Math.sin(a); const m = ks + (kt - ks) * Math.max(0, sn) ** 2 + (kb - ks) * Math.max(0, -sn) ** 2;
    return { r: (R[k0] + (R[k1] - R[k0]) * t) * m, z: Z[k0] + (Z[k1] - Z[k0]) * t };
  };
  f.cy = cy; return f;
}
// guscio attorno alla finestra. prof: righe [k, z, w] dal bordo (prima riga) verso l'esterno/dietro:
// raggio = rim.r·k (xy, attorno al centro), z = (1-w)·(rim.z + z) + w·z  (w=0 segue il viso, w=1 z assoluta).
// sx/sy (opz.) allungano in x/y le righe esterne; shape(a,v) moltiplica il raggio. Ritorna la geometria con
// userData.jw = peso "mandibola" per vertice (bordo inferiore vicino alla finestra) per seguire il mento.
function faceRing(THREE, h, rim, o) {
  const prof = o.prof, nu = o.nu || 96, nv = o.nv || 32, cy = rim.cy, sx = o.sx || 1, sy = o.sy || 1;
  const jw = [];
  const fn = (u, v) => {
    const a = u * 2 * PI - PI / 2, p = crom(prof, v), rm = rim(a), k = o.shape ? o.shape(a, v) : 1;
    const w = c01(p[2] === undefined ? 0 : p[2]);
    const ex = 1 + (sx - 1) * c01(v * 2), ey = 1 + (sy - 1) * c01(v * 2);
    return [rm.r * p[0] * k * Math.cos(a) * ex, cy + rm.r * p[0] * k * Math.sin(a) * ey, (1 - w) * (rm.z + p[1]) + w * p[1]];
  };
  const g = surf(THREE, nu, nv, (u, v) => { const a = u * 2 * PI - PI / 2; jw.push(c01((-Math.sin(a) - .15) / .6) * Math.max(0, 1 - v * (o.jawFall || 3))); return fn(u, v); });
  g.userData.fn = fn;
  g.userData.jw = jw; return g;
}
// curva chiusa lungo la finestra (per tubi: bordi, cornici) a raggio rim·k e z = rim.z + dz
function rimCurve(THREE, rim, k, dz, n) {
  const pts = []; n = n || 72;
  for (let i = 0; i < n; i++) { const a = (i / n) * 2 * PI - PI / 2, r = rim(a); pts.push(new THREE.Vector3(r.r * k * Math.cos(a), rim.cy + r.r * k * Math.sin(a), r.z + dz)); }
  return new THREE.CatmullRomCurve3(pts, true);
}
function rimTube(THREE, mat, rim, k, dz, th, P) {
  const m = new THREE.Mesh(new THREE.TubeGeometry(rimCurve(THREE, rim, k, dz, 72), 144, th, 10, true), mat);
  if (P) { const pos = m.geometry.attributes.position, jw = []; for (let i = 0; i < pos.count; i++) jw.push(c01((-(pos.getY(i) - rim.cy) / 9 - .15) / .6)); m.geometry.userData.jw = jw; regRingJaw(P, m); }
  return m;
}
// Scene con il viso vero (hideHead=false): l'occlusore del viso nell'app è un materiale "transparent", quindi
// copre solo gli oggetti disegnati dopo di lui (anch'essi transparent). Le parti opache dietro al viso (dischi,
// fondali, candele) altrimenti spuntano nel varco fra cranio e collo, sotto la bocca. Rendo tutto "transparent"
// (opacità invariata, depthWrite resta acceso): il viso vero non viene mai coperto da ciò che gli sta dietro.
function sceneFinish(root) {
  root.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { if (!m.transparent) { m.transparent = true; m.opacity = m.opacity === undefined ? 1 : m.opacity; } } });
}
// colori per vertice di una geometria faceRing: fn(x, y, z, v) → hex (v = 0 sul bordo della finestra, 1 dietro)
function ringColors(THREE, geo, nu, fn) {
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  const nv = pos.count / (nu + 1) - 1;
  for (let i = 0; i < pos.count; i++) { c.set(fn(pos.getX(i), pos.getY(i), pos.getZ(i), Math.floor(i / (nu + 1)) / nv)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); return geo;
}
function mixHex(a, b, t) { const A = [a >> 16 & 255, a >> 8 & 255, a & 255], B = [b >> 16 & 255, b >> 8 & 255, b & 255]; t = c01(t); return (Math.round(A[0] + (B[0] - A[0]) * t) << 16) | (Math.round(A[1] + (B[1] - A[1]) * t) << 8) | Math.round(A[2] + (B[2] - A[2]) * t); }
// denti lungo il bordo della finestra (puntano verso il centro); quelli in basso seguono il mento (jawOpen)
function rimTeeth(THREE, P, root, rim, o) {
  const teeth = [], Y = new THREE.Vector3(0, 1, 0), mat = o.mat;
  for (let i = 0; i < o.n; i++) {
    const a = (i + .5) / o.n * 2 * PI - PI / 2; if (o.filter && !o.filter(a)) continue;
    const r = rim(a), k = o.k || 1.04, x = r.r * k * Math.cos(a), y = rim.cy + r.r * k * Math.sin(a);
    const len = (o.len || 1.8) * (o.lenFn ? o.lenFn(a) : 1);
    const m = new THREE.Mesh(new THREE.ConeGeometry(o.r || .55, len, 8), mat); m.geometry.translate(0, len / 2, 0);
    const dir = new THREE.Vector3(-Math.cos(a), -Math.sin(a), o.fwd === undefined ? .25 : o.fwd).normalize();
    m.quaternion.setFromUnitVectors(Y, dir); m.position.set(x, y, r.z + (o.dz || 1.6)); root.add(m);
    teeth.push({ m, y, w: c01((-Math.sin(a) - .15) / .6) });
  }
  P.fx.push((s) => { const d = -(o.jaw || 1.6) * s.jaw; for (const t of teeth) t.m.position.y = t.y + d * t.w; });
  return teeth;
}
// pettorina/tuta davanti all'occlusore del busto (box 34×10×12 a z -8…4): tutto ciò che sta dietro z≈4 sparisce,
// quindi il busto dei costumi è una "lastra" curva davanti (z ≥ 4.3) con le spalle che scendono ai lati
function chestPlate(THREE, o) {
  o = o || {}; const W = o.w || 19, y0 = o.top === undefined ? -12.5 : o.top, y1 = o.bottom === undefined ? -32 : o.bottom, z0 = o.z || 4.4, bz = o.bulge === undefined ? 5 : o.bulge, sh = o.shoulder === undefined ? 4.5 : o.shoulder;
  return surf(THREE, o.nu || 40, o.nv || 14, (u, v) => {
    const x = W - 2 * W * u, ax = Math.abs(x) / W, yt = y0 - sh * ax * ax, y = yt + (y1 - yt) * v;
    return [x, y, z0 + bz * Math.sqrt(Math.max(0, 1 - ax * ax)) * (.65 + .35 * (1 - v))];
  }, false);
}
// cupola trasparente (visiera/oblò) appoggiata sul bordo della finestra, gonfia fino a zF davanti al naso
function rimDome(THREE, mat, rim, k, dz, zF) {
  return new THREE.Mesh(surf(THREE, 72, 12, (u, v) => {
    const a = u * 2 * PI - PI / 2, r = rim(a), rho = 1 - v, z0 = r.z + dz;
    return [r.r * k * rho * Math.cos(a), rim.cy + r.r * k * rho * Math.sin(a), z0 + (zF - z0) * Math.sqrt(Math.max(0, 1 - rho * rho))];
  }), mat);
}
// la parte bassa del bordo scende col mento (jawOpen): morph sui vertici
function regRingJaw(P, mesh, amt) {
  const pos = mesh.geometry.attributes.position; const base = Float32Array.from(pos.array); const jw = mesh.geometry.userData.jw; if (!jw) return;
  let last = -1;
  P.fx.push((s) => { const d = -(amt || 2.6) * s.jaw; if (Math.abs(d - last) < .01) return; last = d; for (let i = 0; i < pos.count; i++) pos.array[i * 3 + 1] = base[i * 3 + 1] + d * jw[i]; pos.needsUpdate = true; });
}
// testa: ellissoide con la calotta un po' "squadrata" (superellissoide, esponente 2 → 2+boxy verso la cima),
// così gli angoli in alto coprono i capelli veri, mentre la zona occhi/bocca resta un ellissoide normale
function headGeo(THREE, r, boxy, lift) {
  lift = lift === undefined ? .1 : lift;
  const g = new THREE.SphereGeometry(1, 48, 36), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = c01((y - .3) / .5), n = 2 + boxy * t * t * (3 - 2 * t);
    if (n > 2.001) { const k = Math.pow(Math.pow(Math.abs(x), n) + Math.pow(Math.abs(y), n) + Math.pow(Math.abs(z), n), -1 / n); x *= k; y *= k; z *= k; }
    // calotta alzata di ~1 cm (prima del HEAD_FIT) per coprire la riga di capelli in cima
    const tl = c01((y - .3) / .6); y *= 1 + lift * tl * tl * (3 - 2 * tl);
    p.setXYZ(i, x * r[0], y * r[1], z * r[2]);
  }
  g.computeVertexNormals(); return g;
}
// base "testa animale": ellissoide testa + bocca (cavità, labbro, lingua, linea sorriso, mandibola) + occhi + sopracciglia
function animalBase(THREE, h, P, root, o) {
  const hr = o.headR || [11.2, 12.6, 11.4], hc = o.headC || [0, 0, -2.7];
  const out = {};
  if (o.head !== false) { out.head = new THREE.Mesh(headGeo(THREE, hr, o.boxy === undefined ? .8 : o.boxy), o.skin); out.head.position.set(hc[0], hc[1], hc[2]); root.add(out.head); }
  const my = o.mouthY === undefined ? -6.2 : o.mouthY, mz = o.mouthZ === undefined ? 5.7 : o.mouthZ, mw = o.mouthW || 3.8, mh = o.mouthH || 2.8;
  const lipMat = o.lipMat || o.skin;
  if (o.lip !== false) { out.lip = ell(THREE, lipMat, mw * .95, 1.0, 1.2, 0, my - 1, mz + 1.7, 20); root.add(out.lip); }
  if (o.tongue !== false) { out.tongue = mkTongue(THREE, h, P, Object.assign({ x: 0, y: my - 1.2, z: mz + .5, rx: mw * .4, ry: .55, rz: 1.9, out: 2.2 }, o.tongueOpt || {})); root.add(out.tongue); }
  out.cav = mkCavity(THREE, h, P, { x: 0, y: my, z: mz, rx: mw, ry: mh, rz: 2.6, lip: out.lip, lipOff: .1, follow: out.tongue ? [[out.tongue, .9]] : [], color: o.cavColor });
  root.add(out.cav);
  if (o.smile !== false) root.add(out.smile = mkSmile(THREE, h, P, Object.assign({ x: 0, y: my + .2, z: mz + 2.9, w: mw * .95, th: .3, color: o.lineColor || 0x7a3a40, droop: -.3, tip: .25, back: 1.2 }, o.smileOpt || {})));
  if (o.jaw !== false) {
    out.jaw = mkJaw(THREE, P, { pivot: [0, -1, -2], max: o.jawMax === undefined ? .32 : o.jawMax }); root.add(out.jaw);
    jawAdd(out.jaw, ell(THREE, o.skin, hr[0] * .82, hr[1] * .51, hr[2] * .86, hc[0], hc[1] - 4.4, hc[2] + .8, 36));
  }
  out.eyes = []; out.brows = [];
  const eo = Object.assign({ r: 2.0, x: 3.8, y: 3.0, z: 7.4, lidMat: o.skin, ryAbs: .18 }, o.eyeOpt || {});
  const bo = Object.assign({ x: 3.9, y: 6.1, z: 8.4, w: 3.0, th: .4, color: 0x333333, rz: -0.1, rx: -.3 }, o.browOpt || {});
  for (const sd of [1, -1]) {
    if (o.eye !== false) { const e = mkEye(THREE, h, P, Object.assign({}, eo, { side: sd, x: sd * eo.x, ry: sd * eo.ryAbs })); root.add(e); out.eyes.push(e); }
    if (o.brow !== false) { const b = mkBrow(THREE, h, P, Object.assign({}, bo, { side: sd, x: sd * bo.x, rz: sd * bo.rz })); root.add(b); out.brows.push(b); }
  }
  return out;
}
// aggiornamento standard di tutte le parti registrate
function kitUpdate(g, bs, t, h) {
  const P = g.userData.P; if (!P) return; const ud = g.userData; const k = ud.k || .4;
  const s = ud.s || (ud.s = {});
  s.jaw = smooth(s, '_jaw', B(bs, 'jawOpen'), k);
  // palpebre: MediaPipe dà 0.2–0.45 anche a occhi aperti (sorriso, occhi socchiusi) → si chiudono solo con un ammiccamento vero
  const bl = v => { const x = c01((v - .38) / .42); return x * x * (3 - 2 * x); };
  s.blinkL = smooth(s, '_bl', bl(B(bs, 'eyeBlinkLeft')), .6); s.blinkR = smooth(s, '_br', bl(B(bs, 'eyeBlinkRight')), .6);
  s.wideL = smooth(s, '_wl', B(bs, 'eyeWideLeft'), k); s.wideR = smooth(s, '_wr', B(bs, 'eyeWideRight'), k);
  s.smileL = smooth(s, '_sl', B(bs, 'mouthSmileLeft'), k); s.smileR = smooth(s, '_sr', B(bs, 'mouthSmileRight'), k);
  s.frownL = smooth(s, '_fl', B(bs, 'mouthFrownLeft'), k); s.frownR = smooth(s, '_fr', B(bs, 'mouthFrownRight'), k);
  s.browIn = smooth(s, '_bi', B(bs, 'browInnerUp'), k);
  s.browOutL = smooth(s, '_bol', B(bs, 'browOuterUpLeft'), k); s.browOutR = smooth(s, '_bor', B(bs, 'browOuterUpRight'), k);
  s.browDnL = smooth(s, '_bdl', B(bs, 'browDownLeft'), k); s.browDnR = smooth(s, '_bdr', B(bs, 'browDownRight'), k);
  s.pucker = smooth(s, '_pk', Math.max(B(bs, 'mouthPucker'), B(bs, 'mouthFunnel') * .8), k);
  s.puff = smooth(s, '_pf', B(bs, 'cheekPuff'), k);
  s.tongue = smooth(s, '_tg', B(bs, 'tongueOut'), k);
  s.lookXL = smooth(s, '_lxl', B(bs, 'eyeLookOutLeft') - B(bs, 'eyeLookInLeft'), k);
  s.lookXR = smooth(s, '_lxr', B(bs, 'eyeLookInRight') - B(bs, 'eyeLookOutRight'), k);
  s.lookYL = smooth(s, '_lyl', B(bs, 'eyeLookUpLeft') - B(bs, 'eyeLookDownLeft'), k);
  s.lookYR = smooth(s, '_lyr', B(bs, 'eyeLookUpRight') - B(bs, 'eyeLookDownRight'), k);
  s.smile = (s.smileL + s.smileR) / 2; s.frown = (s.frownL + s.frownR) / 2;
  for (const e of P.eyes) {
    const L = e.side > 0; const blink = L ? s.blinkL : s.blinkR, wide = L ? s.wideL : s.wideR;
    const open = e.open - wide * .35 + (L ? s.browDnL : s.browDnR) * .12;
    e.lid.rotation.x = open + (e.closed - open) * blink;
    const lx = L ? s.lookXL : s.lookXR, ly = L ? s.lookYL : s.lookYR;
    e.look.position.set(lx * e.r * .25, ly * e.r * .25, 0);
    e.look.rotation.set(-ly * .15, lx * .15, 0);
  }
  for (const b of P.brows) {
    const L = b.side > 0; const out = L ? s.browOutL : s.browOutR, dn = L ? s.browDnL : s.browDnR;
    b.obj.position.y = b.y + (s.browIn * 1.1 + out * .8 - dn * .9) * b.k;
    b.obj.rotation.z = b.rz + b.side * (-s.browIn * .3 + dn * .28 + out * .15);
  }
  for (const j of P.jaws) j.obj.rotation.x = j.rx + s.jaw * j.max;
  for (const c of P.cavs) {
    c.obj.scale.y = c.ry * (c.min + (1 - c.min) * s.jaw); c.obj.scale.x = c.rx * (1 + s.smile * .18 - s.pucker * .45);
    for (const f of c.follow) { f.obj.position.y = c.obj.position.y - c.obj.scale.y + f.off - (f.obj.userData.tg ? s.tongue * .4 : 0); if (f.lip) f.obj.scale.x = f.sx * (1 - s.pucker * .4); }
  }
  for (const l of P.lips) { l.obj.rotation.z = l.side * (s.smile * l.amp - s.frown * l.amp * .6); l.obj.scale.x = 1 - s.pucker * .45; l.obj.position.z = s.pucker * .6; }
  for (const tg of P.tongues) { tg.obj.visible = (s.jaw > .06 || s.tongue > .06); tg.obj.position.z = tg.z + s.tongue * tg.out; if (!tg.obj.userData.followed) tg.obj.position.y = tg.y - s.tongue * .4; tg.obj.scale.z = (tg.obj.userData.rz || (tg.obj.userData.rz = tg.obj.scale.z)) * (1 + s.tongue * .5); }
  for (const c of P.cheeks) { const f = 1 + s.puff * c.puff; c.obj.scale.set(c.s[0] * f, c.s[1] * f, c.s[2] * (1 + s.puff * c.puff * 1.6)); }
  for (const e of P.ears) { e.obj.rotation.z = e.rz + Math.sin(t * 1.7 + e.phase) * .05 * e.amp - (e.rz > 0 ? 1 : -1) * 0; e.obj.rotation.x = e.rx + Math.sin(t * 2.3 + e.phase) * .04 * e.amp - (s.browIn + s.wideL + s.wideR) * .5 * e.up; }
  if (ud.root) { ud.root.position.y = Math.sin(t * 1.6) * .25; ud.root.rotation.z = Math.sin(t * .9) * .01; }
  for (const f of P.fx) f(s, t, bs);
}
// ───────────────────────────── fine kit ─────────────────────────────

export const meta = { label: 'Palombaro', labelEn: 'Diving helmet', category: 'divertenti', icon: '🤿' };
export const hideHead = false;

export default function build(THREE, h) {
  const g = new THREE.Group(); const P = reg(g);
  const root = mkRoot(THREE, g, hideHead ? HEAD_FIT : null);
  const brass = M(h, 0xc8923a, { roughness: .32, metalness: .85 });
  const brassD = M(h, 0x9a6a26, { roughness: .38, metalness: .85 });
  const copper = gradMat(THREE, h, 0xd8a050, 0xa86a2a, { roughness: .3, metalness: .8 });
  const dark = M(h, 0x1e2226, { roughness: .4 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0xcfe8f0, roughness: .05, metalness: .1, transparent: true, opacity: .12, depthWrite: false });

  // casco tondo in rame: l'oblò frontale segue l'ovale del viso
  const rim = ovalRim(h, { top: 1.12, side: 1.08, bottom: 1.16 }); const CY = rim.cy;
  const geo = faceRing(THREE, h, rim, { prof: [[1.0, .6, 0], [1.07, 1.8, 0], [1.22, 1.2, .2], [1.45, -2.4, .6], [1.52, -6, 1], [1.45, -10.5, 1], [1.0, -14.5, 1], [0, -16.2, 1]], sy: 1.08, nu: 96, nv: 36, jawFall: 1.2 });
  const shell = new THREE.Mesh(geo, copper); root.add(shell); regRingJaw(P, shell, 1.4);
  const fn = geo.userData.fn; const at = (a, v) => fn(((a + PI / 2) / (2 * PI) + 1) % 1, v);
  const jawW = (m) => { const pos = m.geometry.attributes.position, jw = []; for (let i = 0; i < pos.count; i++) jw.push(c01((-(pos.getY(i) - CY) / 9 - .15) / .6)); m.geometry.userData.jw = jw; regRingJaw(P, m, 1.4); return m; };
  // cornice dell'oblò: anello spesso + anello sottile + bulloni
  root.add(jawW(rimTube(THREE, brass, rim, 1.05, 2.0, .95)));
  root.add(jawW(rimTube(THREE, brassD, rim, 1.15, 1.2, .38)));
  const bolts = [];
  for (let i = 0; i < 12; i++) { const a = (i + .5) / 12 * 2 * PI - PI / 2, r = rim(a); const b = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .6, 6), brassD); b.rotation.x = PI / 2; const y = CY + r.r * 1.2 * Math.sin(a); b.position.set(r.r * 1.2 * Math.cos(a), y, r.z + 2.1); root.add(b); bolts.push({ b, y, w: c01((-Math.sin(a) - .15) / .6) }); }
  // vetro dell'oblò + riflesso
  root.add(rimDome(THREE, glassM, rim, 1.05, 2.0, 11.5));
  const gl = ell(THREE, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .25, roughness: .1, depthWrite: false }), .9, 3.8, .3, -4.6, 3.6, 10.4, 10); gl.rotation.z = .4; root.add(gl);
  // oblò laterali con grata
  for (const sd of [1, -1]) {
    const p = at(sd > 0 ? .1 : PI - .1, .42); const port = new THREE.Group(); port.position.set(p[0], p[1], p[2]); port.rotation.y = sd * 1.25; root.add(port);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, .55, 10, 28), brass); port.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), M(h, 0x2a3a44, { roughness: .1, metalness: .3 })); disc.position.z = -.1; port.add(disc);
    for (let k = -1; k <= 1; k++) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, 4.8, 6), brassD); bar.position.set(k * 1.2, 0, .2); port.add(bar); }
  }
  // valvola in cima + gomito dell'aria dietro
  const pt = at(PI / 2, .55);
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 2.6, 16), brass); valve.position.set(0, pt[1] + 1.0, pt[2]); root.add(valve);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.5, .25, 8, 20), brassD); wheel.rotation.x = PI / 2; wheel.position.set(0, pt[1] + 2.5, pt[2]); root.add(wheel);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(9, 6, -8), new THREE.Vector3(14, 3, -6), new THREE.Vector3(16, -6, -2), new THREE.Vector3(17, -16, 5)]), 24, 1.1, 10), M(h, 0x2a2a2e, { roughness: .7 })); root.add(hose);
  // collare + corazza (davanti all'occlusore del busto) con bulloni
  const collar = new THREE.Mesh(new THREE.TorusGeometry(9.8, 1.6, 12, 48), brass); collar.rotation.x = PI / 2; collar.position.set(0, -13.6, -1.0); root.add(collar);
  root.add(new THREE.Mesh(chestPlate(THREE, { w: 18, top: -13.5, bottom: -30, z: 4.6, bulge: 4.5, shoulder: 3.5 }), gradMat(THREE, h, 0xd8a050, 0xa06428, { roughness: .32, metalness: .8, side: THREE.DoubleSide })));
  for (let i = 0; i < 9; i++) { const x = -14 + i * 3.5, ax = Math.abs(x) / 18; const b = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .5, 6), brassD); b.rotation.x = PI / 2; b.position.set(x, -15.5 - 3.5 * ax * ax, 4.6 + 4.5 * Math.sqrt(1 - ax * ax) * .97 + .3); root.add(b); }
  // bollicine che salgono
  const bubbles = [];
  for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.35 + (i % 3) * .2, 10, 8), new THREE.MeshStandardMaterial({ color: 0xdff4ff, transparent: true, opacity: .45, roughness: .05, depthWrite: false })); root.add(b); bubbles.push({ b, ph: i * .37, x: 10 + (i % 3) * 1.2 }); }
  P.fx.push((s, t) => {
    for (const { b, y, w } of bolts) b.position.y = y - 1.4 * s.jaw * w;
    bubbles.forEach(({ b, ph, x }) => { const k = (t * (.25 + s.jaw * .4) + ph) % 1; b.position.set(x + Math.sin(t * 3 + ph * 9) * .6, 8 + k * 16, 2 + ph * 3); b.visible = k > .02; });
    wheel.rotation.z = t * .5 + s.browIn;
  });
  sceneFinish(root);
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
