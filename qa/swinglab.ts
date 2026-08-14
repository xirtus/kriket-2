// Measure actual swing/turn magnitudes through the flight.
import { planRelease } from '../src/physics/Release';
import { stepBall } from '../src/physics/Integrator';
import { PITCH_PRESETS } from '../src/physics/PitchSurface';
import { Vector3 } from 'three';
import type { DeliveryType } from '../src/physics/BallState';

const pitch = PITCH_PRESETS.flat_batting;

function flight(type: DeliveryType, speedKmh: number, spinRpm: number): void {
  const s = planRelease({
    type,
    speedKmh,
    releasePoint: new Vector3(0.68, 2.3, -8.9),
    targetPoint: new Vector3(0, 0, 5.1), // good length
    spinRpm,
  });
  s.isDead = false;
  const dt = 1 / 240;
  let bounceX: number | null = null;
  for (let i = 0; i < 240 * 3; i++) {
    stepBall(s, dt, pitch, () => 0.5);
    if (s.hasBounced && bounceX === null) bounceX = s.position.x;
    if (s.position.z >= 10.06) {
      console.log(
        `${type.padEnd(9)} ${speedKmh}km/h: bounce x=${bounceX?.toFixed(2)} → at stumps x=${s.position.x.toFixed(2)} y=${s.position.y.toFixed(2)}  (lateral post-bounce: ${(s.position.x - (bounceX ?? 0)).toFixed(2)}m)`,
      );
      return;
    }
  }
  console.log(`${type} ${speedKmh}: never reached stumps (final z ${s.position.z.toFixed(1)})`);
}

flight('outswing', 136, 200);
flight('inswing', 136, 200);
flight('seam-up', 136, 200);
flight('legspin', 88, 2000);
flight('offspin', 88, 2000);
flight('googly', 88, 2000);
