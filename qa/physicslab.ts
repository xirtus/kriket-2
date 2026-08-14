import { BallState } from '../src/physics/BallState';
import { stepBall } from '../src/physics/Integrator';
import type { PitchProperties } from '../src/physics/PitchSurface';

function rollTest(exitSpeed: number, elevDeg: number, lin: number, prop: number): { dist: number; time: number } {
  const OUT: PitchProperties = { restitution: 0.42, friction: 0.75, seamCatchiness: 0.05, hardness: 0.6, rollDrag: prop, rollLin: lin, label: 'O' };
  const s = new BallState();
  s.position.set(0.4, 0.4, 7.9);
  const el = (elevDeg * Math.PI) / 180;
  s.velocity.set(0, Math.sin(el) * exitSpeed, -Math.cos(el) * exitSpeed);
  s.isDead = false;
  const dt = 1 / 240;
  let t = 0;
  while (t < 14) {
    stepBall(s, dt, OUT);
    t += dt;
    if (s.velocity.length() < 0.5 && s.position.y < 0.1) break;
  }
  return { dist: Math.abs(s.position.z - 7.9), time: t };
}

for (const [lin, prop] of [[1.6, 0.2], [2.2, 0.18], [2.8, 0.16], [3.4, 0.14]] as const) {
  console.log(`── lin=${lin} prop=${prop}`);
  for (const v of [15, 18, 21, 24, 27, 30]) {
    const a = rollTest(v, 3, lin, prop);
    const b = rollTest(v, 9, lin, prop);
    console.log(`  exit ${v}: flat ${a.dist.toFixed(0)}m/${a.time.toFixed(1)}s   elev9 ${b.dist.toFixed(0)}m/${b.time.toFixed(1)}s`);
  }
}
