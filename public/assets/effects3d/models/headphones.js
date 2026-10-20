// Cuffie over-ear: archetto imbottito, forcelle metalliche, padiglioni con cuscinetti.
export const meta = { label: 'Cuffie', labelEn: 'Headphones', category: 'accessori', icon: '🎧' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const plastic = h.mat(0x1f2024, { roughness: .45 });
  const pad = h.mat(0x2a2b30, { roughness: .9 });
  const metal = h.mat(0xb9bcc2, { roughness: .3, metalness: .9 });
  const accent = h.mat(0xd84a3c, { roughness: .4 });

  const EAR = new THREE.Vector3(8.2, 1.0, -3.0);   // centro del padiglione (lato +X)

  // archetto: arco ellittico da padiglione a padiglione sopra la testa, sezione ovale
  const arc = [];
  for (let i = 0; i <= 64; i++) {
    const a = i / 64 * Math.PI;
    arc.push(new THREE.Vector3(Math.cos(a) * 9.3, 1.0 + Math.sin(a) * 10.6, -3.0 + 0.0));
  }
  const bandGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 96, 0.75, 12);
  // schiaccio il tubo in direzione Z per una sezione ovale (più larga che spessa)
  const bp = bandGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) { const seg = Math.floor(i / 13); const c = arc[Math.min(64, Math.round(seg / 96 * 64))]; bp.setZ(i, c.z + (bp.getZ(i) - c.z) * 1.6); }
  bandGeo.computeVertexNormals();
  g.add(new THREE.Mesh(bandGeo, plastic));
  // imbottitura superiore dell'archetto
  const padArc = arc.slice(18, 47).map(p => p.clone().multiplyScalar(1).setY(p.y - 0.45));
  const padGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(padArc), 48, 0.85, 12);
  const pp = padGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) { pp.setZ(i, -3.0 + (pp.getZ(i) + 3.0) * 1.7); }
  padGeo.computeVertexNormals();
  g.add(new THREE.Mesh(padGeo, pad));

  for (const s of [-1, 1]) {
    const e = EAR.clone(); e.x *= s;
    // forcella: barra verticale dall'archetto al padiglione
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.5, 1.4), metal); yoke.position.set(s * 9.6, 3.6, -3.0); g.add(yoke);
    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.0, 16), metal); pivot.rotation.z = Math.PI / 2; pivot.position.set(s * 9.3, 1.0, -3.0); g.add(pivot);
    // padiglione: coppa esterna bombata + anello + cuscinetto
    const cup = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(4.3, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2.4), plastic); shell.scale.set(1, 0.55, 1);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.35, 10, 48), metal);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.0;
    const cushion = new THREE.Mesh(new THREE.TorusGeometry(3.4, 1.25, 16, 48), pad); cushion.rotation.x = Math.PI / 2; cushion.position.y = -1.3;
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), accent); mesh.rotation.x = Math.PI / 2; mesh.position.y = -1.3;
    const logo = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), accent); logo.rotation.x = -Math.PI / 2; logo.position.y = 2.05;
    cup.add(shell, rim, cushion, mesh, logo);
    // orienta: l'asse Y della coppa punta verso l'esterno (+X per s=1)
    cup.rotation.z = -s * Math.PI / 2;
    cup.rotation.y = s * 0.0;
    cup.position.copy(e).add(new THREE.Vector3(s * 1.4, 0, 0));
    g.add(cup);
  }
  return g;
}
