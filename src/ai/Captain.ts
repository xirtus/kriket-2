import { FIELD_PRESETS, type FieldPlacement, type FieldSlot } from '../cricket/Field';
import type { InningsState } from '../cricket/MatchState';
import type { Format, PlayerSpec, BallResolution } from '../cricket/Types';

const CONTACT_X = 0.4;
const CONTACT_Z = 7.9;

/** Angle of where the ball finished, in field-slot convention (+off / -leg). */
function shotAngleDeg(x: number, z: number): number {
  return (Math.atan2(-(x - CONTACT_X), -(z - CONTACT_Z)) * 180) / Math.PI;
}

/**
 * Reactive captaincy: scan recent scoring shots, find the zone being milked,
 * and post a boundary rider there. The batting AI then has to find the NEW gap —
 * the tactical cat-and-mouse of real limited-overs cricket.
 */
function reactToLeaks(base: FieldPlacement, history: BallResolution[]): FieldPlacement {
  const recent = history.slice(-15).filter((r) => r.legal);
  const leakAngles: number[] = [];
  for (const r of recent) {
    const total = r.runsOffBat;
    if (total >= 2 && r.shotX !== undefined && r.shotZ !== undefined) {
      leakAngles.push(shotAngleDeg(r.shotX, r.shotZ));
    }
  }
  if (leakAngles.length < 2) return base;

  const slots: FieldSlot[] = base.slots.map((sl) => ({ ...sl }));
  for (const leak of leakAngles) {
    // Is there already a deep fielder near this line?
    const covered = slots.some((sl) => sl.dist > 40 && Math.abs(sl.angle - leak) < 22);
    if (covered) continue;
    // Move the ring fielder closest to the leak line out to the rope.
    let bestIdx = -1;
    let bestD = Infinity;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i].dist > 40) continue;
      const d = Math.abs(slots[i].angle - leak);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestD < 70) {
      slots[bestIdx] = { angle: leak, dist: 52, name: `sweeper` };
    }
  }
  return { label: base.label + ' (adj)', slots };
}

/** Field settings by format, phase, bowler style and how the batter is playing. */
export function chooseField(
  format: Format,
  _innings: InningsState,
  bowler: PlayerSpec,
  overNumber: number,
  strikerAggressive: boolean,
): FieldPlacement {
  const isSpinner = bowler.bowlStyle === 'offspin' || bowler.bowlStyle === 'legspin';

  let base: FieldPlacement;
  if (format === 'TEST') {
    if (isSpinner) base = strikerAggressive ? FIELD_PRESETS.spinDefensive : FIELD_PRESETS.spinAttacking;
    else base = strikerAggressive ? FIELD_PRESETS.odiStandard : FIELD_PRESETS.testAttacking;
  } else {
    const total = format === 'T20' ? 20 : 50;
    const pp = format === 'T20' ? 6 : 10;
    if (overNumber < pp) {
      base = isSpinner ? FIELD_PRESETS.spinAttacking : FIELD_PRESETS.t20Powerplay;
    } else if (overNumber >= total - 5) {
      base = FIELD_PRESETS.t20Death;
    } else if (isSpinner) {
      base = strikerAggressive ? FIELD_PRESETS.spinDefensive : FIELD_PRESETS.spinAttacking;
    } else {
      base = FIELD_PRESETS.odiStandard;
    }
  }
  return reactToLeaks(base, _innings.history);
}
