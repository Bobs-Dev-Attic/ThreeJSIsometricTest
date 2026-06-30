import * as THREE from 'three';

// Deterministic PRNG so wildlife placement is stable between reloads.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/**
 * Ground animal that wanders the forest using the same navigation grid as the
 * player, so it routes around trees and never crosses the stream off the
 * bridge. Subclasses build the mesh and provide the gait animation.
 */
class GroundAnimal {
  constructor(nav, region, rand, opts) {
    this.nav = nav;
    this.region = region;
    this.rand = rand;
    this.speed = opts.speed;
    this.minPause = opts.minPause;
    this.maxPause = opts.maxPause;
    this.reach = opts.reach ?? Infinity;
    this.baseY = opts.baseY ?? 0;

    this.group = new THREE.Group();
    this.angle = rand() * Math.PI * 2;
    this.path = null;
    this.pathIndex = 0;
    this.pause = rand() * opts.maxPause;

    this._place();
  }

  _randPoint() {
    const r = this.region;
    if (this.reach !== Infinity && this.x !== undefined) {
      return {
        x: clamp(this.x + (this.rand() * 2 - 1) * this.reach, r.xmin, r.xmax),
        z: clamp(this.z + (this.rand() * 2 - 1) * this.reach, r.zmin, r.zmax),
      };
    }
    return {
      x: r.xmin + this.rand() * (r.xmax - r.xmin),
      z: r.zmin + this.rand() * (r.zmax - r.zmin),
    };
  }

  _place() {
    const p = this._randPoint();
    const c = this.nav.nearestWalkable(this.nav.cellX(p.x), this.nav.cellZ(p.z));
    this.x = c ? this.nav.worldX(c[0]) : p.x;
    this.z = c ? this.nav.worldZ(c[1]) : p.z;
    this.group.position.set(this.x, this.baseY, this.z);
    this.group.rotation.y = this.angle;
  }

  _pickTarget() {
    for (let k = 0; k < 8; k++) {
      const p = this._randPoint();
      const path = this.nav.findPath({ x: this.x, z: this.z }, p);
      if (path && path.length > 1) {
        this.path = path;
        this.pathIndex = 1;
        return;
      }
    }
    this.pause = this.minPause + this.rand() * (this.maxPause - this.minPause);
  }

  update(delta, t) {
    let moving = false;

    if (this.pause > 0) {
      this.pause -= delta;
    } else if (this.path) {
      let wp = this.path[this.pathIndex];
      let dx = wp.x - this.x;
      let dz = wp.z - this.z;
      let d = Math.hypot(dx, dz);
      while (d < 0.1 && this.pathIndex < this.path.length - 1) {
        this.pathIndex++;
        wp = this.path[this.pathIndex];
        dx = wp.x - this.x;
        dz = wp.z - this.z;
        d = Math.hypot(dx, dz);
      }
      if (d < 0.1 && this.pathIndex >= this.path.length - 1) {
        this.path = null;
        this.pause = this.minPause + this.rand() * (this.maxPause - this.minPause);
      } else {
        const step = Math.min(this.speed * delta, d);
        this.x += (dx / d) * step;
        this.z += (dz / d) * step;
        this.angle = lerpAngle(this.angle, Math.atan2(dx, dz), 0.15);
        moving = true;
      }
    } else {
      this._pickTarget();
    }

    this.group.position.x = this.x;
    this.group.position.z = this.z;
    this.group.rotation.y = this.angle;

    if (moving) this.animateMove(t);
    else this.animateIdle(t, delta);
    return moving;
  }

  // overridden by subclasses
  animateMove() {}
  animateIdle() {}
}

export class Deer extends GroundAnimal {
  constructor(nav, region, rand) {
    super(nav, region, rand, { speed: 2.2, minPause: 2, maxPause: 6, baseY: 0 });
    this._build(rand);
    this.grazeTimer = rand() * 4;
    this.graze = 0;
  }

  _build(rand) {
    const coat = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x6f4a28, roughness: 0.85 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 1.25), coat);
    torso.position.y = 1.0;
    this.group.add(torso);

    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 1.15, 0.55);
    this.group.add(neckPivot);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.6, 0.28), coat);
    neck.position.set(0, 0.22, 0.04);
    neck.rotation.x = -0.5;
    neckPivot.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.46), coat);
    head.position.set(0, 0.46, 0.26);
    neckPivot.add(head);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.1), dark);
      ear.position.set(sx * 0.12, 0.58, 0.18);
      neckPivot.add(ear);
    }
    this.neckPivot = neckPivot;

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.12), coat);
    tail.position.set(0, 1.1, -0.66);
    this.group.add(tail);

    this.legs = [];
    const legPos = [
      [-0.2, 0.45], [0.2, 0.45], [-0.2, -0.45], [0.2, -0.45],
    ];
    for (const [lx, lz] of legPos) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 0.75, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.78, 0.13), dark);
      leg.position.y = -0.39;
      pivot.add(leg);
      this.group.add(pivot);
      this.legs.push(pivot);
    }

    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
  }

  animateMove(t) {
    const s = Math.sin(t * 8) * 0.5;
    this.legs[0].rotation.x = s;
    this.legs[3].rotation.x = s; // diagonal pairs
    this.legs[1].rotation.x = -s;
    this.legs[2].rotation.x = -s;
    this.neckPivot.rotation.x += (0 - this.neckPivot.rotation.x) * 0.1;
    this.graze += (0 - this.graze) * 0.1;
  }

  animateIdle(t, delta) {
    for (const leg of this.legs) leg.rotation.x += (0 - leg.rotation.x) * 0.1;
    // Occasionally drop the head to graze, then lift it again.
    this.grazeTimer -= delta;
    if (this.grazeTimer <= 0) {
      this.graze = this.graze > 0.5 ? 0 : 1;
      this.grazeTimer = 2 + this.rand() * 4;
    }
    this.neckPivot.rotation.x += (this.graze * 0.9 - this.neckPivot.rotation.x) * 0.04;
  }
}

export class Squirrel extends GroundAnimal {
  constructor(nav, region, rand) {
    super(nav, region, rand, { speed: 4.5, minPause: 0.5, maxPause: 2.2, reach: 7, baseY: 0 });
    this._build();
  }

  _build() {
    const fur = new THREE.MeshStandardMaterial({ color: 0x8a4b2a, roughness: 0.85 });
    const belly = new THREE.MeshStandardMaterial({ color: 0xd8b48c, roughness: 0.85 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.3), fur);
    body.position.y = 0.18;
    this.group.add(body);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.12), belly);
    chest.position.set(0, 0.22, 0.16);
    this.group.add(chest);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), fur);
    head.position.set(0, 0.3, 0.22);
    this.group.add(head);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.03), fur);
      ear.position.set(sx * 0.05, 0.4, 0.2);
      this.group.add(ear);
    }

    // Big bushy tail curving up behind, on a pivot so it can flick.
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.16, -0.14);
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.2), fur);
    t1.position.set(0, 0.04, -0.08);
    this.tail.add(t1);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.12), fur);
    t2.position.set(0, 0.22, -0.14);
    this.tail.add(t2);
    this.group.add(this.tail);

    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
  }

  animateMove(t) {
    // Quick scampering hops + a flicking tail.
    this.group.position.y = this.baseY + Math.abs(Math.sin(t * 18)) * 0.16;
    this.tail.rotation.x = -0.3 + Math.sin(t * 20) * 0.25;
  }

  animateIdle(t) {
    this.group.position.y = this.baseY;
    this.tail.rotation.x = -0.4 + Math.sin(t * 4) * 0.12;
  }
}

export class Bird {
  constructor(rand, opts) {
    this.cx = opts.cx;
    this.cz = opts.cz;
    this.rx = opts.rx;
    this.rz = opts.rz;
    this.height = opts.height;
    this.speed = opts.speed;
    this.dir = rand() < 0.5 ? 1 : -1;
    this.angle = rand() * Math.PI * 2;
    this.bobPhase = rand() * Math.PI * 2;

    this.group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: opts.color, roughness: 0.7 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.5), mat);
    this.group.add(body);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), new THREE.MeshStandardMaterial({ color: 0xe0a030 }));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0, 0.32);
    this.group.add(beak);

    this.wings = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.08, 0.04, 0);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.28), mat);
      wing.position.x = side * 0.28;
      pivot.add(wing);
      this.group.add(pivot);
      this.wings.push({ pivot, side });
    }

    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
  }

  update(delta, t) {
    this.angle += this.speed * delta * this.dir;
    const x = this.cx + Math.cos(this.angle) * this.rx;
    const z = this.cz + Math.sin(this.angle) * this.rz;
    this.group.position.set(x, this.height + Math.sin(t * 1.5 + this.bobPhase) * 0.5, z);

    // Heading = tangent to the ellipse.
    const dx = -Math.sin(this.angle) * this.rx * this.dir;
    const dz = Math.cos(this.angle) * this.rz * this.dir;
    this.group.rotation.y = Math.atan2(dx, dz);

    const flap = Math.sin(t * 16) * 0.7;
    for (const w of this.wings) w.pivot.rotation.z = -w.side * flap;
  }
}

/**
 * Populate the forest with deer, squirrels and circling birds.
 *
 * @param {import('./navigation.js').NavGrid} nav
 * @returns {{ group: THREE.Group, critters: Array<{update:(d:number,t:number)=>void}> }}
 */
export function createWildlife(nav, { halfSize = 40, water, seed = 7 } = {}) {
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  const critters = [];

  const m = halfSize - 4;
  // Safe roam zones on each bank (clear of the stream band).
  const south = { xmin: -m, xmax: m, zmin: water.zmax + 2.5, zmax: m };
  const north = { xmin: -m, xmax: m, zmin: -m, zmax: water.zmin - 2.5 };

  const add = (critter) => {
    group.add(critter.group);
    critters.push(critter);
  };

  add(new Deer(nav, south, rand));
  add(new Deer(nav, north, rand));

  for (let i = 0; i < 4; i++) {
    add(new Squirrel(nav, i % 2 ? north : south, rand));
  }

  const birdColors = [0x33363d, 0x4a5a8f, 0x7a3b3b, 0x3d6b4a, 0x6b5a8f];
  for (let i = 0; i < 5; i++) {
    add(
      new Bird(rand, {
        cx: (rand() * 2 - 1) * 22,
        cz: (rand() * 2 - 1) * 22,
        rx: 7 + rand() * 8,
        rz: 7 + rand() * 8,
        height: 7 + rand() * 6,
        speed: 0.3 + rand() * 0.45,
        color: birdColors[i % birdColors.length],
      })
    );
  }

  return { group, critters };
}
