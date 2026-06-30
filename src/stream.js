import * as THREE from 'three';

/**
 * A stream running east–west across the forest (a band on Z), with a wooden
 * bridge crossing it on X. Returns the meshes plus an `animate(t)` that ripples
 * the water surface, and the resolved geometry/config the rest of the game
 * needs (navigation band, bridge corridor, deck surface height).
 */
export function createStream({
  halfSize = 40,
  zCenter = -6,
  halfWidth = 3,
  bridgeXCenter = 0,
  bridgeHalfWidth = 2.5,
  deckHeight = 0.5,
  deckThickness = 0.2,
} = {}) {
  const group = new THREE.Group();
  const bandLen = halfWidth * 2;

  // Riverbed under the water so the green ground doesn't show through.
  const bed = new THREE.Mesh(
    new THREE.PlaneGeometry(halfSize * 2, bandLen + 1.5),
    new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 1 })
  );
  bed.rotation.x = -Math.PI / 2;
  bed.position.set(0, 0.03, zCenter);
  bed.receiveShadow = false;
  group.add(bed);

  // Water surface — segmented so we can ripple its vertices each frame.
  const wseg = Math.max(8, Math.round(halfSize));
  const waterGeo = new THREE.PlaneGeometry(halfSize * 2, bandLen, wseg, 6);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2f7fb5,
    roughness: 0.25,
    transparent: true,
    opacity: 0.82,
    emissive: 0x0a3550,
    emissiveIntensity: 0.35,
    flatShading: true,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.15, zCenter);
  group.add(water);

  // Bridge -----------------------------------------------------------------
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.85 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x4f3620, roughness: 0.9 });
  const deckLen = bandLen + 1.8;
  const deckW = bridgeHalfWidth * 2;

  const deck = new THREE.Mesh(new THREE.BoxGeometry(deckW, deckThickness, deckLen), woodMat);
  deck.position.set(bridgeXCenter, deckHeight, zCenter);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  // Plank slats across the deck for a bit of texture.
  const plankCount = Math.round(deckLen / 0.5);
  for (let i = 0; i < plankCount; i++) {
    const pz = zCenter - deckLen / 2 + (i + 0.5) * (deckLen / plankCount);
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(deckW * 0.96, deckThickness * 0.5, deckLen / plankCount * 0.8),
      i % 2 ? woodDark : woodMat
    );
    plank.position.set(bridgeXCenter, deckHeight + deckThickness * 0.5, pz);
    plank.receiveShadow = true;
    group.add(plank);
  }

  // Railings (a top rail plus posts) on both sides.
  for (const side of [-1, 1]) {
    const railX = bridgeXCenter + side * (bridgeHalfWidth - 0.1);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, deckLen), woodMat);
    rail.position.set(railX, deckHeight + 0.5, zCenter);
    rail.castShadow = true;
    group.add(rail);

    const nPosts = 4;
    for (let p = 0; p < nPosts; p++) {
      const t = p / (nPosts - 1);
      const pz = zCenter - deckLen / 2 + t * deckLen;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), woodMat);
      post.position.set(railX, deckHeight + 0.28, pz);
      post.castShadow = true;
      group.add(post);
    }
  }

  // Support legs reaching down into the streambed.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, deckHeight + 0.2, 0.18), woodDark);
      leg.position.set(
        bridgeXCenter + sx * (bridgeHalfWidth - 0.3),
        (deckHeight + 0.2) / 2 - 0.1,
        zCenter + sz * (bandLen / 2 - 0.2)
      );
      leg.castShadow = true;
      group.add(leg);
    }
  }

  // Ripple the water by displacing local Z (which maps to world Y after the
  // plane's -90° rotation about X).
  const posAttr = waterGeo.attributes.position;
  const animate = (t) => {
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      // Keep total amplitude below the water-to-bed gap so troughs never
      // expose the riverbed.
      posAttr.setZ(i, Math.sin(x * 0.5 + t * 1.6) * 0.05 + Math.cos(y * 0.7 - t * 1.3) * 0.035);
    }
    posAttr.needsUpdate = true;
    waterGeo.computeVertexNormals();
  };

  return {
    group,
    water,
    animate,
    config: {
      zCenter,
      halfWidth,
      bridgeXCenter,
      bridgeHalfWidth,
      deckHeight,
      deckThickness,
      deckSurface: deckHeight + deckThickness / 2,
      // Navigation band / corridor (un-inflated; NavGrid adds the agent radius).
      water: {
        zmin: zCenter - halfWidth,
        zmax: zCenter + halfWidth,
        bridgeXmin: bridgeXCenter - bridgeHalfWidth,
        bridgeXmax: bridgeXCenter + bridgeHalfWidth,
      },
    },
  };
}
