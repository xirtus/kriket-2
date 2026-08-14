import { STRIKER_STUMPS_Z } from '../world/Pitch';

/** Field coordinates: angle degrees from "straight down the ground toward the bowler",
 *  positive = off side (for a right-hander), negative = leg side. Distance in metres
 *  from the batting contact point. */
export interface FieldSlot {
  angle: number;
  dist: number;
  name: string;
}

export interface FieldPlacement {
  slots: FieldSlot[]; // exactly 9 (keeper + bowler excluded)
  label: string;
}

export const CONTACT_POINT_Z = STRIKER_STUMPS_Z - 1.4;

export function slotToWorld(slot: FieldSlot): { x: number; z: number } {
  const rad = (slot.angle * Math.PI) / 180;
  return {
    x: -Math.sin(rad) * slot.dist,
    z: CONTACT_POINT_Z - Math.cos(rad) * slot.dist,
  };
}

function s(angle: number, dist: number, name: string): FieldSlot {
  return { angle, dist, name };
}

/** Behind-square positions need to sit behind the batting crease (+z). slotToWorld's
 *  cosine term handles that once |angle| > 90, so presets can be written naturally. */

export const FIELD_PRESETS: Record<string, FieldPlacement> = {
  testAttacking: {
    label: 'Attacking',
    slots: [
      s(158, 12, '1st slip'), s(168, 13, '2nd slip'), s(178, 14, '3rd slip'),
      s(120, 16, 'gully'), s(85, 18, 'point'), s(40, 17, 'cover'),
      s(12, 14, 'mid off'), s(-12, 14, 'mid on'), s(-45, 18, 'midwicket'),
    ],
  },
  odiStandard: {
    label: 'Standard ODI',
    slots: [
      s(85, 24, 'point'), s(40, 24, 'cover'), s(10, 20, 'mid off'),
      s(-10, 20, 'mid on'), s(-45, 24, 'midwicket'), s(-88, 24, 'square leg'),
      s(6, 56, 'long off'), s(-6, 56, 'long on'), s(-48, 54, 'deep midwicket'),
    ],
  },
  t20Powerplay: {
    label: 'T20 Powerplay',
    slots: [
      s(162, 13, 'slip'), s(85, 24, 'point'), s(40, 24, 'cover'),
      s(12, 20, 'mid off'), s(-12, 20, 'mid on'), s(-45, 24, 'midwicket'),
      s(-88, 24, 'square leg'), s(140, 48, 'third man'), s(-150, 45, 'fine leg'),
    ],
  },
  t20Death: {
    label: 'T20 Death',
    slots: [
      s(5, 57, 'long off'), s(-5, 57, 'long on'), s(42, 55, 'deep cover'),
      s(-45, 56, 'deep midwicket'), s(88, 50, 'deep point'),
      s(140, 25, 'short third'), s(-145, 25, 'fine leg'), s(22, 20, 'extra cover'),
      s(-90, 24, 'square leg'),
    ],
  },
  spinAttacking: {
    label: 'Spin Attack',
    slots: [
      s(160, 12, 'slip'), s(120, 10, 'short leg off'), s(-120, 9, 'short leg'),
      s(85, 22, 'point'), s(40, 22, 'cover'), s(10, 18, 'mid off'),
      s(-10, 18, 'mid on'), s(-45, 22, 'midwicket'), s(-88, 30, 'square leg'),
    ],
  },
  spinDefensive: {
    label: 'Spin Contain',
    slots: [
      s(6, 55, 'long off'), s(-6, 55, 'long on'), s(42, 52, 'deep cover'),
      s(-45, 54, 'deep midwicket'), s(-88, 42, 'deep square'),
      s(85, 30, 'point'), s(150, 30, 'short third'), s(-150, 30, 'fine leg'),
      s(20, 20, 'cover ring'),
    ],
  },
};

/** Ring restriction for limited-overs powerplay: at most N outside the 30-yard circle. */
export function countOutsideRing(placement: FieldPlacement): number {
  return placement.slots.filter((sl) => sl.dist > 27).length;
}
