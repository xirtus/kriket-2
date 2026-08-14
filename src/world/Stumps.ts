import * as THREE from 'three';
import { STUMP_HEIGHT, STUMPS_WIDTH } from '../core/Constants';

const STUMP_RADIUS = 0.019;

export function buildStumps(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'stumps';

  const woodMat = new THREE.MeshStandardMaterial({ color: 0xe8d9b0, roughness: 0.5 });
  const stumpGeo = new THREE.CylinderGeometry(STUMP_RADIUS, STUMP_RADIUS, STUMP_HEIGHT, 12);

  const offsets = [-STUMPS_WIDTH / 2, 0, STUMPS_WIDTH / 2];
  for (const x of offsets) {
    const stump = new THREE.Mesh(stumpGeo, woodMat);
    stump.position.set(x, STUMP_HEIGHT / 2, 0);
    stump.castShadow = true;
    group.add(stump);
  }

  const bailGeo = new THREE.CapsuleGeometry(0.006, STUMPS_WIDTH / 2 - 0.02, 4, 8);
  for (let i = 0; i < 2; i++) {
    const bail = new THREE.Mesh(bailGeo, woodMat);
    bail.name = `bail${i}`;
    bail.rotation.z = Math.PI / 2;
    bail.position.set((offsets[i] + offsets[i + 1]) / 2, STUMP_HEIGHT + STUMP_RADIUS, 0);
    bail.castShadow = true;
    group.add(bail);
  }

  return group;
}

export function stumpsBoundingBox(centerZ: number): THREE.Box3 {
  const halfWidth = STUMPS_WIDTH / 2 + STUMP_RADIUS;
  return new THREE.Box3(
    new THREE.Vector3(-halfWidth, 0, centerZ - STUMP_RADIUS),
    new THREE.Vector3(halfWidth, STUMP_HEIGHT + 0.02, centerZ + STUMP_RADIUS),
  );
}
