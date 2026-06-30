import * as THREE from 'three';

/**
 * A mounted knight: a horse (with animated gallop legs) and an armoured rider
 * carrying a lance and shield. Built from primitives, facing +Z (forward).
 *
 * `update(delta, t, { moving, charging })` animates the gallop and lowers the
 * lance to a couched (horizontal) position while charging.
 */
export class Knight {
  constructor() {
    this.group = new THREE.Group();

    const horse = new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.85 });
    const horseDark = new THREE.MeshStandardMaterial({ color: 0x402a18, roughness: 0.9 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xb3b8c2, roughness: 0.45, metalness: 0.6 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x3550a0, roughness: 0.8 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.8 });
    const red = new THREE.MeshStandardMaterial({ color: 0x9c2b2b, roughness: 0.7 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.4, metalness: 0.5 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe0ac79, roughness: 0.8 });

    // --- Horse --------------------------------------------------------------
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 1.9), horse);
    body.position.set(0, 1.15, 0);
    this.group.add(body);

    // Neck + head at the front (+Z).
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.34), horse);
    neck.position.set(0, 1.65, 0.95);
    neck.rotation.x = 0.5;
    this.group.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.6), horse);
    head.position.set(0, 2.05, 1.25);
    this.group.add(head);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.08), horse);
      ear.position.set(sx * 0.1, 2.25, 1.1);
      this.group.add(ear);
    }

    // Tail at the back (-Z).
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), horseDark);
    tail.position.set(0, 1.2, -1.0);
    tail.rotation.x = -0.5;
    this.group.add(tail);

    // Legs (pivots at the hips/shoulders so they swing).
    this.legs = [];
    const legPos = [
      [-0.26, 0.75], [0.26, 0.75], [-0.26, -0.7], [0.26, -0.7],
    ];
    for (const [lx, lz] of legPos) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 0.85, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.16), horseDark);
      leg.position.y = -0.45;
      pivot.add(leg);
      this.group.add(pivot);
      this.legs.push(pivot);
    }

    // --- Rider (seated on the horse's back) ---------------------------------
    const rider = new THREE.Group();
    rider.position.set(0, 1.6, -0.05);
    this.group.add(rider);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.32), steel);
    torso.position.y = 0.4;
    rider.add(torso);
    // Surcoat skirt over the saddle.
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.5), cloth);
    skirt.position.y = 0.0;
    rider.add(skirt);

    const rhead = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skin);
    rhead.position.y = 0.86;
    rider.add(rhead);
    // Helmet with a small plume.
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.34), steel);
    helm.position.y = 1.0;
    rider.add(helm);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 6), red);
    plume.position.y = 1.25;
    rider.add(plume);

    // Legs astride the horse.
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.3), steel);
      leg.position.set(sx * 0.22, -0.05, 0.0);
      leg.rotation.x = 0.3;
      rider.add(leg);
    }

    // Shield on the left arm.
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.45), red);
    shield.position.set(-0.36, 0.4, 0.18);
    shield.rotation.y = 0.2;
    rider.add(shield);
    const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.12), gold);
    emblem.position.set(-0.4, 0.42, 0.18);
    emblem.rotation.y = 0.2;
    rider.add(emblem);

    // Lance on a pivot at the right hand (rest = raised; charge = couched).
    this.lancePivot = new THREE.Group();
    this.lancePivot.position.set(0.34, 0.45, 0.2);
    this.restAngle = 0.85;
    this.lancePivot.rotation.x = this.restAngle;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 3.0, 8), wood);
    pole.rotation.x = Math.PI / 2; // lie along +Z
    pole.position.z = 1.4;
    this.lancePivot.add(pole);
    const vamplate = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 10), steel);
    vamplate.rotation.x = -Math.PI / 2;
    vamplate.position.z = 0.5;
    this.lancePivot.add(vamplate);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.34, 8), steel);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 3.05;
    this.lancePivot.add(tip);
    rider.add(this.lancePivot);

    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });

    this.group.visible = false;
  }

  setPosition(x, z, angleY = 0) {
    this.x = x;
    this.z = z;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = angleY;
  }

  update(delta, t, { moving = false, charging = false } = {}) {
    const freq = charging ? 20 : 13;
    if (moving) {
      const s = Math.sin(t * freq) * 0.7;
      this.legs[0].rotation.x = s;
      this.legs[3].rotation.x = s;
      this.legs[1].rotation.x = -s;
      this.legs[2].rotation.x = -s;
      this.group.position.y = Math.abs(Math.sin(t * freq)) * 0.12;
    } else {
      for (const leg of this.legs) leg.rotation.x += (0 - leg.rotation.x) * 0.15;
      this.group.position.y += (0 - this.group.position.y) * 0.2;
    }

    // Lower the lance to couched (horizontal) while charging.
    const target = charging ? -0.02 : this.restAngle;
    this.lancePivot.rotation.x += (target - this.lancePivot.rotation.x) * Math.min(1, delta * 8);
  }
}
