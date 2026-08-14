import { Vector3 } from 'three';
import { GRAVITY } from '../core/Constants';
import { BallState } from './BallState';
import type { DeliveryType } from './BallState';

export interface ReleaseParams {
  type: DeliveryType;
  speedKmh: number;
  releasePoint: Vector3; // world position at release
  targetPoint: Vector3; // desired bounce point (y = 0)
  spinRpm: number; // magnitude of imparted spin
}

const SPIN_AXES: Record<DeliveryType, (travelDir: Vector3) => Vector3> = {
  'seam-up': (t) => new Vector3(-t.z, 0, t.x).normalize(), // gentle backspin around the seam's own axis, keeps seam upright
  outswing: (t) => new Vector3(-t.z, 0, t.x).normalize(),
  inswing: (t) => new Vector3(-t.z, 0, t.x).normalize(),
  legspin: (t) => new Vector3(t.x, 0.15, t.z).normalize().applyAxisAngle(new Vector3(0, 1, 0), Math.PI / 2),
  offspin: (t) => new Vector3(t.x, 0.15, t.z).normalize().applyAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2),
  topspin: () => new Vector3(1, 0, 0),
  googly: (t) => new Vector3(t.x, 0.15, t.z).normalize().applyAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2),
};

const SEAM_TILT_DEG: Record<DeliveryType, number> = {
  'seam-up': 90, // seam pointing straight down the pitch: minimal swing, relies on pitch seam movement
  outswing: 22,
  inswing: -22,
  legspin: 90,
  offspin: 90,
  topspin: 90,
  googly: 90,
};

/**
 * Coarse ballistic aim that ignores drag/swing/Magnus to pick an initial velocity landing
 * near the target; the real integrator then applies full aerodynamics so the actual
 * pitching point naturally differs based on delivery type, exactly like a real bowler
 * whose swing/seam movement shifts where the ball actually lands.
 */
export function planRelease(params: ReleaseParams): BallState {
  const state = new BallState();
  state.position.copy(params.releasePoint);
  state.deliveryType = params.type;

  const toTarget = new Vector3().subVectors(params.targetPoint, params.releasePoint);
  const horizontalDist = Math.hypot(toTarget.x, toTarget.z);
  const speedMs = params.speedKmh / 3.6;

  const flightTime = horizontalDist / (speedMs * 0.92); // slight derate: real trajectory is not a straight line at this speed
  const vx = toTarget.x / flightTime;
  const vz = toTarget.z / flightTime;
  const vy = (params.targetPoint.y - params.releasePoint.y + 0.5 * GRAVITY * flightTime * flightTime) / flightTime;

  state.velocity.set(vx, vy, vz);

  const travelDir = state.velocity.clone().normalize();
  const spinAxisBase = SPIN_AXES[params.type](travelDir);
  const spinRad = (params.spinRpm * 2 * Math.PI) / 60;
  state.angularVelocity.copy(spinAxisBase).multiplyScalar(spinRad);

  const tiltDeg = SEAM_TILT_DEG[params.type];
  const tiltAxis = new Vector3(0, 1, 0);
  const lateral = new Vector3(-travelDir.z, 0, travelDir.x).normalize();
  state.seamAxis.copy(travelDir).applyAxisAngle(tiltAxis, (tiltDeg * Math.PI) / 180);
  if (Math.abs(tiltDeg) === 90) {
    // seam-up / spin deliveries: seam roughly upright, perpendicular to travel
    state.seamAxis.copy(lateral);
  }

  return state;
}
