import * as THREE from 'three';

/**
 * A big bear built from primitives. Starts sleeping (low, slow breathing) at
 * the back of the cave; `wake()` raises it, and it does a small lunge when it
 * attacks. Combat itself is resolved in the turn-based UI.
 */
export class Bear {
  constructor() {
    this.group = new THREE.Group();
    this.t = 0;
    this.awake = false;
    this.lunge = 0;

    const fur = new THREE.MeshStandardMaterial({ color: 0x3b2a1d, roughness: 0.95 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x241812, roughness: 0.95 });
    const snoutMat = new THREE.MeshStandardMaterial({ color: 0x5a4433, roughness: 0.9 });

    this.body = new THREE.Group();
    this.group.add(this.body);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.15, 2.2), fur);
    torso.position.y = 1.1;
    this.body.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.85, 0.9), fur);
    head.position.set(0, 1.5, 1.35);
    this.body.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.5), snoutMat);
    snout.position.set(0, 1.35, 1.85);
    this.body.add(snout);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.14), fur);
      ear.position.set(sx * 0.32, 2.0, 1.25);
      this.body.add(ear);
    }

    this.legs = [];
    const legPos = [
      [-0.45, 0.85], [0.45, 0.85], [-0.45, -0.85], [0.45, -0.85],
    ];
    for (const [lx, lz] of legPos) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 0.75, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.8, 0.36), dark);
      leg.position.y = -0.4;
      pivot.add(leg);
      this.body.add(pivot);
      this.legs.push(pivot);
    }

    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });

    this._applySleep();
  }

  setPosition(x, z, angleY = 0) {
    this.x = x;
    this.z = z;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = angleY;
  }

  _applySleep() {
    // Lie low, curled down.
    this.body.position.y = -0.55;
    this.body.rotation.x = 0.12;
  }

  wake() {
    this.awake = true;
  }

  die() {
    this.dead = true;
  }

  attackAnim() {
    this.lunge = 1;
  }

  update(delta, t) {
    this.t += delta;
    if (this.dead) {
      // Topple over.
      this.group.rotation.z += (Math.PI / 2 - this.group.rotation.z) * Math.min(1, delta * 3);
      return;
    }
    if (!this.awake) {
      // Slow breathing while asleep.
      this.body.position.y = -0.55 + Math.sin(this.t * 1.2) * 0.05;
      return;
    }
    // Rise up when awake.
    this.body.position.y += (0 - this.body.position.y) * Math.min(1, delta * 4);
    this.body.rotation.x += (0 - this.body.rotation.x) * Math.min(1, delta * 4);
    // Menacing sway + lunge on attack.
    this.lunge += (0 - this.lunge) * Math.min(1, delta * 5);
    this.body.position.z = this.lunge * 0.6 + Math.sin(this.t * 3) * 0.03;
    const sway = Math.sin(this.t * 4) * 0.15;
    this.legs[0].rotation.x = sway;
    this.legs[3].rotation.x = sway;
    this.legs[1].rotation.x = -sway;
    this.legs[2].rotation.x = -sway;
  }
}
