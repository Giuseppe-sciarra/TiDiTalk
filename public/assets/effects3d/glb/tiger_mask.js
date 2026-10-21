// Tiger — Apache-2.0, Jeeliz (jeelizFaceFilter demos)
// Modello: tiger_mask.glb (Jeeliz FaceFilter, Apache-2.0). 1.8.0: la mascherina ha i fori di occhi e bocca (dentro si
// vede il tuo viso): il mento bianco scende quando apri la bocca e il taglio della bocca si allarga col sorriso; le
// palpebre a strisce scendono sui fori degli occhi quando li chiudi/strizzi; le arcate si aggrottano col broncio;
// i baffi vibrano un poco quando parli.
import { loadHead, toCanon } from './_glbhead.js';
export const meta = {"label": "Tigre", "labelEn": "Tiger", "category": "personaggi", "icon": "🐯"};
export const hideHead = true;
const P = {"c": [0.0, 0.37397, -0.06431], "s": 14.553, "p": [0.0, 2.7, 0.0], "r": [0, 0, 0]};
const O = {"hideMats": ["eyes"], "env": 0.5};
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const B = (bs, k) => { const v = bs ? bs[k] : 0; return (typeof v === 'number' && v === v) ? c01(v) : 0; };
const sm = (s, k, v, a) => { const p = s[k]; return (s[k] = p === undefined ? v : p + (v - p) * a); };
const ss = (a, b, x) => { const t = c01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// morph per vertice: fn(x,y,z) → [dx,dy,dz] in cm (canonico), oppure null
function morph(THREE, g, mesh, fn) {
  const geo = mesh.geometry, pos = geo.attributes.position, n = pos.count;
  const M = toCanon(THREE, g, mesh), Mi = new THREE.Matrix3().setFromMatrix4(M).invert();
  const v = new THREE.Vector3(), d = new THREE.Vector3(), out = new Float32Array(n * 3);
  let any = false;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(M);
    const r = fn(v.x, v.y, v.z); if (!r) continue;
    d.set(r[0], r[1], r[2]).applyMatrix3(Mi); any = true;
    out[i * 3] = d.x; out[i * 3 + 1] = d.y; out[i * 3 + 2] = d.z;
  }
  if (!geo.morphAttributes.position) geo.morphAttributes.position = [];
  geo.morphAttributes.position.push(new THREE.Float32BufferAttribute(out, 3));
  geo.morphTargetsRelative = true;
  return geo.morphAttributes.position.length - 1;
}

export default async function build(THREE, h) {
  const { g, model } = await loadHead(THREE, h, new URL('./tiger_mask.glb', import.meta.url).href, P, O, 'tiger_mask');
  const u = g.userData; u.m = [];
  model.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const name = [].concat(o.material)[0].name || '';
    // bocca: foro a y≈-5.4 (x ±3.4); il mento (sotto) scende, il labbro sopra sale un filo; ai lati si apre col sorriso
    const iJaw = morph(THREE, g, o, (x, y, z) => { const f = ss(4, 9, z) * (1 - ss(5, 9, Math.abs(x))); if (f <= 0) return null; const lo = ss(-4.9, -6.4, y) * (1 - ss(-12, -15, y) * 0.5); const up = ss(-5.9, -4.6, y) * (1 - ss(-3.6, -2.4, y)); return [0, (-lo * 3.0 + up * 0.45) * f, -lo * 0.5 * f]; });
    const iWide = morph(THREE, g, o, (x, y, z) => { const f = ss(4, 9, z) * ss(-2.8, -4.8, y) * (1 - ss(-7, -9, y)) * ss(0.5, 3, Math.abs(x)); if (f <= 0) return null; return [Math.sign(x) * 0.9 * f, 0.8 * f, 0]; });
    // occhi: fori a (±7, 5.3); il bordo alto scende fino a chiuderli
    const eye = (sd) => morph(THREE, g, o, (x, y, z) => { if (Math.sign(x) !== sd || z < 3) return null; const dx = Math.abs(x) - 6.9; const f = Math.max(0, 1 - (dx / 4.2) ** 2) ** 0.5 * ss(4.0, 5.6, y) * (1 - ss(8.4, 10.6, y)); if (f <= 0) return null; return [0, -(y - 3.4) * 0.96 * f, 0.25 * f]; });
    const iER = eye(1), iEL = eye(-1);
    const brow = morph(THREE, g, o, (x, y, z) => { if (z < 3) return null; const f = ss(6.5, 8.5, y) * (1 - ss(11, 13, y)) * ss(1.5, 3.5, Math.abs(x)) * (1 - ss(10, 12, Math.abs(x))); if (f <= 0) return null; return [0, -1.1 * f * (1 - (Math.abs(x) - 2) / 12), 0.2 * f]; });
    o.updateMorphTargets();
    u.m.push({ o, iJaw, iWide, iER, iEL, brow, whisk: name === 'whiskers' });
  });
  return g;
}

export function update(g, bs, t) {
  const u = g.userData, s = u.s || (u.s = {}), k = 0.5;
  const jaw = sm(s, 'j', B(bs, 'jawOpen'), k), smile = sm(s, 's', (B(bs, 'mouthSmileLeft') + B(bs, 'mouthSmileRight')) / 2, k);
  const pk = sm(s, 'p', Math.max(B(bs, 'mouthPucker'), B(bs, 'mouthFunnel') * 0.85), k);
  const blL = sm(s, 'bl', c01(B(bs, 'eyeBlinkLeft') + B(bs, 'eyeSquintLeft') * 0.45), 0.7), blR = sm(s, 'br', c01(B(bs, 'eyeBlinkRight') + B(bs, 'eyeSquintRight') * 0.45), 0.7);
  const bd = sm(s, 'bd', (B(bs, 'browDownLeft') + B(bs, 'browDownRight')) / 2, k);
  for (const m of u.m) {
    const I = m.o.morphTargetInfluences;
    I[m.iJaw] = jaw * (1 - pk * 0.5); I[m.iWide] = smile * (1 - pk); I[m.iER] = blL; I[m.iEL] = blR; I[m.brow] = bd;
    if (m.whisk) m.o.rotation.z = Math.sin(t * 18) * 0.012 * jaw;
  }
}
