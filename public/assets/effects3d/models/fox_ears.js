// Orecchie da volpe: orecchie alte arancioni con punta nera e interno bianco, su cerchietto.
export const meta = { label: 'Orecchie da volpe', labelEn: 'Fox ears', category: 'costumi', icon: '🦊' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const orange = h.mat(0xe0702a, { roughness: .95 });
  const white = h.mat(0xf8f4ec, { roughness: .95 });
  const black = h.mat(0x1f1a18, { roughness: .95 });

  const band = [];
  // cerchietto sopra i CAPELLI veri (che sporgono 2–4 cm oltre il cranio): arco largo 8.6, colmo a y≈13.8;
  // sezione schiacciata (larga 1.1 cm in profondità, spessa 0.7) come un cerchietto vero
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI; band.push(new THREE.Vector3(Math.cos(a) * 8.6, 1.0 + Math.sin(a) * 12.8, -3.0)); }
  g.add(new THREE.Mesh((() => { const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(band), 72, 0.35, 10); const p = tg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -3.0 + (p.getZ(i) + 3.0) * 1.6); tg.computeVertexNormals(); return tg; })(), orange));

  const tri = (w, hgt, round) => {
    const s = new THREE.Shape();
    s.moveTo(-w, 0); s.lineTo(w, 0); s.quadraticCurveTo(w * 0.6, hgt * 0.5, round, hgt); s.quadraticCurveTo(-round, hgt, -w * 0.6, hgt * 0.5); s.closePath();
    return s;
  };
  const ear = (s) => {
    const e = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ExtrudeGeometry(tri(3.0, 7.6, 0.3), { depth: 1.0, bevelEnabled: true, bevelSize: .3, bevelThickness: .25, bevelSegments: 3, curveSegments: 12 }), orange); outer.position.z = -0.5;
    const inner = new THREE.Mesh(new THREE.ExtrudeGeometry(tri(1.8, 5.0, 0.2), { depth: 0.3, bevelEnabled: true, bevelSize: .12, bevelThickness: .1, bevelSegments: 2, curveSegments: 12 }), white); inner.position.set(0, 0.6, 0.5);
    // punta nera: piccolo triangolo che copre la cima
    const tip = new THREE.Mesh(new THREE.ExtrudeGeometry(tri(1.25, 2.6, 0.28), { depth: 1.15, bevelEnabled: true, bevelSize: .32, bevelThickness: .25, bevelSegments: 3, curveSegments: 10 }), black); tip.position.set(0, 5.35, -0.55);
    e.add(outer, inner, tip);
    e.position.set(s * 4.4, 11.6, -3.0);
    e.rotation.z = -s * 0.3; e.rotation.y = s * 0.3; e.rotation.x = -0.1;
    return e;
  };
  const eL = ear(1), eR = ear(-1);
  g.add(eL, eR); g.userData.ears = [eL, eR];
  return g;
}

export function update(g, bs, t) {
  const [a, b] = g.userData.ears;
  const w = Math.sin(t * 2.2) * 0.04;
  a.rotation.z = -0.3 + w; b.rotation.z = 0.3 - w;
}
