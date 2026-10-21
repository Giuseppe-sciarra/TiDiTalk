// Teste dai modelli gratuiti (glb/): occhi, palpebre, sopracciglia e bocca che copiano le espressioni.
// I file che iniziano per "_" non vanno nel catalogo. Ogni modulo dice DOVE stanno occhi e bocca del suo modello
// (cm, spazio del viso canonico) e in che stile; qui si costruiscono e si animano.
//
// Valori bs CALIBRATI (EFFETTI.md): 0 = faccia neutra, 1 = espressione piena. Tutto si muove in modo ben visibile.
// eyeBlinkLeft = occhio sinistro della PERSONA, che nell'immagine (a specchio, come nell'app) sta a destra di chi
// guarda = lato +x del personaggio (side +1).
// Niente allocazioni in update(): solo numeri e trasformazioni create in build().

const PI = Math.PI;
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const B = (bs, k) => { const v = bs ? bs[k] : 0; return (typeof v === 'number' && v === v) ? c01(v) : 0; };
const sm = (s, k, v, a) => { const p = s[k]; return (s[k] = p === undefined ? v : p + (v - p) * a); };

export function mat(THREE, color, o) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0, envMapIntensity: 0.5 }, o || {}));
}

// ── occhio ───────────────────────────────────────────────────────────────────
// o: { x, y, z, r, side, style: 'ball' | 'flat' | 'lids' (solo palpebre sopra un bulbo che c'è già),
//      sx, sy, sz (forma del bianco), iris (null = niente), irisR, pupil, pupilR, white, lid, lidMat, flat (flatShading),
//      rest: [lx, ly] sguardo a riposo (-1..1), look (quanto si muove), open (rad, palpebra alta a riposo; 0 = a metà),
//      low (rad, palpebra bassa a riposo), angry (inclinazione col broncio), lash, hl (riflessi), rx, ry, tilt }
function mkEye(THREE, P, root, o) {
  const r = o.r || 2, side = o.side || 1, style = o.style || 'ball';
  const e = new THREE.Group(); e.position.set(o.x, o.y, o.z); e.rotation.set(o.rx || 0, (o.ry || 0) * side, (o.tilt || 0) * side);
  root.add(e);
  const sx = o.sx || 1, sy = o.sy || 1, sz = o.sz || (style === 'flat' ? 0.32 : 1);
  const shape = new THREE.Group(); shape.scale.set(sx, sy, sz); e.add(shape);
  let look = null, pupil = null;
  if (style !== 'lids') {
    shape.add(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), o.whiteMat || mat(THREE, o.white == null ? 0xf4f1ea : o.white, { roughness: 0.3, flatShading: !!o.flat })));
    look = new THREE.Group(); e.add(look);
    const ir = r * (o.irisR || 0.62), pr = r * (o.pupilR || 0.34);
    const pz = r * sz;                                   // superficie davanti del bianco (anche se schiacciato)
    if (o.iris != null) {
      const iris = new THREE.Mesh(new THREE.SphereGeometry(ir, 24, 14), mat(THREE, o.iris, { roughness: 0.3 }));
      iris.scale.z = 0.18; iris.position.z = pz - ir * 0.12; look.add(iris);
    }
    pupil = new THREE.Mesh(new THREE.SphereGeometry(pr, 24, 14), mat(THREE, o.pupil == null ? 0x14100f : o.pupil, { roughness: 0.25, flatShading: !!o.flat }));
    pupil.scale.z = 0.2; pupil.position.z = pz - pr * 0.05; look.add(pupil);
    if (style === 'flat') { pupil.scale.z = 0.06 / pr; pupil.position.z = pz + 0.01; }
    if (o.hl !== false) {   // riflessi fermi nell'orbita: non seguono lo sguardo (come nei cartoni)
      const hm = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const hr = Math.max(pr * (o.hlR || 0.32), r * 0.08);
      const h1 = new THREE.Mesh(new THREE.SphereGeometry(hr, 12, 8), hm);
      const hx = o.hlX == null ? -0.32 : o.hlX, hy = o.hlY == null ? 0.38 : o.hlY;
      if (style === 'flat') { h1.scale.z = 0.05 / hr; h1.position.set(hx * r * sx, hy * r * sy, pz + 0.1); }
      else { const ce = Math.sqrt(Math.max(0, 1 - hx * hx - hy * hy)); h1.scale.z = 0.3; h1.position.set(hx * r * sx, hy * r * sy, ce * r * sz + 0.02); }
      e.add(h1);
      const h2 = h1.clone(); h2.scale.x *= 0.45; h2.scale.y *= 0.45;
      if (style === 'flat') h2.position.set(-hx * 0.8 * r * sx, -hy * 0.7 * r * sy, pz + 0.1);
      else { const ce2 = Math.sqrt(Math.max(0, 1 - 0.3 * 0.3 - 0.25 * 0.25)); h2.position.set(0.3 * r * sx, -0.25 * r * sy, ce2 * r * sz + 0.02); }
      e.add(h2);
    }
  }
  if (style === 'flat') return flatLids(THREE, P, e, o, { r, side, sx, sy, sz, look, pupil });
  // palpebre: calotte (sopra e sotto) un filo più grandi del bianco, nello spazio della forma (seguono l'ellissoide)
  const lidM = o.lidMat || mat(THREE, o.lid == null ? 0x888888 : o.lid, { roughness: 0.75, flatShading: !!o.flat });
  const k = o.lidR || 1.08;
  const lidS = new THREE.Group(); lidS.scale.set(sx * k, sy * k, sz * (style === 'lids' ? k : style === 'flat' ? 1.7 : k * 1.05)); e.add(lidS);
  const cap = PI / 2 + 0.12;
  const up = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 14, 0, 2 * PI, 0, cap), lidM);
  const lo = new THREE.Mesh(new THREE.SphereGeometry(r * 0.995, 32, 10, 0, 2 * PI, 0, cap), lidM);
  const upG = new THREE.Group(), loG = new THREE.Group(); upG.add(up); loG.add(lo); lo.rotation.z = PI;
  lidS.add(upG, loG);
  if (o.liner !== false) {
    const lw = (o.linerW || 0.18) / (r * sy * k);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * Math.sin(cap), lw * r, 6, 40, PI), mat(THREE, o.liner == null ? 0x2a2224 : o.liner, { roughness: 0.6 }));
    rim.rotation.x = PI / 2; rim.position.y = r * Math.cos(cap); up.add(rim);
  }
  if (o.lash) {
    const lm = mat(THREE, 0x15100e, { roughness: 0.6 });
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(new THREE.ConeGeometry(r * 0.08, r * 0.55, 6), lm);
      const a = (i - 1) * 0.45 + 0.35;
      l.position.set(Math.sin(a) * r * side, Math.cos(cap) * r + r * 0.05, Math.cos(a) * r * Math.sin(cap)); l.rotation.set(-0.9, 0, -a * side * 0.9);
      up.add(l);
    }
  }
  const E = { e, upG, loG, look, pupil, side, r, sx, sy, sz, style, k: o.look == null ? 1 : o.look,
    open: o.open == null ? -1.0 : o.open, low: o.low == null ? 1.05 : o.low, angry: o.angry == null ? 0.35 : o.angry,
    rest: o.rest || [0, 0], pz: r * sz, pr: r * (o.pupilR || 0.34) };
  P.eyes.push(E);
  return E;
}

// palpebre "dipinte" (stile piatto): due pezzi di pelle con la forma esatta dell'occhio che scendono/salgono,
// con il bordo scuro. lidMat può essere il materiale stesso del modello (stessa luce): uv = punto della pelle.
const NX = 17;
function lidGeo(THREE, uv) {
  const g = new THREE.BufferGeometry(), n = NX * 2;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const nr = new Float32Array(n * 3); for (let i = 0; i < n; i++) nr[i * 3 + 2] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nr, 3));
  const u = new Float32Array(n * 2); for (let i = 0; i < n; i++) { u[i * 2] = uv ? uv[0] : 0.5; u[i * 2 + 1] = uv ? uv[1] : 0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(u, 2));
  const idx = []; for (let i = 0; i < NX - 1; i++) { const a = i * 2, b = a + 2; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  g.setIndex(idx); return g;
}
function flatLids(THREE, P, e, o, q) {
  const lidM = o.lidMat || mat(THREE, o.lid == null ? 0x888888 : o.lid, { roughness: 0.75, flatShading: true });
  const linM = mat(THREE, o.liner == null ? 0x2a2224 : o.liner, { roughness: 0.6 });
  const up = new THREE.Mesh(lidGeo(THREE, o.lidUV), lidM), lo = new THREE.Mesh(lidGeo(THREE, o.lidUV), lidM);
  const lu = new THREE.Mesh(lidGeo(THREE, null), linM), ll = new THREE.Mesh(lidGeo(THREE, null), linM);
  const z = q.r * q.sz + 0.16;     // davanti a pupilla (pz+0.01) e riflessi (pz+0.1)
  up.position.z = lo.position.z = z; lu.position.z = ll.position.z = z + 0.02;
  for (const m of [up, lo, lu, ll]) { m.frustumCulled = false; e.add(m); }
  const E = { e, look: q.look, pupil: q.pupil, side: q.side, r: q.r, sx: q.sx, sy: q.sy, sz: q.sz, style: 'flat', k: o.look == null ? 1 : o.look,
    rest: o.rest || [0, 0], pz: q.r * q.sz, pr: q.r * (o.pupilR || 0.34), angry: o.angry == null ? 0.35 : o.angry,
    flat: { up, lo, lu, ll, ax: q.r * q.sx * 1.05, ay: q.r * q.sy * 1.05, lw: (o.linerW || 0.25) / (q.r * q.sy), arc: o.lidArc == null ? 0.22 : o.lidArc } };
  P.eyes.push(E); setFlat(E, 1.2, -1.2, 0);
  return E;
}
// cu: bordo della palpebra alta (−1 chiusa … 1.2 aperta, unità del raggio), cl: bassa, tilt: broncio (+ = lato naso più basso)
function setFlat(E, cu, cl, tilt) {
  const F = E.flat, ax = F.ax, ay = F.ay;
  const pu = F.up.geometry.attributes.position.array, pl = F.lo.geometry.attributes.position.array;
  const qu = F.lu.geometry.attributes.position.array, ql = F.ll.geometry.attributes.position.array;
  for (let i = 0; i < NX; i++) {
    const x = (i / (NX - 1)) * 2 - 1, yt = Math.sqrt(Math.max(0, 1 - x * x));
    let eu = cu - F.arc * x * x - tilt * x * E.side; eu = eu > yt ? yt : eu < -yt ? -yt : eu;
    let el = cl + F.arc * 0.6 * x * x; el = el < -yt ? -yt : el > yt ? yt : el;
    if (el > eu) el = eu;
    const lu2 = Math.min(yt, eu + F.lw), ll2 = Math.max(-yt, el - F.lw);
    const X = x * ax, a = i * 6;
    pu[a] = X; pu[a + 1] = yt * ay; pu[a + 2] = 0; pu[a + 3] = X; pu[a + 4] = eu * ay; pu[a + 5] = 0;
    pl[a] = X; pl[a + 1] = el * ay; pl[a + 2] = 0; pl[a + 3] = X; pl[a + 4] = -yt * ay; pl[a + 5] = 0;
    qu[a] = X; qu[a + 1] = lu2 * ay; qu[a + 2] = 0; qu[a + 3] = X; qu[a + 4] = eu * ay; qu[a + 5] = 0;
    ql[a] = X; ql[a + 1] = el * ay; ql[a + 2] = 0; ql[a + 3] = X; ql[a + 4] = ll2 * ay; ql[a + 5] = 0;
  }
  F.up.geometry.attributes.position.needsUpdate = true; F.lo.geometry.attributes.position.needsUpdate = true;
  F.lu.geometry.attributes.position.needsUpdate = true; F.ll.geometry.attributes.position.needsUpdate = true;
}

// ── sopracciglio: tubo ad arco (o un oggetto del modello, es. un osso) ───────
function mkBrow(THREE, P, root, o) {
  const w = o.w || 3.2, th = o.th || 0.45, side = o.side || 1;
  const cur = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-w / 2, -0.15, 0), new THREE.Vector3(0, o.arch == null ? 0.55 : o.arch, 0.2), new THREE.Vector3(w / 2, -0.15, 0));
  const m = o.mat || mat(THREE, o.color == null ? 0x2a2220 : o.color, { roughness: 0.85, flatShading: !!o.flat });
  const tube = new THREE.Mesh(new THREE.TubeGeometry(cur, 14, th, o.flat ? 5 : 10, false), m);
  for (const s of [-1, 1]) { const cp = new THREE.Mesh(new THREE.SphereGeometry(th, o.flat ? 6 : 10, o.flat ? 4 : 8), m); cp.position.set(s * w / 2, -0.15, 0); tube.add(cp); }
  const g = new THREE.Group(); g.add(tube); g.position.set(o.x, o.y, o.z); g.rotation.set(o.rx == null ? -0.25 : o.rx, (o.ry || 0) * side, (o.rz || 0) * side);
  root.add(g);
  P.brows.push({ g, y: o.y, rz: (o.rz || 0) * side, side, k: o.k || 1 });
  return g;
}

// ── bocca ────────────────────────────────────────────────────────────────────
// Cavità scura che si apre con jawOpen, lingua, denti (opz.), labbro/mento che scende, linea del sorriso (due metà
// che ruotano agli angoli) e bacio (anello di labbra in avanti).
// o: { x, y, z, w (semilarghezza), h (apertura max, cm), d (profondità), rx, inner, tongue, teeth: { color, n, up, down, fang },
//      lip (colore del labbro sotto) | null, line (colore linea), lineTh, kiss (colore), smileK, flat, rest (apertura a riposo 0..1) }
function mkMouth(THREE, P, root, o) {
  const g = new THREE.Group(); g.position.set(o.x || 0, o.y, o.z); g.rotation.x = o.rx || 0; root.add(g);
  const w = o.w || 2.6, h = o.h || 2.8, d = o.d || 1.6, flat = !!o.flat;
  const inner = mat(THREE, o.inner == null ? 0x3a1216 : o.inner, { roughness: 0.8, envMapIntensity: 0.1, flatShading: flat });
  const cav = new THREE.Mesh(new THREE.SphereGeometry(1, flat ? 12 : 28, flat ? 8 : 18), inner);
  cav.position.z = flat ? 0.03 : -d * 0.3; g.add(cav);
  const tg = new THREE.Mesh(new THREE.SphereGeometry(1, flat ? 10 : 20, flat ? 6 : 12), mat(THREE, o.tongue == null ? 0xd9576d : o.tongue, { roughness: 0.45, flatShading: flat }));
  g.add(tg);
  const teeth = [];
  if (o.teeth) {
    const tm = mat(THREE, o.teeth.color == null ? 0xf3eee2 : o.teeth.color, { roughness: 0.35, flatShading: flat });
    const n = o.teeth.n || 2, tw = (w * (o.teeth.span || 1.1)) / n;
    for (const row of ['up', 'down']) {
      if (!o.teeth[row]) continue;
      for (let i = 0; i < n; i++) {
        let t;
        if (o.teeth.fang) { t = new THREE.Mesh(new THREE.ConeGeometry(tw * 0.3, tw * 0.85, 8), tm); if (row === 'up') t.rotation.z = PI; }
        else t = new THREE.Mesh(new THREE.BoxGeometry(tw * 0.8, tw * 0.7, tw * 0.45), tm);
        const x = -w * (o.teeth.span || 1.1) / 2 + tw * (i + 0.5);
        t.position.set(x, 0, d * 0.25 * Math.sqrt(Math.max(0, 1 - (x / w) ** 2))); g.add(t);
        teeth.push({ t, row });
      }
    }
  }
  let lip = null;
  if (o.lip != null) {
    lip = new THREE.Mesh(new THREE.SphereGeometry(1, flat ? 12 : 24, flat ? 6 : 12), mat(THREE, o.lip, { roughness: 0.65, flatShading: flat }));
    g.add(lip);
  }
  const lineM = mat(THREE, o.line == null ? 0x2a1214 : o.line, { roughness: 0.6 });
  const lth = o.lineTh || 0.22, NP = 9;
  const tube = (k, ww, back) => {
    const pts = [];
    for (let i = 0; i < NP; i++) { const u = i / (NP - 1) * 2 - 1; pts.push(new THREE.Vector3(u * ww, k * u * u - k * 0.15, -back * u * u)); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, lth, 8, false);
  };
  const c0 = o.curve == null ? 0.35 : o.curve, back = o.lineBack || 0.15;
  const lg = tube(c0, w, back), ls = tube(c0 + (o.smileK || 1.2), w * 1.18, back * 1.4), lf = tube(c0 - (o.frownK || 1.3), w * 0.95, back);
  const rel = (a) => { const p = a.attributes.position.array, b = lg.attributes.position.array, d = new Float32Array(p.length); for (let i = 0; i < p.length; i++) d[i] = p[i] - b[i]; return new THREE.Float32BufferAttribute(d, 3); };
  lg.morphAttributes.position = [rel(ls), rel(lf)]; lg.morphTargetsRelative = true;
  const line = new THREE.Mesh(lg, lineM); line.updateMorphTargets(); g.add(line);
  const cap = new THREE.SphereGeometry(lth, 8, 6);
  const halves = [];
  const kiss = new THREE.Mesh(new THREE.TorusGeometry(w * (o.kissR || 0.42), w * 0.19, 12, 28), mat(THREE, o.kiss == null ? 0xc95b6b : o.kiss, { roughness: 0.4 }));
  g.add(kiss);
  const M = { g, cav, tg, lip, teeth, halves, kiss, w, h, d, z0: o.z, line, rest: o.rest || 0, showLine: o.line !== false, flat,
    lipY: o.lipY == null ? 0.35 : o.lipY };
  P.mouths.push(M);
  return M;
}

export function buildFace(THREE, root, spec) {
  const P = { eyes: [], brows: [], mouths: [], fx: [], s: {} };
  if (spec.eyes) {
    for (const e of (spec.eyes.list || [{}])) {
      const o = Object.assign({}, spec.eyes, e);
      if (o.single) { mkEye(THREE, P, root, Object.assign(o, { side: 1 })); continue; }
      for (const sd of [1, -1]) mkEye(THREE, P, root, Object.assign({}, o, { side: sd, x: sd * o.x }));
    }
  }
  if (spec.brows) for (const sd of [1, -1]) mkBrow(THREE, P, root, Object.assign({}, spec.brows, { side: sd, x: sd * spec.brows.x }));
  if (spec.mouth) mkMouth(THREE, P, root, spec.mouth);
  return P;
}

/** Stato delle espressioni (lisciato) in P.s; poi anima occhi, sopracciglia e bocca. Ritorna lo stato. */
export function updateFace(P, bs) {
  const s = P.s, k = 0.5;
  s.jaw = sm(s, '_j', B(bs, 'jawOpen'), k);
  s.smL = sm(s, '_sl', B(bs, 'mouthSmileLeft'), k); s.smR = sm(s, '_sr', B(bs, 'mouthSmileRight'), k);
  s.frL = sm(s, '_fl', B(bs, 'mouthFrownLeft'), k); s.frR = sm(s, '_fr', B(bs, 'mouthFrownRight'), k);
  s.pk = sm(s, '_pk', Math.max(B(bs, 'mouthPucker'), B(bs, 'mouthFunnel') * 0.85), k);
  s.tongue = sm(s, '_tg', B(bs, 'tongueOut'), k);
  s.blL = sm(s, '_bl', B(bs, 'eyeBlinkLeft'), 0.7); s.blR = sm(s, '_br', B(bs, 'eyeBlinkRight'), 0.7);
  s.sqL = sm(s, '_ql', Math.max(B(bs, 'eyeSquintLeft'), B(bs, 'cheekSquintLeft') * 0.8), k); s.sqR = sm(s, '_qr', Math.max(B(bs, 'eyeSquintRight'), B(bs, 'cheekSquintRight') * 0.8), k);
  s.wiL = sm(s, '_wl', B(bs, 'eyeWideLeft'), k); s.wiR = sm(s, '_wr', B(bs, 'eyeWideRight'), k);
  s.bIn = sm(s, '_bi', B(bs, 'browInnerUp'), k);
  s.boL = sm(s, '_bol', B(bs, 'browOuterUpLeft'), k); s.boR = sm(s, '_bor', B(bs, 'browOuterUpRight'), k);
  s.bdL = sm(s, '_bdl', B(bs, 'browDownLeft'), k); s.bdR = sm(s, '_bdr', B(bs, 'browDownRight'), k);
  s.lx = sm(s, '_lx', ((B(bs, 'eyeLookOutLeft') - B(bs, 'eyeLookInLeft')) + (B(bs, 'eyeLookInRight') - B(bs, 'eyeLookOutRight'))) / 2, k);
  s.ly = sm(s, '_ly', ((B(bs, 'eyeLookUpLeft') + B(bs, 'eyeLookUpRight')) - (B(bs, 'eyeLookDownLeft') + B(bs, 'eyeLookDownRight'))) / 2, k);
  s.puff = sm(s, '_pf', B(bs, 'cheekPuff'), k);
  s.smile = (s.smL + s.smR) / 2; s.frown = (s.frL + s.frR) / 2;
  s.browUp = (s.bIn + (s.boL + s.boR) / 2) / 2; s.browDn = (s.bdL + s.bdR) / 2;
  for (const E of P.eyes) {
    const R = E.side > 0;
    const bl = R ? s.blL : s.blR, sq = R ? s.sqL : s.sqR, wi = R ? s.wiL : s.wiR, bd = R ? s.bdL : s.bdR, bu = R ? s.boL : s.boR;
    if (E.flat) {
      const cb = c01(bl + sq * 0.3);
      const cu = 1.2 - 2.15 * cb * cb * (3 - 2 * cb) - bd * 0.45 + wi * 0.1;
      const cl = -1.2 + 0.9 * c01(sq * 0.55 + bl * 0.25 + s.smile * 0.2);
      setFlat(E, cu, cl, bd * E.angry - s.bIn * 0.25);
    }
    const closed = c01(bl + sq * 0.35 + s.smile * 0.12);
    const o = E.open - wi * 0.35 + bd * 0.3 - bu * 0.1;
    if (E.upG) {
    E.upG.rotation.x = o + (PI / 2 + 0.06 - o) * closed;
    E.upG.rotation.z = -E.side * (bd * E.angry - s.bIn * E.angry * 0.5);      // broncio: palpebra inclinata
    const lc = c01(sq * 0.7 + bl * 0.3 + s.smile * 0.25);
    E.loG.rotation.x = E.low - (E.low - 0.12) * lc;
    }
    if (E.look) {
      if (E.style === 'flat') {     // rest in cm: [verso il naso, su]
        const ax = E.r * E.sx, ay = E.r * E.sy, lim = 0.92;
        let px = -E.side * E.rest[0] + s.lx * ax * 0.32 * E.k, py = E.rest[1] + s.ly * ay * 0.28 * E.k;
        // la pupilla resta dentro il bianco
        const qx = px / Math.max(ax - E.pr, 0.1), qy = py / Math.max(ay - E.pr, 0.1), q = Math.hypot(qx, qy);
        if (q > lim) { px *= lim / q; py *= lim / q; }
        const u = px / ax, v = py / ay;
        E.look.position.set(px, py, E.pz * (Math.sqrt(Math.max(0.05, 1 - u * u - v * v)) - 1));
      } else E.look.rotation.set(-(E.rest[1] + s.ly * E.k) * 0.38, (-E.side * E.rest[0] + s.lx * E.k) * 0.5, 0);
    }
  }
  for (const b of P.brows) {
    const R = b.side > 0; const out = R ? s.boL : s.boR, dn = R ? s.bdL : s.bdR;
    b.g.position.y = b.y + (s.bIn * 0.9 + out * 0.7 - dn * 0.8) * b.k;
    b.g.rotation.z = b.rz + b.side * (-s.bIn * 0.28 + dn * 0.32 + out * 0.12);
  }
  for (const M of P.mouths) {
    const open = c01(Math.max(s.jaw, s.tongue * 0.35, M.rest) * (1 - s.pk * 0.55));
    const hh = 0.1 + open * M.h;
    const ww = M.w * (0.55 + 0.45 * Math.min(1, 0.4 + open * 1.2)) * (1 + s.smile * 0.3 - s.pk * 0.55);
    M.cav.visible = open > 0.02;
    M.cav.scale.set(ww, hh * 0.5, M.flat ? 0.08 : M.d); M.cav.position.y = -hh * 0.45;
    M.tg.visible = open > 0.12 || s.tongue > 0.05;
    if (M.flat) {
      M.tg.scale.set(ww * 0.55, Math.max(0.12, hh * 0.18 + s.tongue * 0.5), 0.06);
      M.tg.position.set(0, -hh * 0.78 - s.tongue * 0.6, 0.1 + s.tongue * 0.25);
    } else {
      M.tg.scale.set(ww * 0.55, Math.max(0.15, hh * 0.2), M.d * (0.65 + s.tongue * 0.7));
      M.tg.position.set(0, -hh * 0.78 + Math.min(hh * 0.2, 0.3), -M.d * 0.15 + s.tongue * M.d * 1.3);
    }
    for (const t of M.teeth) { t.t.visible = open > 0.06; t.t.position.y = t.row === 'up' ? -0.05 : -hh * 0.9 + 0.08; }
    if (M.lip) { M.lip.scale.set(ww * 0.95, M.lipY, 0.55); M.lip.position.set(0, -hh * 0.9 - 0.15, M.d * 0.15); M.lip.visible = open > 0.05; }
    M.line.visible = M.showLine && s.pk < 0.5 && open < 0.3;
    M.line.morphTargetInfluences[0] = s.smile; M.line.morphTargetInfluences[1] = s.frown * (1 - s.smile);
    const kk = c01((s.pk - 0.12) / 0.6);
    M.kiss.visible = kk > 0.01;
    M.kiss.scale.set(0.55 + kk * 0.5, (0.55 + kk * 0.5) * 0.85, 0.6 + kk * 0.5);
    M.kiss.position.set(0, M.flat ? -0.3 : 0, M.flat ? 0.1 + kk * 0.3 : M.d * 0.2 + kk * 0.6);
    M.g.position.z = M.z0 + s.pk * 0.35;
  }
  for (const f of P.fx) f(s);
  return s;
}
