import * as THREE from 'three';
import { BOWLER_STUMPS_Z, STRIKER_STUMPS_Z } from '../world/Pitch';

export type CamState = 'tv' | 'follow' | 'wicket' | 'replay' | 'behindBatter';

/**
 * Broadcast camera work: the classic high behind-the-bowler TV frame, a panning
 * follow once the ball is hit, a cut to the stumps for wickets, and a side-on
 * replay position. Transitions are critically damped so cuts feel like a truck,
 * not a teleport (except deliberate hard cuts).
 */
export class CameraDirector {
  frozen = false;
  private state: CamState = 'tv';
  private readonly pos = new THREE.Vector3();
  private readonly look = new THREE.Vector3(0, 1, STRIKER_STUMPS_Z);
  private stateT = 0;

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    this.toTV();
  }

  get current(): CamState {
    return this.state;
  }

  toTV(): void {
    this.state = 'tv';
    this.stateT = 0;
    this.pos.set(-2.4, 9.4, BOWLER_STUMPS_Z - 24.5);
    this.camera.position.copy(this.pos);
    this.camera.fov = 33;
    this.camera.updateProjectionMatrix();
    this.look.set(0.3, 1.35, STRIKER_STUMPS_Z - 2);
  }

  toFollow(): void {
    if (this.state !== 'follow') {
      this.state = 'follow';
      this.stateT = 0;
    }
  }

  toBehindBatter(): void {
    this.state = 'behindBatter';
    this.stateT = 0;
    this.pos.set(1.6, 3.4, STRIKER_STUMPS_Z + 8.5);
  }

  toWicket(): void {
    this.state = 'wicket';
    this.stateT = 0;
    this.pos.set(2.4, 1.6, STRIKER_STUMPS_Z + 3.2);
  }

  toReplay(): void {
    this.state = 'replay';
    this.stateT = 0;
    this.pos.set(26, 3.2, 2.0);
    this.look.set(0, 0.8, 2);
    this.camera.position.copy(this.pos);
  }

  update(dt: number, ballPos: THREE.Vector3 | null): void {
    if (this.frozen) return;
    this.stateT += dt;
    const cam = this.camera;
    switch (this.state) {
      case 'tv': {
        // Subtle tracking: keep the striker framed, drift with the ball pre-hit.
        const target = ballPos ? ballPos : new THREE.Vector3(0.3, 1, STRIKER_STUMPS_Z - 2);
        this.look.lerp(new THREE.Vector3(target.x * 0.35, Math.max(0.6, target.y * 0.5), target.z), 1 - Math.pow(0.02, dt));
        cam.position.lerp(this.pos, 1 - Math.pow(0.001, dt));
        break;
      }
      case 'follow': {
        if (ballPos) {
          // Snap onto the ball like a real TV operator: fast pan, gentle dolly,
          // and widen as the shot travels.
          this.look.lerp(ballPos, 1 - Math.pow(0.000001, dt));
          const d = Math.hypot(ballPos.x, ballPos.z);
          const targetPos = new THREE.Vector3(
            THREE.MathUtils.clamp(ballPos.x * 0.22, -9, 9) - 2.4,
            9.4 + d * 0.16,
            BOWLER_STUMPS_Z - 24.5 + Math.max(0, ballPos.z) * 0.3,
          );
          cam.position.lerp(targetPos, 1 - Math.pow(0.01, dt));
          const targetFov = THREE.MathUtils.clamp(33 + d * 0.16, 33, 44);
          cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 2.4);
          cam.updateProjectionMatrix();
        }
        break;
      }
      case 'behindBatter': {
        if (ballPos) this.look.lerp(ballPos, 1 - Math.pow(0.005, dt));
        cam.position.lerp(this.pos, 1 - Math.pow(0.001, dt));
        break;
      }
      case 'wicket': {
        this.look.lerp(new THREE.Vector3(0, 0.7, STRIKER_STUMPS_Z), 1 - Math.pow(0.001, dt));
        cam.position.lerp(this.pos, 1 - Math.pow(0.005, dt));
        break;
      }
      case 'replay': {
        if (ballPos) this.look.lerp(ballPos, 1 - Math.pow(0.0005, dt));
        else this.look.lerp(new THREE.Vector3(0, 0.8, 2), 1 - Math.pow(0.005, dt));
        cam.position.lerp(this.pos, 1 - Math.pow(0.005, dt));
        break;
      }
    }
    cam.lookAt(this.look);
  }
}
