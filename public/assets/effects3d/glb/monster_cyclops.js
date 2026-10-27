// Cyclops — CC0-1.0, Quaternius (quaternius.com)
// Modello: monster_cyclops.glb (Quaternius Cute Animated Monsters, CC0). 1.8.0: la bocca (osso "Mouth" del modello) si apre con
// la tua, si allarga col sorriso e si stringe col bacio; sopracciglia (ossi del modello) che si alzano e si
// aggrottano; palpebre del colore della pelle che sbattono e si strizzano sopra i bulbi, che seguono lo sguardo.
import { loadHead, toCanon } from './_glbhead.js';
export const meta = {"label": "Ciclope", "labelEn": "Cyclops", "category": "personaggi", "icon": "👁️"};
export const hideHead = true;
const P = {"c": [0.0, 0.80297, 0.04987], "s": 17.149, "p": [0.0, 2.7, -1.5], "r": [0, 0, 0]};
const O = {"clip": "Idle", "env": 0.5};
const F = {"eyes": [[-0.12, 5.92, 5.9]], "r": 5.07, "uv": [0.5719, 0.4439], "open": 1.1, "drop": 3.4, "bulb": [313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356, 357, 358, 359, 360, 361, 362, 363, 364, 365, 366, 367, 368, 369, 370, 371, 372, 373, 374, 375, 376, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414]};
const PI = Math.PI;
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const B = (bs, k) => { const v = bs ? bs[k] : 0; return (typeof v === 'number' && v === v) ? c01(v) : 0; };
const sm = (s, k, v, a) => { const p = s[k]; return (s[k] = p === undefined ? v : p + (v - p) * a); };

export default async function build(THREE, h) {
  const { g, model } = await loadHead(THREE, h, new URL('./monster_cyclops.glb', import.meta.url).href, P, O, 'monster_cyclops');
  const u = g.userData;
  // ossi: la bocca e le sopracciglia le comandi tu (l'animazione di attesa non le tocca più)
  const keep = new Set(['Mouth', 'EyebrowL', 'EyebrowR', 'Eyebrow.L', 'Eyebrow.R']);
  if (u.mixer) {
    const act = u.mixer._actions[0];
    if (act) { const clip = act.getClip(); clip.tracks = clip.tracks.filter((t) => !keep.has(t.name.split('.')[0]) && !keep.has(t.name.split('.').slice(0, 2).join('.'))); }
  }
  const bone = (n) => model.getObjectByName(n);
  u.mouth = bone('Mouth'); u.m0 = u.mouth.position.clone(); u.ms0 = u.mouth.scale.clone();
  u.brows = [bone('EyebrowL'), bone('EyebrowR')].filter(Boolean).map((b) => ({ b, p0: b.position.clone(), r0: b.rotation.z, side: (toCanon(THREE, g, b).elements[12] >= 0 ? 1 : -1) }));
  // scala osso → cm (per spostare gli ossi in cm)
  u.k = 1 / P.s;
  // palpebre: calotte sopra i bulbi (materiale del modello, punto della pelle), nello spazio canonico; seguono la testa
  const head = bone('Head');
  const root = new THREE.Group(); root.matrixAutoUpdate = false; root.matrix.copy(toCanon(THREE, g, head).invert()); head.add(root);
  const body = (() => { let m = null; model.traverse((o) => { if (o.isSkinnedMesh || o.isMesh) m = m || o; }); return m; })();
  const lidM = new THREE.MeshStandardMaterial({ map: body.material.map, color: body.material.color, roughness: 0.8, metalness: 0, envMapIntensity: 0.4 });
  const lidGeo = (r, cap) => {
    const geo = new THREE.SphereGeometry(r, 36, 14, 0, 2 * PI, 0, cap);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, F.uv[0], F.uv[1]);
    return geo;
  };
  const cap = PI / 2 + 0.14;
  const lin = new THREE.MeshStandardMaterial({ color: 0x141012, roughness: 0.6 });
  u.eyes = [];
  for (const c of F.eyes) {
    const e = new THREE.Group(); e.position.set(c[0], c[1], c[2]); root.add(e);
    const side = F.eyes.length === 1 ? 1 : (c[0] >= 0 ? 1 : -1);
    const r = F.r * 1.09;
    const upG = new THREE.Group(), loG = new THREE.Group(); e.add(upG, loG);
    const up = new THREE.Mesh(lidGeo(r, cap), lidM); upG.add(up);
    const lo = new THREE.Mesh(lidGeo(r * 0.995, cap), lidM); lo.rotation.z = PI; loG.add(lo);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * Math.sin(cap), r * 0.045, 6, 48, PI), lin); rim.rotation.x = PI / 2; rim.position.y = r * Math.cos(cap); up.add(rim);
    // bulbo: le facce del bulbo del modello ruotano con lo sguardo (gruppo-perno al centro del bulbo)
    u.eyes.push({ upG, loG, side, open: F.open, low: 1.25 });
  }
  // bulbi del modello che guardano: si ruota la parte del bulbo con un morph (sguardo orizzontale e verticale)
  u.look = lookMorph(THREE, g, body, F.eyes, F.r, F.bulb);
  return g;
}

// morph target dello sguardo: i vertici dei bulbi ruotano attorno al loro centro (2 morph: sinistra/destra, su/giù)
function lookMorph(THREE, g, mesh, eyes, r, bulb) {
  // mesh "skinned": i vertici sono nelle unità del file; canonico = (v - P.c)·P.s + P.p → si ruota nelle unità del file
  const geo = mesh.geometry, pos = geo.attributes.position, n = pos.count;
  const dx = new Float32Array(n * 3), dy = new Float32Array(n * 3);
  const a = 0.34, ca = Math.cos(a), sa = Math.sin(a);
  const cs = eyes.map((c) => [(c[0] - P.p[0]) / P.s + P.c[0], (c[1] - P.p[1]) / P.s + P.c[1], (c[2] - P.p[2]) / P.s + P.c[2]]);
  const rr = (r * 1.25 / P.s) ** 2;
  for (const i of bulb) {   // solo i vertici dei bulbi (non le palpebre/arcate del modello)
    const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
    for (const c of cs) {
      const x = vx - c[0], y = vy - c[1], z = vz - c[2];
      if (x * x + y * y + z * z > rr) continue;
      dx[i * 3] = (x * ca + z * sa) - x; dx[i * 3 + 2] = (-x * sa + z * ca) - z;     // gira verso +x
      dy[i * 3 + 1] = (y * ca + z * sa) - y; dy[i * 3 + 2] = (-y * sa + z * ca) - z; // gira verso +y
    }
  }
  if (!geo.morphAttributes.position) geo.morphAttributes.position = [];
  const i0 = geo.morphAttributes.position.length;
  geo.morphAttributes.position.push(new THREE.Float32BufferAttribute(dx, 3), new THREE.Float32BufferAttribute(dy, 3));
  geo.morphTargetsRelative = true; mesh.updateMorphTargets();
  return { mesh, i0 };
}

export function update(g, bs, t) {
  const u = g.userData, s = u.s || (u.s = {}), k = 0.5;
  if (u.mixer) { const dt = u.t0 == null ? 0 : Math.min(0.1, Math.max(0, t - u.t0)); u.t0 = t; u.mixer.update(dt); }
  const jaw = sm(s, 'j', B(bs, 'jawOpen'), k), smile = sm(s, 's', (B(bs, 'mouthSmileLeft') + B(bs, 'mouthSmileRight')) / 2, k);
  const frown = sm(s, 'f', (B(bs, 'mouthFrownLeft') + B(bs, 'mouthFrownRight')) / 2, k);
  const pk = sm(s, 'p', Math.max(B(bs, 'mouthPucker'), B(bs, 'mouthFunnel') * 0.85), k);
  const blL = sm(s, 'bl', B(bs, 'eyeBlinkLeft'), 0.7), blR = sm(s, 'br', B(bs, 'eyeBlinkRight'), 0.7);
  const sqL = sm(s, 'ql', B(bs, 'eyeSquintLeft'), k), sqR = sm(s, 'qr', B(bs, 'eyeSquintRight'), k);
  const wi = sm(s, 'w', (B(bs, 'eyeWideLeft') + B(bs, 'eyeWideRight')) / 2, k);
  const bIn = sm(s, 'bi', B(bs, 'browInnerUp'), k), bdL = sm(s, 'dl', B(bs, 'browDownLeft'), k), bdR = sm(s, 'dr', B(bs, 'browDownRight'), k);
  const boL = sm(s, 'ol', B(bs, 'browOuterUpLeft'), k), boR = sm(s, 'or', B(bs, 'browOuterUpRight'), k);
  const lx = sm(s, 'lx', ((B(bs, 'eyeLookOutLeft') - B(bs, 'eyeLookInLeft')) + (B(bs, 'eyeLookInRight') - B(bs, 'eyeLookOutRight'))) / 2, k);
  const ly = sm(s, 'ly', ((B(bs, 'eyeLookUpLeft') + B(bs, 'eyeLookUpRight')) - (B(bs, 'eyeLookDownLeft') + B(bs, 'eyeLookDownRight'))) / 2, k);
  // bocca: l'osso scende (si apre), si allarga col sorriso, si stringe e va avanti col bacio
  const m = u.mouth;
  m.position.copy(u.m0); m.position.y -= jaw * F.drop * u.k; m.position.z += pk * 0.8 * u.k;
  m.position.y += (smile * 0.35 - frown * 0.25) * u.k;
  m.scale.set(u.ms0.x * (1 + smile * 0.12 - pk * 0.28), u.ms0.y * (1 + jaw * 0.25), u.ms0.z);
  for (const b of u.brows) {
    const R = b.side > 0, dn = R ? bdL : bdR, out = R ? boL : boR;
    b.b.position.copy(b.p0); b.b.position.y += (bIn * 0.8 + out * 0.6 - dn * 0.7) * 1.0 * u.k;
    b.b.rotation.z = b.r0 - b.side * (dn * 0.25 - bIn * 0.15);
  }
  for (const E of u.eyes) {
    const R = E.side > 0, bl = R ? blL : blR, sq = R ? sqL : sqR, bd = R ? bdL : bdR;
    const cl = c01(bl + sq * 0.35 + smile * 0.12);
    const o = E.open + wi * 0.25 - bd * 0.5;
    E.upG.rotation.x = -o + (PI / 2 + 0.08 + o) * cl;
    E.upG.rotation.z = -E.side * (bd * 0.12 - bIn * 0.06);
    E.loG.rotation.x = E.low - (E.low - 0.15) * c01(sq * 0.6 + bl * 0.3 + smile * 0.25);
  }
  const L = u.look; L.mesh.morphTargetInfluences[L.i0] = lx; L.mesh.morphTargetInfluences[L.i0 + 1] = ly;
}
