import { Vector3 } from 'three';
import { AIR_DENSITY, BALL_RADIUS } from '../core/Constants';
import { BallState } from './BallState';

const CROSS_SECTION_AREA = Math.PI * BALL_RADIUS * BALL_RADIUS;
const DRAG_COEFFICIENT_BASE = 0.42;
const REVERSE_SWING_SPEED_MS = 36 * 0.85; // reverse tends to kick in near ~130km/h with a rough, worn ball

export interface AeroForces {
  drag: Vector3;
  magnus: Vector3;
  swing: Vector3;
  total: Vector3;
}

/**
 * Computes drag, Magnus (spin) and seam-swing forces for the current ball state.
 * Swing model: lateral force from asymmetric boundary-layer separation around the seam,
 * peaking when the seam is presented ~20-25deg off the direction of travel, flipping sign
 * once the ball is worn enough and travelling fast enough to reverse-swing.
 */
export interface AeroEnv {
  /** Multiplies lateral swing force: humid/overcast conditions > 1, dry still air < 1. */
  swingScale: number;
}

const DEFAULT_ENV: AeroEnv = { swingScale: 1 };

export function computeAeroForces(state: BallState, env: AeroEnv = DEFAULT_ENV): AeroForces {
  const v = state.velocity;
  const speed = v.length();
  const drag = new Vector3();
  const magnus = new Vector3();
  const swing = new Vector3();

  if (speed < 1e-4) {
    return { drag, magnus, swing, total: new Vector3() };
  }

  const vDir = v.clone().normalize();

  const dragMag = 0.5 * AIR_DENSITY * DRAG_COEFFICIENT_BASE * CROSS_SECTION_AREA * speed * speed;
  drag.copy(vDir).multiplyScalar(-dragMag);

  const omega = state.angularVelocity;
  const omegaMag = omega.length();
  if (omegaMag > 1e-3) {
    const spinParam = (BALL_RADIUS * omegaMag) / speed;
    const liftCoeff = 0.35 * Math.tanh(spinParam * 1.8);
    const magnusDir = new Vector3().crossVectors(omega, v);
    if (magnusDir.lengthSq() > 1e-8) {
      magnusDir.normalize();
      const magnusMag = liftCoeff * 0.5 * AIR_DENSITY * CROSS_SECTION_AREA * speed * speed;
      magnus.copy(magnusDir).multiplyScalar(magnusMag);
    }
  }

  const seamAngle = state.seamAxis.angleTo(vDir);
  const swingEffectiveness = Math.sin(seamAngle) * Math.cos(seamAngle) * 2;
  const shineFactor = Math.max(0, 1 - state.wear);
  const isReverseRegime = state.wear > 0.55 && speed > REVERSE_SWING_SPEED_MS;

  let swingCoeff: number;
  if (isReverseRegime) {
    swingCoeff = -0.22 * (state.wear - 0.5) * 2 * swingEffectiveness;
  } else {
    swingCoeff = 0.22 * shineFactor * swingEffectiveness;
  }
  swingCoeff *= env.swingScale;

  const seamCrossV = new Vector3().crossVectors(state.seamAxis, vDir);
  if (seamCrossV.lengthSq() > 1e-8) {
    const swingDir = new Vector3().crossVectors(vDir, seamCrossV).normalize();
    const swingMag = swingCoeff * 0.5 * AIR_DENSITY * CROSS_SECTION_AREA * speed * speed;
    swing.copy(swingDir).multiplyScalar(swingMag);
  }

  const total = new Vector3().add(drag).add(magnus).add(swing);
  return { drag, magnus, swing, total };
}
