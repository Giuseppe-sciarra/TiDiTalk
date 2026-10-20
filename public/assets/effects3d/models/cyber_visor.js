// Visore cyberpunk: unica fascia curva scura con banda neon ciano pulsante e astine fino alle orecchie.
export const meta = { label: 'Visore cyber', labelEn: 'Cyber visor', category: 'accessori', icon: '🤖' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const neon = new THREE.MeshStandardMaterial({ color: 0x22e8ff, emissive: 0x11d0ff, emissiveIntensity: 1.4, roughness: .2 });
  const shellMat = new THREE.MeshPhysicalMaterial({ color: 0x15181f, roughness: .15, metalness: .4, clearcoat: 1, transparent: true, opacity: .9 });

  // cilindro che passa per il ponte del naso (z≈6.3) e le tempie (±7.4, z≈-2.4): centro z=-1.2, raggio 7.5
  const R = 7.6, CZ = -1.0, span = Math.PI * 0.45;   // ±81° attorno al davanti
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 3.0, 64, 1, true, -span, span * 2), shellMat);
  shell.position.set(0, 3.1, CZ);
  g.add(shell);
  // bordi superiore/inferiore (più spessi)
  for (const yy of [-1.5, 1.5]) {
    const edge = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.12, R + 0.12, 0.35, 64, 1, true, -span, span * 2), h.mat(0x2a2f3a, { roughness: .3, metalness: .7 }));
    edge.position.set(0, 3.1 + yy, CZ); g.add(edge);
  }
  // banda neon centrale (sottile striscia luminosa)
  const strip = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.08, R + 0.08, 0.45, 64, 1, true, -span * 0.95, span * 1.9), neon);
  strip.position.set(0, 3.15, CZ); g.add(strip);
  // seconda linea più sottile in basso
  const strip2 = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.08, R + 0.08, 0.12, 64, 1, true, -span * 0.9, span * 1.8), neon);
  strip2.position.set(0, 2.2, CZ); g.add(strip2);
  // astine laterali fino all'orecchio e "moduli" alle tempie
  for (const s of [-1, 1]) {
    const ax = Math.sin(span) * R * s, az = CZ + Math.cos(span) * R;
    const mod = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.6, 1.8), h.mat(0x2a2f3a, { roughness: .3, metalness: .7 }));
    mod.position.set(ax + s * 0.2, 3.1, az); mod.rotation.y = -s * span; g.add(mod);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), neon); led.position.set(ax + s * 0.75, 3.7, az + 0.3); g.add(led);
    const pts = [[ax + s * 0.3, 3.0, az - 0.6], [s * 7.6, 2.3, -1.0], [s * 7.5, 2.0, -2.6], [s * 7.3, 0.9, -4.0]];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 24, 0.2, 8), h.mat(0x2a2f3a, { roughness: .3, metalness: .7 })));
  }
  g.userData.neon = neon;
  // occlusore del viso (solo profondità, rigido, rientrato di 0.3 cm): nell'app l'occlusore del viso è nel passaggio
  // trasparente e non nasconde gli oggetti opachi, quindi girando la testa l'asta lontana si vedrebbe attraverso la guancia
  { const f = h.face, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
    const pp = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * 0.3, pp.getY(i) - nn.getY(i) * 0.3, pp.getZ(i) - nn.getZ(i) * 0.3);
    const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder'; g.add(occ); }
  return g;
}

export function update(g, bs, t) {
  g.userData.neon.emissiveIntensity = 1.0 + 0.6 * (0.5 + 0.5 * Math.sin(t * 3.0));
}
