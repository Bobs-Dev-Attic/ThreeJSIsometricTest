import * as THREE from 'three';

/**
 * The cave interior — its own board (a separate scene in main). Rock walls
 * enclose a cavern; the entrance is a gap in the +Z (near) wall. The camera
 * looks from +X/+Z, so the +X and +Z walls are kept see-through so the player
 * is always visible inside. A bear sleeps at the far (-Z) end.
 *
 * Returns collision discs (perimeter minus the doorway, stalagmites, bear),
 * the entry point, bear position, and the exit-Z threshold.
 */
export function createCave() {
  const group = new THREE.Group();
  const obstacles = [];

  const rock = new THREE.MeshStandardMaterial({ color: 0x4a4a54, roughness: 1 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2f2d36, roughness: 1 });
  const fadeRock = () =>
    new THREE.MeshStandardMaterial({ color: 0x4a4a54, roughness: 1, transparent: true, opacity: 0.16, depthWrite: false });

  const Xmin = -7;
  const Xmax = 7;
  const Zmin = -16;
  const Zmax = 2;
  const H = 3.0;
  const T = 0.6;
  const doorW = 3;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(Xmax - Xmin + T * 2, 0.2, Zmax - Zmin + T * 2), floorMat);
  floor.position.set((Xmin + Xmax) / 2, 0, (Zmin + Zmax) / 2);
  group.add(floor);

  const wall = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  const yMid = H / 2;
  // Far walls stay solid (backdrop).
  wall(T, H, Zmax - Zmin, Xmin, yMid, (Zmin + Zmax) / 2, rock); // -X
  wall(Xmax - Xmin, H, T, (Xmin + Xmax) / 2, yMid, Zmin, rock); // -Z (back)
  // Near walls kept see-through so the player is visible.
  wall(T, H, Zmax - Zmin, Xmax, yMid, (Zmin + Zmax) / 2, fadeRock()); // +X
  const segW = (Xmax - Xmin - doorW) / 2;
  wall(segW, H, T, Xmin + segW / 2, yMid, Zmax, fadeRock());
  wall(segW, H, T, Xmax - segW / 2, yMid, Zmax, fadeRock());

  // Stalagmites (decor + obstacles), kept off the central lane.
  const stalMat = new THREE.MeshStandardMaterial({ color: 0x5a5a64, roughness: 1 });
  for (const [sx, sz] of [[-4.5, -4], [5, -7], [-5, -10.5], [4.5, -13.5], [-3, -14.5], [4, -1]]) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 6), stalMat);
    c.position.set(sx, 0.8, sz);
    group.add(c);
    obstacles.push({ x: sx, z: sz, radius: 0.5 });
  }

  // A torch near the entrance for warmth/atmosphere.
  const torch = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffb457, emissive: 0xff7a1a, emissiveIntensity: 1.6 })
  );
  torch.position.set(Xmax - 0.7, 1.9, Zmax - 0.7);
  group.add(torch);

  // Perimeter collision discs (with the doorway gap in the +Z wall).
  const lay = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.ceil(len / 0.5));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      obstacles.push({ x: x1 + (x2 - x1) * t, z: z1 + (z2 - z1) * t, radius: 0.35 });
    }
  };
  lay(Xmin, Zmin, Xmin, Zmax);
  lay(Xmax, Zmin, Xmax, Zmax);
  lay(Xmin, Zmin, Xmax, Zmin);
  lay(Xmin, Zmax, -doorW / 2, Zmax);
  lay(doorW / 2, Zmax, Xmax, Zmax);

  const bearPos = { x: 0, z: Zmin + 3 };
  obstacles.push({ x: bearPos.x, z: bearPos.z, radius: 1.6 });

  return {
    group,
    obstacles,
    entry: { x: 0, z: Zmax - 2 },
    bearPos,
    exitZ: Zmax - 0.4,
    bounds: { Xmin, Xmax, Zmin, Zmax },
  };
}

/**
 * A rocky cave mouth to place in the forest. The dark opening faces +Z; walking
 * up to `trigger` sends the player into the cave board.
 */
export function createForestCaveMouth({ x = 0, z = 0 } = {}) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const obstacles = [];
  const rock = new THREE.MeshStandardMaterial({ color: 0x565660, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x08080e, roughness: 1 });

  for (const [bx, bz, r] of [[-2.3, -0.4, 1.3], [2.3, -0.4, 1.3], [-1.7, -1.9, 1.5], [1.7, -1.9, 1.5], [0, -2.4, 1.8]]) {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rock);
    b.position.set(bx, r * 0.6, bz);
    b.rotation.set(bx, bz, 1);
    b.castShadow = true;
    group.add(b);
    obstacles.push({ x: x + bx, z: z + bz, radius: r * 0.8 });
  }
  const opening = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), dark);
  opening.position.set(0, 1.1, -0.1);
  group.add(opening);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 1.3), rock);
  lintel.position.set(0, 2.2, -0.5);
  lintel.castShadow = true;
  group.add(lintel);

  return {
    group,
    obstacles,
    trigger: { x, z: z + 1.4 },
    footprint: { xmin: x - 3.5, xmax: x + 3.5, zmin: z - 4, zmax: z + 3 },
  };
}
