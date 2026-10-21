// Testa di zucca — intagli luminosi che copiano gli occhi e la bocca (fxchars 1.8.0, kit in _kit.js)
import { PI, reg, mkRoot, HEAD_FIT, kitUpdate, M, glossMat, PM, ell, surf, horn, rigidBrow, spring } from './_kit.js';

export const meta = { label: 'Testa di zucca', labelEn: 'Pumpkin head', labelFr: 'Tête de citrouille', labelDe: 'Kürbiskopf', category: 'personaggi', icon: '🎃' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group(); const P = reg(g);
  const root = mkRoot(THREE, g, HEAD_FIT);
  const orange = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#f8a038'); gr.addColorStop(1, '#b84c0c'); x.fillStyle = gr; x.fillRect(0, 0, 4, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(), roughness: .5, clearcoat: .4, clearcoatRoughness: .4 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd060, emissive: 0xffa020, emissiveIntensity: 1.6, roughness: .6, side: THREE.DoubleSide });
  const inside = M(h, 0x4a1c06, { roughness: .9 });
  // zucca a spicchi
  const C = [0, 0.4, -2.6], R = 12.2, RY = 12.8;
  const surfR = (th) => 1 + .055 * Math.cos(th * 10) - .015;
  const pump = surf(THREE, 140, 48, (u, v) => {
    const th = u * 2 * PI, ph = v * PI; const sh = ph < PI / 2 ? Math.pow(Math.sin(2 * ph), 2) : 0; const k = surfR(th) * (1 - (ph < PI / 2 ? .03 : .1) * Math.pow(Math.cos(ph), 8)) * (1 + .1 * sh);
    return [C[0] + R * k * Math.sin(ph) * Math.sin(th), C[1] + RY * Math.cos(ph) * (1 - .04 * Math.sin(ph)), C[2] + R * k * Math.sin(ph) * Math.cos(th)];
  });
  root.add(new THREE.Mesh(pump, orange));
  const front = (x, y) => { const ph = Math.acos(Math.max(-1, Math.min(1, (y - C[1]) / RY))); const s = Math.sin(ph) * R; const th = Math.asin(Math.max(-1, Math.min(1, x / Math.max(1, s * .98)))); const z = C[2] + s * surfR(th) * Math.cos(th); return { z, ry: th, rx: -(PI / 2 - ph) * .8 }; };
  // intaglio: forma luminosa + bordo scuro (la buccia tagliata)
  const conform = (geo, x, y, dz) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const X = x + p.getX(i), Y = y + p.getY(i); p.setZ(i, front(X, Y).z + dz + p.getZ(i) * .6); } geo.computeVertexNormals(); return geo; };
  const carve = (shape, x, y, depth) => {
    const grp = new THREE.Group(); grp.position.set(x, y, 0);
    const mk = () => new THREE.ExtrudeGeometry(shape, { depth: depth || .6, bevelEnabled: true, bevelThickness: .15, bevelSize: .15, bevelSegments: 2, curveSegments: 10 });
    const m = new THREE.Mesh(conform(mk(), x, y, .06), glow); grp.add(m); m.renderOrder = 1;
    const g2 = mk(); g2.scale(1.14, 1.14, .5); const rimS = new THREE.Mesh(conform(g2, x, y, -.02), inside); grp.add(rimS);
    root.add(grp); return grp;
  };
  // occhi triangolari: si chiudono schiacciandosi, si strizzano, si sgranano
  const tri = new THREE.Shape(); tri.moveTo(-1.9, -1.2); tri.lineTo(1.9, -1.2); tri.lineTo(0, 1.9); tri.closePath();
  const eyes = [];
  for (const sd of [1, -1]) { const e = carve(tri, sd * 4.0, 3.0); e.rotation.z = sd * -.12; eyes.push({ e, sd, rz: e.rotation.z }); }
  const nT = new THREE.Shape(); nT.moveTo(-.9, -.7); nT.lineTo(.9, -.7); nT.lineTo(0, .9); nT.closePath(); carve(nT, 0, -1.0);
  // bocca a dentoni: due metà (sopra/sotto) che si aprono davvero, col buio dentro
  const W = 5.6;
  const top = new THREE.Shape(); top.moveTo(-W, 1.2); top.quadraticCurveTo(0, -.6, W, 1.2); top.lineTo(W - .5, .2); top.lineTo(2.6, -.4); top.lineTo(2.0, -1.4); top.lineTo(1.2, -.6); top.lineTo(-1.2, -.6); top.lineTo(-2.0, -1.4); top.lineTo(-2.6, -.4); top.lineTo(-W + .5, .2); top.closePath();
  const bot = new THREE.Shape(); bot.moveTo(-W + .6, -.6); bot.lineTo(-1.0, -1.4); bot.lineTo(-.4, -.4); bot.lineTo(.4, -.4); bot.lineTo(1.0, -1.4); bot.lineTo(W - .6, -.6); bot.quadraticCurveTo(0, -4.2, -W + .6, -.6); bot.closePath();
  const mT = carve(top, 0, -5.4, .6), mB = carve(bot, 0, -5.6, .6);
  // buio della bocca aperta: ovale appoggiato sulla buccia, rifatto quando si apre
  const darkG = surf(THREE, 24, 8, (u, v) => [0, 0, 0], false), dp = darkG.attributes.position;
  const dark = new THREE.Mesh(darkG, new THREE.MeshBasicMaterial({ color: 0x1a0802, side: THREE.DoubleSide })); root.add(dark);
  let lastD = -1;
  const setDark = (sx, sy, cy) => { for (let j = 0, k = 0; j <= 8; j++) for (let i = 0; i <= 24; i++, k++) { const a = i / 24 * 2 * PI, r = j / 8, x = Math.cos(a) * r * sx, y = cy + Math.sin(a) * r * sy; dp.setXYZ(k, x, y, front(x, y).z + .02); } dp.needsUpdate = true; darkG.computeBoundingSphere(); };
  // sopracciglia: foglioline sopra gli occhi
  for (const sd of [1, -1]) root.add(rigidBrow(THREE, h, P, { side: sd, x: sd * 4.1, y: 6.4, z: front(sd * 4.1, 6.4).z + .2, w: 3.4, th: .42, mat: PM(THREE, 0x3e7a22, { roughness: .5, clearcoat: .3 }), rz: sd * -.15, arch: .7, k: 1.2 }));
  // picciolo + foglia + viticcio (molla)
  const stemG = new THREE.Group(); stemG.position.set(0, 12.0, -2.6); root.add(stemG);
  stemG.add(horn(THREE, PM(THREE, 0x6a5a2a, { roughness: .7 }), [[0, -.2, 0], [.4, 2.4, .2], [1.6, 3.8, 1.0]], 1.3, .7, 12));
  const leaf = PM(THREE, 0x4f8a2a, { roughness: .5, side: THREE.DoubleSide, sheen: .3 });
  const lf = ell(THREE, leaf, 3.4, .25, 2.0, -3.2, .8, 1.6, 18); lf.rotation.set(.3, .5, -.35); stemG.add(lf);
  spring(P, stemG, { k: 60, c: 5, drive: [.1, .08, .14], max: .3 });
  P.fx.push((s, t) => {
    for (const { e, sd, rz } of eyes) {
      const b = sd > 0 ? s.blinkL : s.blinkR, w = sd > 0 ? s.wideL : s.wideR, q = sd > 0 ? s.squintL : s.squintR, dn = sd > 0 ? s.browDnL : s.browDnR;
      e.scale.set(1 + w * .15 - q * .05, Math.max(.06, 1 - b * .94 - q * .35 + w * .3) * (1 - dn * .2), 1);
      e.rotation.z = rz + sd * (dn * .25 - s.browIn * .15);
      e.position.x = sd * 4.0 + s.lookX * .4; e.position.y = 3.0 + s.lookY * .3;
    }
    const sm = s.smile, j = s.jaw, pk = s.pucker;
    mT.scale.set(1 + sm * .12 - pk * .45, 1 + sm * .15, 1); mB.scale.set(1 + sm * .12 - pk * .45, .9 + j * 1.0 + sm * .2, 1);
    mT.position.y = -5.4 + sm * .5 + j * .5; mB.position.y = -5.6 - j * 1.8 + sm * .3;
    const key = j * 10 + sm + pk * 3; if (Math.abs(key - lastD) > .01) { lastD = key; setDark(W * .82 * (1 + sm * .1 - pk * .45), .15 + j * 1.9, -6.2 - j * .8); }
    glow.emissiveIntensity = 1.4 + .25 * Math.sin(t * 7) + .15 * Math.sin(t * 13) + j * .6 + s.smile * .3;
  });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
