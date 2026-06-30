import * as THREE from 'three';

/**
 * A treasure chest with a hinged lid that animates open/closed. Built from
 * primitives: a wooden body and lid with gold bands and a lock. `open()` /
 * `close()` set the target; `update(delta)` eases the lid toward it.
 */
export class Chest {
  constructor() {
    this.group = new THREE.Group();
    this.openAmount = 0;
    this.targetOpen = 0;

    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.85 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x4f3620, roughness: 0.9 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.4, metalness: 0.5 });

    const W = 1.2; // width (x)
    const D = 0.8; // depth (z)
    const baseH = 0.55;

    // Body.
    const base = new THREE.Mesh(new THREE.BoxGeometry(W, baseH, D), wood);
    base.position.y = baseH / 2;
    this.group.add(base);
    // Gold bands around the body.
    for (const bx of [-W / 2 + 0.08, W / 2 - 0.08]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, baseH + 0.02, D + 0.02), gold);
      band.position.set(bx, baseH / 2, 0);
      this.group.add(band);
    }

    // Lid on a hinge at the back-top edge (z = -D/2).
    this.lid = new THREE.Group();
    this.lid.position.set(0, baseH, -D / 2);
    this.group.add(this.lid);

    const lidH = 0.28;
    const lidShape = new THREE.Mesh(new THREE.BoxGeometry(W, lidH, D), woodDark);
    lidShape.position.set(0, lidH / 2, D / 2); // sit on top, centred over the body
    this.lid.add(lidShape);
    for (const bx of [-W / 2 + 0.08, W / 2 - 0.08]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, lidH + 0.02, D + 0.02), gold);
      band.position.set(bx, lidH / 2, D / 2);
      this.lid.add(band);
    }

    // Lock plate on the front of the lid.
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.08), gold);
    lock.position.set(0, lidH / 2, D + 0.02);
    this.lid.add(lock);

    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
  }

  setPosition(x, z, angleY = 0) {
    this.x = x;
    this.z = z;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = angleY;
  }

  open() {
    this.targetOpen = 1;
  }

  close() {
    this.targetOpen = 0;
  }

  get isOpen() {
    return this.openAmount > 0.5;
  }

  update(delta) {
    this.openAmount += (this.targetOpen - this.openAmount) * Math.min(1, delta * 9);
    // Rotate the lid back on its hinge (open ≈ 100°).
    this.lid.rotation.x = -this.openAmount * 1.75;
  }
}
