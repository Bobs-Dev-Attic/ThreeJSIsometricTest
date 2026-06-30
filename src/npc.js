import * as THREE from 'three';

/**
 * A fisherman NPC who stands on the bridge with a rod, line and a bobber that
 * bobs on the water. Built from primitives (like the player) but visually
 * distinct: a straw hat and a brown coat. Faces +X (out over the water beside
 * the bridge). `update()` drives gentle idle/breathing motion, an occasional
 * rod twitch and the bobbing line.
 */
export class Fisherman {
  constructor({ deckSurface = 0.6 } = {}) {
    this.group = new THREE.Group();
    this.deckSurface = deckSurface;
    this.twitch = 0;
    this.twitchTimer = 1 + Math.random() * 3;

    const skin = new THREE.MeshStandardMaterial({ color: 0xe0ac79, roughness: 0.8 });
    const coat = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.8 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x46525c, roughness: 0.85 });
    const straw = new THREE.MeshStandardMaterial({ color: 0xcbb069, roughness: 0.9 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.35), coat);
    torso.position.y = 1.15;
    this.group.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
    head.position.y = 1.74;
    this.group.add(head);

    // Straw hat (brim + cone).
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12), straw);
    brim.position.y = 1.97;
    this.group.add(brim);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.26, 12), straw);
    cone.position.y = 2.12;
    this.group.add(cone);

    // Legs.
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), pants);
      leg.position.set(sx * 0.16, 0.43, 0);
      this.group.add(leg);
    }

    // Arms held forward to grip the rod (pivots rotated to point forward).
    this.arms = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.4, 1.45, 0);
      pivot.rotation.x = -1.3; // swing forward
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), coat);
      arm.position.y = -0.3;
      pivot.add(arm);
      this.group.add(pivot);
      this.arms.push(pivot);
    }

    // Fishing rod: a long thin box angled up and forward from the hands.
    this.rod = new THREE.Group();
    this.rod.position.set(0, 1.35, 0.45);
    this.rod.rotation.x = 0.5;
    const rodMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 2.2), new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.7 }));
    rodMesh.position.z = 1.0;
    this.rod.add(rodMesh);
    this.group.add(this.rod);

    // Rod tip (local) — where the line is tied.
    this.rodTip = new THREE.Vector3(0, 1.93, 1.46);

    // Bobber floating on the water beyond the railing (local coords).
    this.bobberBaseY = 0.15 - deckSurface;
    this.bobber = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.14, 8),
      new THREE.MeshStandardMaterial({ color: 0xd0352b, emissive: 0x300806, roughness: 0.6 })
    );
    this.bobber.position.set(0, this.bobberBaseY, 2.6);
    this.group.add(this.bobber);

    // Fishing line from rod tip to bobber.
    const lineGeo = new THREE.BufferGeometry().setFromPoints([this.rodTip.clone(), this.bobber.position.clone()]);
    this.lineGeo = lineGeo;
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.6 }));
    this.group.add(line);

    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
  }

  setPosition(x, z, angleY = Math.PI / 2) {
    this.x = x;
    this.z = z;
    this.group.position.set(x, this.deckSurface, z);
    this.group.rotation.y = angleY;
  }

  update(delta, t) {
    // Breathing bob.
    this.group.position.y = this.deckSurface + Math.sin(t * 1.5) * 0.02;

    // Occasional rod twitch (a "bite").
    this.twitchTimer -= delta;
    if (this.twitchTimer <= 0) {
      this.twitch = 1;
      this.twitchTimer = 2 + Math.random() * 4;
    }
    this.twitch += (0 - this.twitch) * Math.min(1, delta * 4);
    this.rod.rotation.x = 0.5 + this.twitch * Math.sin(t * 30) * 0.12;

    // Bobber bobs on the water; tug a little harder during a twitch.
    const by = this.bobberBaseY + Math.sin(t * 2.5) * 0.04 - this.twitch * 0.06;
    this.bobber.position.y = by;

    // Keep the line attached between rod tip and bobber.
    const p = this.lineGeo.attributes.position;
    p.setXYZ(0, this.rodTip.x, this.rodTip.y, this.rodTip.z);
    p.setXYZ(1, this.bobber.position.x, by, this.bobber.position.z);
    p.needsUpdate = true;
  }
}
