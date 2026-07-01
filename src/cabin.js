import * as THREE from 'three';

/**
 * A log cabin the player can enter. The door is a gap in the +Z (front) wall.
 *
 * The camera looks from +X/+Z, so the walls closest to the viewer are the +X
 * and +Z walls. When the player is inside, those near walls and the roof fade
 * out so the interior is visible; the far walls stay as a backdrop.
 *
 * Returns collision discs for the nav grid (perimeter minus the doorway) so the
 * player can only walk in through the door.
 */
export function createCabin({
  cx = 14,
  cz = 4,
  hw = 3,
  hd = 2.6,
  wallH = 2.4,
  wallT = 0.3,
  doorW = 2.6,
} = {}) {
  const group = new THREE.Group();
  const fadeMats = [];

  const logMat = () => new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
  // Fade materials are transparent from the start (toggling `transparent` at
  // runtime needs a shader recompile, so we just animate opacity instead).
  const fadeLog = () => {
    const m = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9, transparent: true });
    fadeMats.push(m);
    return m;
  };
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x53341f, roughness: 0.85, transparent: true });
  fadeMats.push(roofMat);

  // Floor.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.1, hd * 2), floorMat);
  floor.position.set(cx, 0.05, cz);
  floor.receiveShadow = true;
  group.add(floor);

  const wall = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  const yMid = wallH / 2;
  // Far walls (backdrop) — stay solid.
  wall(wallT, wallH, hd * 2, cx - hw, yMid, cz, logMat()); // -X
  wall(hw * 2, wallH, wallT, cx, yMid, cz - hd, logMat()); // -Z (back)

  // Near walls (fade) — +X wall, and +Z front wall split around the doorway.
  wall(wallT, wallH, hd * 2, cx + hw, yMid, cz, fadeLog()); // +X
  const segW = (hw * 2 - doorW) / 2;
  wall(segW, wallH, wallT, cx - hw + segW / 2, yMid, cz + hd, fadeLog());
  wall(segW, wallH, wallT, cx + hw - segW / 2, yMid, cz + hd, fadeLog());
  // Lintel above the door.
  wall(doorW, wallH - 1.6, wallT, cx, wallH - (wallH - 1.6) / 2, cz + hd, fadeLog());

  // Hip (pyramid) roof — one mesh, fades entirely. A 4-sided cone rotated 45°
  // so its flat faces align with the walls; scaled to overhang the eaves.
  const eave = 0.5;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), roofMat);
  roof.scale.set(((hw + eave) / 0.707) , 1.4, ((hd + eave) / 0.707));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(cx, wallH + 0.7, cz);
  roof.castShadow = true;
  group.add(roof);

  // Chimney on the far (-X) side — stays visible.
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.2, 0.6), new THREE.MeshStandardMaterial({ color: 0x6b6b70, roughness: 1 }));
  chimney.position.set(cx - hw + 0.5, wallH + 0.6, cz - hd + 0.8);
  chimney.castShadow = true;
  group.add(chimney);

  // ---- interior furniture (always visible once the near walls fade) --------
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.85 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x8a3b3b, roughness: 0.8 });

  // Bed against the back (-Z) wall.
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.9), wood);
  bed.position.set(cx - hw + 1.1, 0.28, cz - hd + 0.7);
  group.add(bed);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.8), cloth);
  pillow.position.set(cx - hw + 0.5, 0.44, cz - hd + 0.7);
  group.add(pillow);

  // Table + stool near the centre.
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.8), wood);
  table.position.set(cx + 0.6, 0.85, cz);
  group.add(table);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), wood);
      leg.position.set(cx + 0.6 + sx * 0.45, 0.4, cz + sz * 0.3);
      group.add(leg);
    }
  }
  const stool = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), wood);
  stool.position.set(cx + 0.6, 0.25, cz + 0.9);
  group.add(stool);

  // Barrel in a corner.
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 10), wood);
  barrel.position.set(cx + hw - 0.6, 0.4, cz - hd + 0.6);
  group.add(barrel);

  group.traverse((o) => {
    if (o.isMesh) o.castShadow = o.castShadow ?? true;
  });

  // Perimeter collision discs (minus the doorway) for the nav grid.
  const wallObstacles = [];
  const layDiscs = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.ceil(len / 0.5));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      wallObstacles.push({ x: x1 + (x2 - x1) * t, z: z1 + (z2 - z1) * t, radius: 0.3 });
    }
  };
  layDiscs(cx - hw, cz - hd, cx - hw, cz + hd); // -X
  layDiscs(cx + hw, cz - hd, cx + hw, cz + hd); // +X
  layDiscs(cx - hw, cz - hd, cx + hw, cz - hd); // -Z
  // +Z front wall, split around the doorway.
  layDiscs(cx - hw, cz + hd, cx - doorW / 2, cz + hd);
  layDiscs(cx + doorW / 2, cz + hd, cx + hw, cz + hd);

  const interior = {
    xmin: cx - hw + wallT,
    xmax: cx + hw - wallT,
    zmin: cz - hd + wallT,
    zmax: cz + hd - wallT,
  };
  const isInside = (x, z) => x > interior.xmin && x < interior.xmax && z > interior.zmin && z < interior.zmax;

  let fade = 0; // 0 = solid, 1 = faded
  function update(delta, inside) {
    const target = inside ? 1 : 0;
    fade += (target - fade) * Math.min(1, delta * 6);
    const opacity = 1 - fade * 0.92;
    for (const m of fadeMats) {
      m.opacity = opacity;
      m.depthWrite = opacity > 0.5; // don't occlude the interior once see-through
    }
  }

  return {
    group,
    wallObstacles,
    isInside,
    update,
    footprint: { xmin: cx - hw - 0.5, xmax: cx + hw + 0.5, zmin: cz - hd - 0.5, zmax: cz + hd + 0.5 },
    // Keep the doorway approach clear of trees too.
    doorClear: { xmin: cx - doorW, xmax: cx + doorW, zmin: cz + hd, zmax: cz + hd + 3 },
  };
}
