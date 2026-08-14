import * as THREE from 'three';
import { BALL_RADIUS } from '../core/Constants';
import { BallState } from '../physics/BallState';

export class Ball {
  readonly mesh: THREE.Group;
  state = new BallState();

  constructor() {
    this.mesh = new THREE.Group();
    this.mesh.name = 'ball';

    const coreGeo = new THREE.SphereGeometry(BALL_RADIUS, 24, 24);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x9e1414, roughness: 0.35, metalness: 0.05 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.castShadow = true;
    this.mesh.add(core);

    const seamGeo = new THREE.TorusGeometry(BALL_RADIUS * 1.0, BALL_RADIUS * 0.045, 6, 48);
    const seamMat = new THREE.MeshStandardMaterial({ color: 0xf3ead6, roughness: 0.6 });
    const seam = new THREE.Mesh(seamGeo, seamMat);
    this.mesh.add(seam);
  }

  syncVisual(): void {
    this.mesh.position.copy(this.state.position);
    this.mesh.quaternion.copy(this.state.orientation);
  }
}
