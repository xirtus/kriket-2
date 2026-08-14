import { STUMPS_WIDTH, STUMP_HEIGHT, BALL_RADIUS } from '../core/Constants';

export interface LbwInput {
  bounceX: number | null; // x where ball pitched (null = full toss); +x = leg side
  impactX: number; // x at pad plane
  projectedXAtStumps: number; // continued path to the stumps plane
  projectedYAtStumps: number; // height at stumps plane
  shotOffered: boolean;
  noBall: boolean;
}

export interface LbwVerdict {
  out: boolean;
  reason: string;
}

const HALF_STUMPS = STUMPS_WIDTH / 2 + BALL_RADIUS;

export function lbwVerdict(i: LbwInput): LbwVerdict {
  if (i.noBall) return { out: false, reason: 'no-ball' };
  if (i.bounceX !== null && i.bounceX > HALF_STUMPS + 0.08) {
    return { out: false, reason: 'pitched outside leg' };
  }
  if (i.shotOffered && i.impactX < -HALF_STUMPS - 0.1) {
    return { out: false, reason: 'impact outside off' };
  }
  if (!i.shotOffered && i.impactX < -HALF_STUMPS - 0.55) {
    return { out: false, reason: 'impact too far outside off even without a shot' };
  }
  if (Math.abs(i.projectedXAtStumps) > HALF_STUMPS) {
    return { out: false, reason: 'missing the stumps' };
  }
  if (i.projectedYAtStumps > STUMP_HEIGHT + 0.04) {
    return { out: false, reason: 'going over the top' };
  }
  return { out: true, reason: 'hitting the stumps' };
}

export function isWide(xAtStriker: number, heightAtStriker: number): boolean {
  if (heightAtStriker > 2.25) return true; // over the head
  return Math.abs(xAtStriker) > 1.02; // beyond the wide guidelines
}

export function isNoBallOverstep(rng: () => number, bowlerAccuracy: number): boolean {
  // ~1-2% for good bowlers, more for wild ones.
  const p = 0.02 + (1 - bowlerAccuracy / 100) * 0.03;
  return rng() < p;
}
