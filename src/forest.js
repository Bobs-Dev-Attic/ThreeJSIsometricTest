import * as THREE from 'three';

// Small deterministic PRNG so the forest layout is stable between reloads.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds the forest world: a ground plane scattered with low-poly trees,
 * rocks and shrubs. The area immediately around the spawn point is kept clear.
 *
 * @returns {{ group: THREE.Group, halfSize: number }}
 */
export function createForest({ halfSize = 40, treeCount = 110, seed = 1337 } = {}) {
  const rand = mulberry32(seed);
  const group = new THREE.Group();

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(halfSize * 2, halfSize * 2, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x4a7c3a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Shared materials (reused across instances to keep things light).
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });
  const foliageMats = [0x2f5d34, 0x3a7d44, 0x356b3a, 0x49945a].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })
  );
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7d7d83, roughness: 1 });

  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 6);
  const coneGeo = new THREE.ConeGeometry(1.1, 1.8, 7);
  const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);

  const clearRadius = 6; // keep the spawn area walkable

  const placeAway = () => {
    let x, z;
    do {
      x = (rand() * 2 - 1) * halfSize;
      z = (rand() * 2 - 1) * halfSize;
    } while (Math.hypot(x, z) < clearRadius);
    return [x, z];
  };

  for (let i = 0; i < treeCount; i++) {
    const tree = new THREE.Group();
    const scale = 0.7 + rand() * 1.1;

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.8;
    trunk.castShadow = true;
    tree.add(trunk);

    // Stacked cones make a pleasant conifer silhouette.
    const tiers = 2 + Math.floor(rand() * 2);
    for (let t = 0; t < tiers; t++) {
      const cone = new THREE.Mesh(coneGeo, foliageMats[Math.floor(rand() * foliageMats.length)]);
      const tierScale = 1 - t * 0.22;
      cone.scale.setScalar(tierScale);
      cone.position.y = 1.6 + t * 1.0;
      cone.castShadow = true;
      tree.add(cone);
    }

    const [x, z] = placeAway();
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    tree.rotation.y = rand() * Math.PI * 2;
    group.add(tree);
  }

  // A handful of rocks for variety.
  for (let i = 0; i < 24; i++) {
    const rock = new THREE.Mesh(rockGeo, rockMat);
    const [x, z] = placeAway();
    const s = 0.5 + rand() * 1.3;
    rock.position.set(x, s * 0.3, z);
    rock.scale.setScalar(s);
    rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  // Low shrubs (flattened spheres) sprinkled around.
  const shrubGeo = new THREE.IcosahedronGeometry(0.6, 0);
  for (let i = 0; i < 40; i++) {
    const shrub = new THREE.Mesh(shrubGeo, foliageMats[Math.floor(rand() * foliageMats.length)]);
    const [x, z] = placeAway();
    const s = 0.5 + rand() * 0.9;
    shrub.position.set(x, s * 0.4, z);
    shrub.scale.set(s, s * 0.7, s);
    shrub.castShadow = true;
    group.add(shrub);
  }

  return { group, halfSize };
}
